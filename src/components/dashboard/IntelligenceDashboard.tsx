import { useState, useEffect, useCallback } from "react";
import { X, Cpu, DollarSign, Activity, CheckCircle2 } from "lucide-react";
import Database from "@tauri-apps/plugin-sql";

interface IntelligenceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  agentTag?: string;
}

interface MetricStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  toolSuccessRate: string;
}

async function getDb(): Promise<Database> {
  return Database.load("sqlite:noir.db");
}

export default function IntelligenceDashboard({
  isOpen,
  onClose,
  sessionId,
  agentTag,
}: IntelligenceDashboardProps) {
  const [stats, setStats] = useState<MetricStats>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    avgLatency: 0,
    toolSuccessRate: "N/A",
  });
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const db = await getDb();

      // Query 1: Get aggregated tokens, cost, and latency
      const metricRows = await db.select<
        Array<{
          prompt_tokens: number | null;
          completion_tokens: number | null;
          total_tokens: number | null;
          total_cost: number | null;
          avg_latency: number | null;
        }>
      >(
        `SELECT 
          SUM(prompt_tokens) as prompt_tokens, 
          SUM(completion_tokens) as completion_tokens, 
          SUM(total_tokens) as total_tokens, 
          SUM(estimated_cost) as total_cost, 
          AVG(latency_ms) as avg_latency 
         FROM metrics 
         WHERE session_id = ?`,
        [sessionId]
      );

      // Query 2: Get tool call status for success rate
      const toolCallRows = await db.select<Array<{ status: string }>>(
        `SELECT tc.status 
         FROM tool_calls tc
         INNER JOIN messages m ON tc.message_id = m.id
         WHERE m.session_id = ?`,
        [sessionId]
      );

      const metrics = metricRows[0];
      const promptTokens = metrics?.prompt_tokens ?? 0;
      const completionTokens = metrics?.completion_tokens ?? 0;
      const totalTokens = metrics?.total_tokens ?? 0;
      const totalCost = metrics?.total_cost ?? 0.0;
      const avgLatency = metrics?.avg_latency ? metrics.avg_latency / 1000 : 0; // convert ms to seconds

      let toolSuccessRate = "N/A";
      if (toolCallRows.length > 0) {
        const successes = toolCallRows.filter((tc) => tc.status === "success").length;
        const rate = Math.round((successes / toolCallRows.length) * 100);
        toolSuccessRate = `${rate}%`;
      }

      setStats({
        promptTokens,
        completionTokens,
        totalTokens,
        totalCost,
        avgLatency,
        toolSuccessRate,
      });
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
    }
  }, [isOpen, fetchMetrics]);

  // Handle escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      {/* Click-away backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-md border border-neutral-800 bg-neutral-950 p-6 shadow-2xl rounded-lg font-mono text-xs text-neutral-400 select-none">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded p-1 text-neutral-500 transition hover:bg-neutral-900 hover:text-neutral-200"
          aria-label="Close dashboard"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-1">
            INTELLIGENCE SCORE
          </div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-100 uppercase flex items-center gap-2">
            <span>{agentTag || "AGENT SESSION"}</span>
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Card: Tokens */}
          <div className="border border-neutral-900 bg-neutral-900/40 p-4 rounded flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-500 font-semibold mb-3 uppercase tracking-wider text-[10px]">
              <Cpu size={12} className="text-neutral-400" />
              <span>Tokens Used</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span>INPUT</span>
                <span className="text-neutral-200 tabular-nums">
                  {stats.promptTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>OUTPUT</span>
                <span className="text-neutral-200 tabular-nums">
                  {stats.completionTokens.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-neutral-800/80 pt-1 flex justify-between text-xs font-bold text-neutral-200">
                <span>TOTAL</span>
                <span className="tabular-nums">
                  {stats.totalTokens.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Estimated Cost */}
          <div className="border border-neutral-900 bg-neutral-900/40 p-4 rounded flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-500 font-semibold mb-3 uppercase tracking-wider text-[10px]">
              <DollarSign size={12} className="text-neutral-400" />
              <span>Estimated Cost</span>
            </div>
            <div className="flex flex-col justify-end h-full">
              <span className="text-2xl font-bold text-emerald-400 tracking-tight tabular-nums">
                ${stats.totalCost.toFixed(4)}
              </span>
              <span className="text-[9px] text-neutral-600 mt-1 uppercase">
                USD rate based
              </span>
            </div>
          </div>

          {/* Card: Latency Profile */}
          <div className="border border-neutral-900 bg-neutral-900/40 p-4 rounded flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-500 font-semibold mb-3 uppercase tracking-wider text-[10px]">
              <Activity size={12} className="text-neutral-400" />
              <span>Avg Latency</span>
            </div>
            <div className="flex flex-col justify-end h-full">
              <span className="text-2xl font-bold text-amber-500 tracking-tight tabular-nums">
                {stats.avgLatency > 0 ? `${stats.avgLatency.toFixed(2)}s` : "0.00s"}
              </span>
              <span className="text-[9px] text-neutral-600 mt-1 uppercase">
                Per interaction turn
              </span>
            </div>
          </div>

          {/* Card: Tool Call Success Rate */}
          <div className="border border-neutral-900 bg-neutral-900/40 p-4 rounded flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-neutral-500 font-semibold mb-3 uppercase tracking-wider text-[10px]">
              <CheckCircle2 size={12} className="text-neutral-400" />
              <span>Tool Success</span>
            </div>
            <div className="flex flex-col justify-end h-full">
              <span className="text-2xl font-bold text-blue-400 tracking-tight tabular-nums">
                {stats.toolSuccessRate}
              </span>
              <span className="text-[9px] text-neutral-600 mt-1 uppercase">
                Resolved vs errors
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-neutral-900 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded font-mono transition text-xs font-semibold uppercase tracking-wider"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}