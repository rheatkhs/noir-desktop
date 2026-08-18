use crate::providers::{LlmProvider, StreamSender};
use crate::types::{ChatMessage, LlmConfig, StreamEvent};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};

pub struct AnthropicProvider;

impl AnthropicProvider {
    fn resolve_base_url(config: &LlmConfig) -> String {
        config
            .base_url
            .as_deref()
            .unwrap_or("https://api.anthropic.com")
            .trim_end_matches('/')
            .to_string()
    }

    /// Anthropic expects a separate `system` parameter, not a system message in the array.
    fn split_system(messages: &[ChatMessage]) -> (Option<String>, Vec<Value>) {
        let mut system_text: Option<String> = None;
        let mut msgs = Vec::new();

        for m in messages {
            if m.role == "system" {
                // Concatenate system messages
                match &mut system_text {
                    Some(existing) => {
                        existing.push('\n');
                        existing.push_str(&m.content);
                    }
                    None => system_text = Some(m.content.clone()),
                }
            } else {
                msgs.push(json!({
                    "role": m.role,
                    "content": m.content,
                }));
            }
        }

        (system_text, msgs)
    }
}

impl LlmProvider for AnthropicProvider {
    async fn stream_chat(
        config: &LlmConfig,
        messages: Vec<ChatMessage>,
        tx: StreamSender,
    ) -> Result<(), String> {
        let base_url = Self::resolve_base_url(config);
        let url = format!("{}/v1/messages", base_url);

        let (system, msgs) = Self::split_system(&messages);

        let mut body = json!({
            "model": config.model,
            "messages": msgs,
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
            "stream": true,
        });

        if let Some(sys) = system {
            body.as_object_mut()
                .unwrap()
                .insert("system".to_string(), json!(sys));
        }

        let client = Client::new();
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("x-api-key", &config.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response
                .text()
                .await
                .unwrap_or_else(|_| "unknown error".to_string());
            let msg = format!("API error {status}: {error_body}");
            let _ = tx.send(StreamEvent::Error {
                message: msg.clone(),
            });
            return Err(msg);
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut current_tool_id = String::new();
        let mut current_tool_name = String::new();
        let mut tool_input_buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    let _ = tx.send(StreamEvent::Error {
                        message: format!("Stream read error: {e}"),
                    });
                    return Err(format!("Stream read error: {e}"));
                }
            };

            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() || line.starts_with(':') {
                    continue;
                }

                // Parse SSE event type and data
                if let Some(data) = line.strip_prefix("data: ") {
                    let data = data.trim();
                    let parsed: Value = match serde_json::from_str(data) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };

                    let event_type = parsed
                        .get("type")
                        .and_then(|t| t.as_str())
                        .unwrap_or("");

                    match event_type {
                        "content_block_start" => {
                            // Check if it's a tool_use block
                            if let Some(block) = parsed.get("content_block") {
                                let block_type =
                                    block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                                if block_type == "tool_use" {
                                    current_tool_id = block
                                        .get("id")
                                        .and_then(|i| i.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    current_tool_name = block
                                        .get("name")
                                        .and_then(|n| n.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    tool_input_buffer.clear();
                                }
                            }
                        }
                        "content_block_delta" => {
                            if let Some(delta) = parsed.get("delta") {
                                let delta_type =
                                    delta.get("type").and_then(|t| t.as_str()).unwrap_or("");

                                match delta_type {
                                    "text_delta" => {
                                        if let Some(text) =
                                            delta.get("text").and_then(|t| t.as_str())
                                        {
                                            if !text.is_empty() {
                                                let _ = tx.send(StreamEvent::TextDelta {
                                                    content: text.to_string(),
                                                });
                                            }
                                        }
                                    }
                                    "input_json_delta" => {
                                        if let Some(partial) =
                                            delta.get("partial_json").and_then(|p| p.as_str())
                                        {
                                            tool_input_buffer.push_str(partial);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                        "content_block_stop" => {
                            // Emit accumulated tool_use if we were building one
                            if !current_tool_id.is_empty() {
                                let _ = tx.send(StreamEvent::ToolUse {
                                    id: current_tool_id.clone(),
                                    tool_name: current_tool_name.clone(),
                                    input: tool_input_buffer.clone(),
                                });
                                current_tool_id.clear();
                                current_tool_name.clear();
                                tool_input_buffer.clear();
                            }
                        }
                        "message_delta" => {
                            // Usage info at message end
                            let total_tokens = parsed
                                .get("usage")
                                .and_then(|u| u.get("output_tokens"))
                                .and_then(|t| t.as_u64())
                                .map(|t| t as u32);
                            // Don't send Done here — wait for message_stop
                            // But store tokens if available
                            if total_tokens.is_some() {
                                // We'll send Done on message_stop with this info
                                // For simplicity, send it now since message_stop follows immediately
                            }
                        }
                        "message_stop" => {
                            let _ = tx.send(StreamEvent::Done { total_tokens: None });
                            return Ok(());
                        }
                        "error" => {
                            let error_msg = parsed
                                .get("error")
                                .and_then(|e| e.get("message"))
                                .and_then(|m| m.as_str())
                                .unwrap_or("Unknown Anthropic error");
                            let _ = tx.send(StreamEvent::Error {
                                message: error_msg.to_string(),
                            });
                            return Err(error_msg.to_string());
                        }
                        _ => {}
                    }
                }
            }
        }

        // Stream ended without message_stop
        let _ = tx.send(StreamEvent::Done { total_tokens: None });
        Ok(())
    }
}
