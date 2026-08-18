import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";
import type { Message } from "../../types";
import ToolCallAccordion from "./ToolCallAccordion";

interface MessageBubbleProps {
  message: Message;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { role, content, tool_calls, created_at } = message;

  // ── System messages ──
  if (role === "system") {
    return (
      <div className="flex justify-center px-4 py-2">
        <p className="text-xs text-neutral-500 italic max-w-lg text-center">{content}</p>
      </div>
    );
  }

  // ── Tool messages → render accordion for each tool call ──
  if (role === "tool" && tool_calls && tool_calls.length > 0) {
    return (
      <div className="flex flex-col gap-2 px-4 py-2 max-w-2xl">
        {tool_calls.map((tc) => (
          <ToolCallAccordion key={tc.id} toolCall={tc} />
        ))}
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div className={cn("flex px-4 py-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-2xl rounded-lg px-4 py-3",
          isUser ? "bg-neutral-800 text-neutral-100" : "bg-neutral-900 text-neutral-200",
        )}
      >
        {/* Role label + time */}
        <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
          <span className="font-semibold">{isUser ? "You" : "Assistant"}</span>
          <span>{formatTime(created_at)}</span>
        </div>

        {/* Content */}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_pre]:bg-neutral-950 [&_pre]:rounded [&_pre]:p-3 [&_pre]:text-xs [&_code]:text-emerald-400 [&_code]:bg-neutral-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre_code]:bg-transparent [&_pre_code]:p-0">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        )}

        {/* Inline tool calls on assistant messages */}
        {role === "assistant" && tool_calls && tool_calls.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {tool_calls.map((tc) => (
              <ToolCallAccordion key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
