pub mod anthropic;
pub mod openai;

use std::future::Future;

use crate::types::{ChatMessage, LlmConfig, StreamEvent};
use tokio::sync::mpsc;

pub type StreamSender = mpsc::UnboundedSender<StreamEvent>;

/// Trait for LLM streaming providers
pub trait LlmProvider {
    fn stream_chat(
        config: &LlmConfig,
        messages: Vec<ChatMessage>,
        tx: StreamSender,
    ) -> impl Future<Output = Result<(), String>> + Send;
}
