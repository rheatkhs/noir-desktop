import { useState } from "react";
import { ChevronRight, Terminal, Clock } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ToolCall } from "../../types";

interface ToolCallAccordionProps {
  toolCall: ToolCall;
}

const STATUS_STYLES: Record<ToolCall["status"], string> = {
  pending: "bg-amber-500/15 text-amber-400",
  success: "bg-emerald-500/15 text-emerald-400",
  error:   "bg-red-500/15 text-red-400",
};

function tryFormatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function ToolCallAccordion({ toolCall }: ToolCallAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/60">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-neutral-800/50"
      >
        <ChevronRight
          size={12}
          className={cn(
            "shrink-0 text-neutral-500 transition-transform duration-150",
            expanded && "rotate-90",
          )}
        />
        <Terminal size={12} className="shrink-0 text-neutral-500" />
        <span className="font-mono text-neutral-200">{toolCall.tool_name}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_STYLES[toolCall.status])}>
          {toolCall.status}
        </span>
        {toolCall.duration_ms !== undefined && (
          <span className="ml-auto inline-flex items-center gap-1 text-neutral-500">
            <Clock size={10} />
            {toolCall.duration_ms}ms
          </span>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-neutral-800 px-3 py-2 space-y-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Input</p>
            <pre className="max-h-48 overflow-auto rounded bg-neutral-950 p-2 text-[11px] font-mono text-neutral-300 leading-relaxed">
              {tryFormatJson(toolCall.input)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Output</p>
              <pre className="max-h-64 overflow-auto rounded bg-neutral-950 p-2 text-[11px] font-mono text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
