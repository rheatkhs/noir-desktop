import { useEffect, useRef } from "react";
import { ShieldAlert, AlertTriangle, Terminal } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ApprovalRequest } from "../../types";

interface MamasGateProps {
  request: ApprovalRequest;
  onRespond: (approved: boolean) => void;
}

export default function MamasGate({ request, onRespond }: MamasGateProps) {
  const rejectRef = useRef<HTMLButtonElement>(null);
  const isDestructive = request.classification === "destructive";

  useEffect(() => {
    rejectRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onRespond(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onRespond]);

  const accentColor = isDestructive ? "red" : "amber";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-3 border-b border-neutral-800 px-5 py-4",
          )}
        >
          {isDestructive ? (
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          )}
          <h2
            className={cn(
              "font-mono text-sm font-semibold uppercase tracking-widest",
              isDestructive ? "text-red-500" : "text-amber-500",
            )}
          >
            MAMA&apos;S GATE
          </h2>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Tool name */}
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <Terminal className="h-4 w-4 shrink-0 text-neutral-500" />
            <span className="font-mono">{request.tool_name}</span>
          </div>

          {/* Command block */}
          <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
            <code className="block break-all font-mono text-xs text-neutral-200">
              {request.command}
            </code>
          </div>

          {/* Classification badge */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
                isDestructive
                  ? "bg-red-500/15 text-red-400"
                  : "bg-amber-500/15 text-amber-400",
              )}
            >
              {request.classification}
            </span>
          </div>

          {/* Description */}
          {request.description && (
            <p className="text-sm leading-relaxed text-neutral-400">
              {request.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 px-5 py-4">
          <button
            ref={rejectRef}
            onClick={() => onRespond(false)}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-700 hover:text-neutral-100"
          >
            Reject
          </button>
          <button
            onClick={() => onRespond(true)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium text-white transition",
              isDestructive
                ? "bg-red-600 hover:bg-red-500"
                : "bg-amber-600 hover:bg-amber-500",
            )}
          >
            Approve Execution
          </button>
        </div>
      </div>
    </div>
  );
}
