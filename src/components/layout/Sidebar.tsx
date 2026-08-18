import { useState } from "react";
import { Plus, Settings, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Session } from "../../types";

interface SidebarProps {
  sessions: Session[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSettingsClick?: () => void;
  onDeleteSession: (id: string) => void;
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

export default function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onSettingsClick,
  onDeleteSession,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      {/* Search Bar */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-neutral-850">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500 outline-none transition focus:border-neutral-700"
          />
        </div>
      )}

      {/* Session List */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-neutral-500">
              {searchQuery ? "No matching sessions" : "No sessions yet"}
            </p>
          )}
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group relative flex w-full items-center justify-between border-b border-neutral-800/50 text-left transition",
                session.id === activeId
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
              )}
            >
              <button
                onClick={() => onSelect(session.id)}
                className="flex-1 min-w-0 px-3 py-2.5 text-left"
              >
                <div className="truncate text-sm font-medium">{session.title}</div>
                <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                  <span className="rounded bg-neutral-700/50 px-1.5 py-0.5 font-mono">
                    {session.model || "—"}
                  </span>
                  <span>{formatTimestamp(session.updated_at)}</span>
                </div>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Are you sure you want to delete this session?")) {
                    onDeleteSession(session.id);
                  }
                }}
                className="mr-3 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-neutral-500 hover:bg-neutral-700 hover:text-red-400 rounded transition"
                title="Delete session"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom: Settings */}
      <div className="shrink-0 border-t border-neutral-800 p-2">
        <button
          onClick={onSettingsClick}
          className="flex w-full items-center justify-center rounded p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
