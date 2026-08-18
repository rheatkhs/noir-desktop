use crate::classifier::{classify_action, ActionClass};
use crate::commands;
use crate::providers::{anthropic, openai, LlmProvider};
use crate::types::{ChatMessage, LlmConfig, StreamEvent};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, Listener};
use tokio::sync::mpsc;
use tokio::sync::Mutex;

// ─── Event Payloads ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub id: String,
    pub tool_name: String,
    pub command: String,
    pub classification: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalResponse {
    pub id: String,
    pub approved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatusEvent {
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResultEvent {
    pub id: String,
    pub tool_name: String,
    pub output: String,
    pub status: String,
    pub duration_ms: u64,
}

// ─── Internal Types ─────────────────────────────────────────────

#[derive(Debug, Clone)]
struct ToolUseEvent {
    id: String,
    tool_name: String,
    input: String,
}

// ─── Constants ──────────────────────────────────────────────────

const MAX_ITERATIONS: usize = 10;

const SYSTEM_PROMPT_PREFIX: &str = "You are Noir, an AI coding agent. \
You operate within workspace: ";

const SYSTEM_PROMPT_SUFFIX: &str = ". You have tools: \
read_file, write_file, list_directory, execute_bash. \
Use them to help the user.";

// ─── Helpers ────────────────────────────────────────────────────

fn gen_id() -> String {
    format!(
        "{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    )
}

fn emit_status(app: &AppHandle, status: &str) {
    let _ = app.emit(
        "agent-status",
        AgentStatusEvent {
            status: status.to_string(),
        },
    );
}

// ─── LLM Call ───────────────────────────────────────────────────

/// Calls the LLM via the provider streaming infrastructure.
/// Collects all events, forwarding text deltas to the frontend in real-time.
/// Returns the accumulated full text and any tool-call requests.
async fn call_llm(
    config: &LlmConfig,
    messages: Vec<ChatMessage>,
    app: &AppHandle,
) -> Result<(String, Vec<ToolUseEvent>), String> {
    let (tx, mut rx) = mpsc::unbounded_channel::<StreamEvent>();
    let config_clone = config.clone();
    let msgs = messages.clone();

    tokio::spawn(async move {
        let result = match config_clone.provider.as_str() {
            "anthropic" => {
                anthropic::AnthropicProvider::stream_chat(&config_clone, msgs, tx).await
            }
            _ => openai::OpenAiProvider::stream_chat(&config_clone, msgs, tx).await,
        };
        if let Err(e) = result {
            log::error!("LLM call error: {}", e);
        }
    });

    let mut text = String::new();
    let mut tool_calls = Vec::new();

    while let Some(event) = rx.recv().await {
        match &event {
            StreamEvent::TextDelta { content } => {
                text.push_str(content);
                let _ = app.emit("chat-stream", &event);
            }
            StreamEvent::ToolUse {
                id,
                tool_name,
                input,
            } => {
                tool_calls.push(ToolUseEvent {
                    id: id.clone(),
                    tool_name: tool_name.clone(),
                    input: input.clone(),
                });
                let _ = app.emit("chat-stream", &event);
            }
            StreamEvent::Done { .. } => break,
            StreamEvent::Error { message } => return Err(message.clone()),
        }
    }

    Ok((text, tool_calls))
}

// ─── Approval Gate ──────────────────────────────────────────────

/// Emits an approval request to the frontend and blocks until the user responds.
/// Uses a oneshot channel bridged from a Tauri event listener.
async fn wait_for_approval(app: &AppHandle, request: &ApprovalRequest) -> Result<bool, String> {
    let (otx, orx) = tokio::sync::oneshot::channel::<bool>();
    let otx = Arc::new(Mutex::new(Some(otx)));
    let req_id = request.id.clone();

    let otx_clone = otx.clone();
    let listener_id = app.listen("approval-response", move |event| {
        if let Ok(response) = serde_json::from_str::<ApprovalResponse>(event.payload()) {
            if response.id == req_id {
                // Take the sender out so we only send once
                if let Some(sender) = otx_clone.blocking_lock().take() {
                    let _ = sender.send(response.approved);
                }
            }
        }
    });

    // Now emit the request to the frontend
    app.emit("approval-request", request)
        .map_err(|e| e.to_string())?;

    // Wait for the frontend to respond
    let result = orx
        .await
        .map_err(|_| "Approval channel closed without response".to_string())?;

    app.unlisten(listener_id);
    Ok(result)
}

// ─── Tool Execution ─────────────────────────────────────────────

/// Executes a tool by name, dispatching to the appropriate commands module function.
async fn execute_tool(tool_name: &str, input: &str, workspace: &str) -> Result<String, String> {
    let params: serde_json::Value =
        serde_json::from_str(input).map_err(|e| format!("Invalid tool input JSON: {e}"))?;

    match tool_name {
        "execute_bash" => {
            let cmd = params["command"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let cwd = params["cwd"]
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_else(|| workspace.to_string());
            let result = commands::execute_bash(cmd, Some(cwd)).await?;
            Ok(format!(
                "stdout:\n{}\nstderr:\n{}\nexit_code: {:?}",
                result.stdout, result.stderr, result.exit_code
            ))
        }
        "read_file" => {
            let path = params["path"].as_str().unwrap_or_default().to_string();
            commands::read_file(path).await
        }
        "write_file" => {
            let path = params["path"].as_str().unwrap_or_default().to_string();
            let contents = params["contents"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            commands::write_file(path, contents).await?;
            Ok("File written successfully".to_string())
        }
        "list_directory" => {
            let path = params["path"]
                .as_str()
                .unwrap_or(workspace)
                .to_string();
            let entries = commands::list_directory(path).await?;
            Ok(serde_json::to_string_pretty(&entries).unwrap_or_default())
        }
        _ => Err(format!("Unknown tool: {tool_name}")),
    }
}

/// Build a human-readable description of what a tool call does.
fn describe_tool_call(tool_name: &str, input: &str) -> String {
    let params: serde_json::Value = serde_json::from_str(input).unwrap_or_default();
    match tool_name {
        "execute_bash" => {
            let cmd = params["command"].as_str().unwrap_or("<unknown>");
            format!("Execute shell command: {cmd}")
        }
        "write_file" => {
            let path = params["path"].as_str().unwrap_or("<unknown>");
            format!("Write to file: {path}")
        }
        "read_file" => {
            let path = params["path"].as_str().unwrap_or("<unknown>");
            format!("Read file: {path}")
        }
        "list_directory" => {
            let path = params["path"].as_str().unwrap_or(".");
            format!("List directory: {path}")
        }
        _ => format!("Unknown tool: {tool_name}"),
    }
}

// ─── Main Orchestrator ──────────────────────────────────────────

#[command]
pub async fn run_agent(
    app: AppHandle,
    config: LlmConfig,
    user_message: String,
    workspace: String,
    escape_plan: bool,
) -> Result<(), String> {
    // Build conversation with system prompt
    let mut conversation: Vec<ChatMessage> = vec![
        ChatMessage {
            role: "system".to_string(),
            content: format!("{}{}{}", SYSTEM_PROMPT_PREFIX, workspace, SYSTEM_PROMPT_SUFFIX),
        },
        ChatMessage {
            role: "user".to_string(),
            content: user_message,
        },
    ];

    for iteration in 0..MAX_ITERATIONS {
        // ── 1. Thinking ─────────────────────────────────────────
        emit_status(&app, "thinking");

        // ── 2. Call LLM ─────────────────────────────────────────
        let (text, tool_calls) = match call_llm(&config, conversation.clone(), &app).await {
            Ok(result) => result,
            Err(e) => {
                let _ = app.emit(
                    "chat-stream",
                    StreamEvent::Error {
                        message: e.clone(),
                    },
                );
                emit_status(&app, "error");
                return Err(e);
            }
        };

        // ── 3. Text-only response → done ────────────────────────
        if tool_calls.is_empty() {
            // Add the assistant's text to conversation
            if !text.is_empty() {
                conversation.push(ChatMessage {
                    role: "assistant".to_string(),
                    content: text,
                });
            }

            let _ = app.emit("chat-stream", StreamEvent::Done { total_tokens: None });
            emit_status(&app, "idle");
            return Ok(());
        }

        // ── 4. Has tool calls → process each ────────────────────
        // Add assistant message with text (if any) to conversation
        if !text.is_empty() {
            conversation.push(ChatMessage {
                role: "assistant".to_string(),
                content: text,
            });
        }

        for tool_call in &tool_calls {
            let classification = classify_action(&tool_call.tool_name, &tool_call.input);

            // ── 4a. Gate: require approval for destructive actions ──
            let should_execute = match &classification {
                ActionClass::Destructive if !escape_plan => {
                    let request = ApprovalRequest {
                        id: gen_id(),
                        tool_name: tool_call.tool_name.clone(),
                        command: tool_call.input.clone(),
                        classification: classification.as_str().to_string(),
                        description: describe_tool_call(
                            &tool_call.tool_name,
                            &tool_call.input,
                        ),
                    };

                    emit_status(&app, "awaiting_approval");

                    match wait_for_approval(&app, &request).await {
                        Ok(approved) => approved,
                        Err(e) => {
                            log::error!("Approval flow error: {e}");
                            false
                        }
                    }
                }
                // Safe, Unknown (when escape_plan is off), or anything with escape_plan on
                _ => true,
            };

            if !should_execute {
                // User rejected — feed rejection back to LLM
                conversation.push(ChatMessage {
                    role: "tool".to_string(),
                    content: format!(
                        "[tool_call_id: {}] Action rejected by user. The tool {} was not executed. \
                         Try a different approach or ask the user for guidance.",
                        tool_call.id, tool_call.tool_name
                    ),
                });
                continue;
            }

            // ── 4b. Execute the tool ────────────────────────────────
            emit_status(&app, "executing");
            let started = std::time::Instant::now();

            let result = execute_tool(&tool_call.tool_name, &tool_call.input, &workspace).await;
            let duration_ms = started.elapsed().as_millis() as u64;

            let (output, status) = match result {
                Ok(out) => (out, "success"),
                Err(err) => (err, "error"),
            };

            // ── 4c. Emit tool-result event ──────────────────────────
            let _ = app.emit(
                "tool-result",
                ToolResultEvent {
                    id: tool_call.id.clone(),
                    tool_name: tool_call.tool_name.clone(),
                    output: output.clone(),
                    status: status.to_string(),
                    duration_ms,
                },
            );

            // ── 4d. Feed result back to LLM ────────────────────────
            conversation.push(ChatMessage {
                role: "tool".to_string(),
                content: format!(
                    "[tool_call_id: {}] {}: {}",
                    tool_call.id, status, output
                ),
            });
        }

        // Log iteration count for debugging
        log::info!(
            "Agent loop iteration {} completed, {} tool calls processed",
            iteration + 1,
            tool_calls.len()
        );
    }

    // Exceeded max iterations
    let _ = app.emit(
        "chat-stream",
        StreamEvent::Error {
            message: format!(
                "Agent loop exceeded maximum of {} iterations. Stopping to prevent runaway execution.",
                MAX_ITERATIONS
            ),
        },
    );
    emit_status(&app, "error");
    Err(format!(
        "Agent exceeded maximum iterations ({})",
        MAX_ITERATIONS
    ))
}
