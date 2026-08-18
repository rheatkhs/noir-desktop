import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Message, StreamEvent, AgentStatus, ToolCall } from "../types";

interface UseChatReturn {
  messages: Message[];
  sendMessage: (content: string) => void;
  isStreaming: boolean;
  streamingContent: string;
  agentStatus: AgentStatus;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function useChat(sessionId: string | undefined): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("IDLE");

  const streamingContentRef = useRef("");
  const pendingToolCallsRef = useRef<ToolCall[]>([]);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Clean up event listener on unmount or session change
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || isStreaming) return;

      // Add user message
      const userMessage: Message = {
        id: generateId(),
        session_id: sessionId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Reset streaming state
      setIsStreaming(true);
      setStreamingContent("");
      setAgentStatus("THINKING");
      streamingContentRef.current = "";
      pendingToolCallsRef.current = [];

      // Listen for streaming events from Rust backend
      if (unlistenRef.current) {
        unlistenRef.current();
      }

      unlistenRef.current = await listen<StreamEvent>("chat-stream", (event) => {
        const data = event.payload;

        switch (data.type) {
          case "text_delta": {
            if (data.content) {
              streamingContentRef.current += data.content;
              setStreamingContent(streamingContentRef.current);
              setAgentStatus("THINKING");
            }
            break;
          }

          case "tool_use": {
            if (data.tool_call) {
              pendingToolCallsRef.current = [...pendingToolCallsRef.current, data.tool_call];
              setAgentStatus("EXECUTING");
            }
            break;
          }

          case "done": {
            // Finalize assistant message
            const assistantMessage: Message = {
              id: generateId(),
              session_id: sessionId,
              role: "assistant",
              content: streamingContentRef.current,
              tool_calls:
                pendingToolCallsRef.current.length > 0
                  ? pendingToolCallsRef.current
                  : undefined,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setIsStreaming(false);
            setStreamingContent("");
            setAgentStatus("IDLE");
            streamingContentRef.current = "";
            pendingToolCallsRef.current = [];

            if (unlistenRef.current) {
              unlistenRef.current();
              unlistenRef.current = null;
            }
            break;
          }

          case "error": {
            setAgentStatus("ERROR");
            setIsStreaming(false);

            // Add error as system message
            const errorMessage: Message = {
              id: generateId(),
              session_id: sessionId,
              role: "system",
              content: data.error ?? "An unknown error occurred.",
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            setStreamingContent("");
            streamingContentRef.current = "";
            pendingToolCallsRef.current = [];

            if (unlistenRef.current) {
              unlistenRef.current();
              unlistenRef.current = null;
            }
            break;
          }
        }
      });

      // Invoke the Rust streaming command
      try {
        await invoke("stream_chat", {
          sessionId,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });
      } catch (err) {
        setAgentStatus("ERROR");
        setIsStreaming(false);
        setStreamingContent("");

        const errorMessage: Message = {
          id: generateId(),
          session_id: sessionId,
          role: "system",
          content: String(err),
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [sessionId, isStreaming, messages],
  );

  return { messages, sendMessage, isStreaming, streamingContent, agentStatus };
}
