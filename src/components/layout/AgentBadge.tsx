import { cn } from "../../lib/utils";
import type { AgentStatus } from "../../types";

interface AgentBadgeProps {
  tag: string;
  status: AgentStatus;
}

const STATUS_DOT: Record<AgentStatus, string> = {
  IDLE: "bg-emerald-500",
  THINKING: "bg-amber-500",
  EXECUTING: "bg-blue-500",
  WAITING_APPROVAL: "bg-orange-500",
  ERROR: "bg-red-500",
};

export default function AgentBadge({ tag, status }: AgentBadgeProps) {
  const name = tag.split("-")[0] ?? tag;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded bg-neutral-800/60 px-2 py-0.5"
      title={`Agent: ${name}`}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          STATUS_DOT[status],
        )}
      />
      <span className="font-mono text-[11px] tracking-wider text-neutral-400">
        {tag}
      </span>
    </span>
  );
}
