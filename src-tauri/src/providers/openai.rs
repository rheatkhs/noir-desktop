use crate::providers::{LlmProvider, StreamSender};
use crate::types::{ChatMessage, LlmConfig, StreamEvent};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};

pub struct OpenAiProvider;

impl OpenAiProvider {
    fn resolve_base_url(config: &LlmConfig) -> String {
        if let Some(url) = &config.base_url {
            return url.trim_end_matches('/').to_string();
        }
        match config.provider.as_str() {
            "openrouter" => "https://openrouter.ai/api/v1".to_string(),
            "ollama" => "http://localhost:11434/v1".to_string(),
            _ => "https://api.openai.com/v1".to_string(),
        }
    }
}

impl LlmProvider for OpenAiProvider {
    async fn stream_chat(
        config: &LlmConfig,
        messages: Vec<ChatMessage>,
        tx: StreamSender,
    ) -> Result<(), String> {
        let base_url = Self::resolve_base_url(config);
        let url = format!("{}/chat/completions", base_url);

        let msgs: Vec<Value> = messages
            .iter()
            .map(|m| {
                json!({
                    "role": m.role,
                    "content": m.content,
                })
            })
            .collect();

        let body = json!({
            "model": config.model,
            "messages": msgs,
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
            "stream": true,
        });

        let client = Client::new();
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", config.api_key))
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

            // Process complete SSE lines
            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() || line.starts_with(':') {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    let data = data.trim();

                    if data == "[DONE]" {
                        let _ = tx.send(StreamEvent::Done { total_tokens: None });
                        return Ok(());
                    }

                    match serde_json::from_str::<Value>(data) {
                        Ok(parsed) => {
                            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array())
                            {
                                if let Some(choice) = choices.first() {
                                    // Text delta
                                    if let Some(content) = choice
                                        .get("delta")
                                        .and_then(|d| d.get("content"))
                                        .and_then(|c| c.as_str())
                                    {
                                        if !content.is_empty() {
                                            let _ = tx.send(StreamEvent::TextDelta {
                                                content: content.to_string(),
                                            });
                                        }
                                    }

                                    // Tool calls
                                    if let Some(tool_calls) = choice
                                        .get("delta")
                                        .and_then(|d| d.get("tool_calls"))
                                        .and_then(|t| t.as_array())
                                    {
                                        for tc in tool_calls {
                                            if let (Some(id), Some(function)) = (
                                                tc.get("id").and_then(|i| i.as_str()),
                                                tc.get("function"),
                                            ) {
                                                let tool_name = function
                                                    .get("name")
                                                    .and_then(|n| n.as_str())
                                                    .unwrap_or("")
                                                    .to_string();
                                                let input = function
                                                    .get("arguments")
                                                    .and_then(|a| a.as_str())
                                                    .unwrap_or("")
                                                    .to_string();

                                                if !tool_name.is_empty() {
                                                    let _ = tx.send(StreamEvent::ToolUse {
                                                        id: id.to_string(),
                                                        tool_name,
                                                        input,
                                                    });
                                                }
                                            }
                                        }
                                    }

                                    // Check for finish_reason
                                    if let Some(reason) = choice
                                        .get("finish_reason")
                                        .and_then(|f| f.as_str())
                                    {
                                        if reason == "stop" || reason == "tool_calls" {
                                            // Usage info if available
                                            let total_tokens = parsed
                                                .get("usage")
                                                .and_then(|u| u.get("total_tokens"))
                                                .and_then(|t| t.as_u64())
                                                .map(|t| t as u32);
                                            let _ = tx
                                                .send(StreamEvent::Done { total_tokens });
                                            return Ok(());
                                        }
                                    }
                                }
                            }
                        }
                        Err(_) => {
                            // Skip unparseable lines (partial JSON, etc.)
                        }
                    }
                }
            }
        }

        // Stream ended without [DONE] — still send Done
        let _ = tx.send(StreamEvent::Done { total_tokens: None });
        Ok(())
    }
}
