export type AgentStatus = "IDLE" | "THINKING" | "EXECUTING" | "WAITING_APPROVAL" | "ERROR";
export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Session {
  id: string;
  title: string;
  workspace: string;
  model: string;
  agent_tag: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  model?: string;
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface ToolCall {
  id: string;
  message_id: string;
  tool_name: string;
  input: string;
  output: string;
  status: "pending" | "success" | "error";
  duration_ms?: number;
}

export interface StreamEvent {
  type: "text_delta" | "tool_use" | "done" | "error";
  content?: string;
  tool_call?: ToolCall;
  error?: string;
}

export interface LlmConfig {
  provider: "openai" | "anthropic" | "openrouter" | "ollama";
  model: string;
  api_key: string;
  base_url?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface DiffData {
  filename: string;
  original: string;
  modified: string;
  language: string;
}
