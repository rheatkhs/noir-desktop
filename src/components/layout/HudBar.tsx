import { cn } from "../../lib/utils";
import type { AgentStatus } from "../../types";

interface HudBarProps {
  model: string;
  workingDir: string;
  status: AgentStatus;
  tokenCount?: number;
  agentTag?: string;
  onHudClick?: () => void;
  onDirClick?: () => void;
}

const STATUS_CONFIG: Record<AgentStatus, { color: string; pulse: boolean; label: string }> = {
  IDLE:              { color: "bg-emerald-500", pulse: false, label: "IDLE" },
  THINKING:          { color: "bg-amber-500",   pulse: true,  label: "THINKING" },
  EXECUTING:         { color: "bg-blue-500",    pulse: true,  label: "EXECUTING" },
  WAITING_APPROVAL:  { color: "bg-orange-500",  pulse: false, label: "APPROVAL" },
  ERROR:             { color: "bg-red-500",     pulse: false, label: "ERROR" },
};

function truncateDir(dir: string, maxLen = 32): string {
  if (dir.length <= maxLen) return dir;
  return "…" + dir.slice(dir.length - maxLen + 1);
}

export default function HudBar({
  model,
  workingDir,
  status,
  tokenCount,
  agentTag,
  onHudClick,
  onDirClick,
}: HudBarProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 text-xs font-mono tracking-wide text-neutral-400">
      <span
        onClick={onHudClick}
        className={cn(
          "uppercase font-semibold tracking-widest select-none",
          onHudClick ? "text-neutral-100 cursor-pointer hover:text-neutral-200" : "text-neutral-100"
        )}
      >
        NOIR DESKTOP
      </span>

      <div className="flex items-center gap-5">
        {agentTag && (
          <span className="rounded bg-neutral-800/60 px-2 py-0.5 font-mono text-[11px] tracking-wider text-neutral-400">
            {agentTag}
          </span>
        )}
        {tokenCount !== undefined && (
          <span
            onClick={onHudClick}
            className={cn(
              "tabular-nums",
              onHudClick ? "text-neutral-500 cursor-pointer hover:text-neutral-300" : "text-neutral-500"
            )}
          >
            {tokenCount.toLocaleString()} tok
          </span>
        )}

        <span className="text-neutral-300">{model}</span>

        <span
          onClick={onDirClick}
          className={cn(
            onDirClick
              ? "text-neutral-500 cursor-pointer hover:text-neutral-200 transition-colors"
              : "text-neutral-500"
          )}
          title={workingDir}
        >
          {truncateDir(workingDir)}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              cfg.color,
              cfg.pulse && "animate-pulse",
            )}
          />
          <span className="text-neutral-300">{cfg.label}</span>
        </span>
      </div>
    </header>
  );
}
