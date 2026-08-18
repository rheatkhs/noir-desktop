import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { SendHorizontal, Download } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Message } from "../../types";
import MessageBubble from "../chat/MessageBubble";

interface ChatPanelProps {
  messages: Message[];
  onSend: (content: string) => void;
  isStreaming: boolean;
  streamingContent?: string;
  onExportSession?: () => void;
  sessionTitle?: string;
}

export default function ChatPanel({
  messages,
  onSend,
  isStreaming,
  streamingContent,
  onExportSession,
  sessionTitle,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, [input]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-950">
      {/* Chat Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900/20 px-4">
        <span className="font-mono text-xs text-neutral-400 font-medium uppercase tracking-wider">
          {sessionTitle || "Conversation"}
        </span>
        {onExportSession && messages.length > 0 && (
          <button
            onClick={onExportSession}
            className="flex items-center gap-1.5 rounded bg-neutral-900/60 hover:bg-neutral-800 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-300 transition border border-neutral-800/80 hover:border-neutral-700 hover:text-neutral-100"
            title="Export session to Markdown"
          >
            <Download size={11} />
            <span>Export MD</span>
          </button>
        )}
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-sm text-neutral-500">No messages yet.</p>
              <p className="text-xs text-neutral-600">Start a conversation below.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming preview */}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: "__streaming__",
              session_id: "",
              role: "assistant",
              content: streamingContent,
              created_at: new Date().toISOString(),
            }}
          />
        )}

        {/* Streaming indicator without content */}
        {isStreaming && !streamingContent && (
          <div className="flex px-4 py-2">
            <div className="rounded-lg bg-neutral-900 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-pulse [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-900 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message…"
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2",
              "text-sm text-neutral-100 placeholder-neutral-500",
              "outline-none transition focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600",
            )}
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className={cn(
              "rounded-lg p-2.5 transition",
              isStreaming || !input.trim()
                ? "text-neutral-600 cursor-not-allowed"
                : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100",
            )}
            title="Send message"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-neutral-600">
          Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
