import { useState } from "react";
import { Plus, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Session } from "../../types";

interface SidebarProps {
  sessions: Session[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export default function Sidebar({ sessions, activeId, onSelect, onNew }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-neutral-800 bg-neutral-900 transition-all duration-200",
        collapsed ? "w-12" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Sessions
          </span>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && (
            <button
              onClick={onNew}
              className="rounded p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
              title="New session"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* Session List */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-neutral-500">No sessions yet</p>
          )}
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-neutral-800/50 px-3 py-2.5 text-left transition",
                session.id === activeId
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
              )}
            >
              <span className="truncate text-sm">{session.title}</span>
              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                <span className="rounded bg-neutral-700/50 px-1.5 py-0.5 font-mono">
                  {session.model || "—"}
                </span>
                <span>{formatTimestamp(session.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom: Settings */}
      <div className="shrink-0 border-t border-neutral-800 p-2">
        <button
          className="flex w-full items-center justify-center rounded p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
