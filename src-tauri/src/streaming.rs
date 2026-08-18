use crate::providers::{anthropic, openai, LlmProvider};
use crate::types::{ChatMessage, LlmConfig, StreamEvent};
use tauri::{command, AppHandle, Emitter};

#[command]
pub async fn stream_chat(
    app: AppHandle,
    config: LlmConfig,
    messages: Vec<ChatMessage>,
) -> Result<(), String> {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<StreamEvent>();

    // Spawn the provider streaming in background
    let config_clone = config.clone();
    tokio::spawn(async move {
        let result = match config_clone.provider.as_str() {
            "anthropic" => {
                anthropic::AnthropicProvider::stream_chat(&config_clone, messages, tx).await
            }
            _ => openai::OpenAiProvider::stream_chat(&config_clone, messages, tx).await,
        };
        if let Err(e) = result {
            log::error!("Streaming error: {}", e);
        }
    });

    // Forward events to frontend via Tauri events
    while let Some(event) = rx.recv().await {
        if app.emit("chat-stream", &event).is_err() {
            break;
        }
        if matches!(event, StreamEvent::Done { .. } | StreamEvent::Error { .. }) {
            break;
        }
    }

    Ok(())
}
