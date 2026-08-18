import { useState, useEffect, useCallback } from "react";
import { X, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AppSettings, LlmConfig } from "../../types";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const PROVIDERS: { value: LlmConfig["provider"]; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama" },
];

const BASE_URL_PLACEHOLDERS: Record<LlmConfig["provider"], string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434",
};

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
      setShowKey(false);
    }
  }, [isOpen, settings]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleEscape]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      {/* Click-away backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-neutral-200">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Provider */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              Provider
            </span>
            <select
              value={draft.provider}
              onChange={(e) =>
                update("provider", e.target.value as LlmConfig["provider"])
              }
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none transition focus:border-neutral-600"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {/* Model */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              Model
            </span>
            <input
              type="text"
              value={draft.model}
              onChange={(e) => update("model", e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none transition focus:border-neutral-600"
              placeholder="gpt-4o"
            />
          </label>

          {/* API Key */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              API Key
            </span>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={draft.api_key}
                onChange={(e) => update("api_key", e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 pr-10 text-sm text-neutral-200 outline-none transition focus:border-neutral-600"
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 transition hover:text-neutral-300"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          {/* Base URL */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              Base URL
            </span>
            <input
              type="text"
              value={draft.base_url}
              onChange={(e) => update("base_url", e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none transition focus:border-neutral-600"
              placeholder={BASE_URL_PLACEHOLDERS[draft.provider]}
            />
          </label>

          {/* Max Tokens */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              Max Tokens
            </span>
            <input
              type="number"
              value={draft.max_tokens}
              onChange={(e) => update("max_tokens", Number(e.target.value))}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none transition focus:border-neutral-600"
              min={1}
              max={128000}
            />
          </label>

          {/* Temperature */}
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              <span>Temperature</span>
              <span className="tabular-nums text-neutral-300">
                {draft.temperature.toFixed(1)}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={draft.temperature}
              onChange={(e) => update("temperature", Number(e.target.value))}
              className="w-full accent-neutral-500"
            />
          </label>

          {/* Divider */}
          <div className="border-t border-neutral-800" />

          {/* Escape Plan Mode */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="font-mono text-xs font-semibold uppercase tracking-widest text-neutral-200">
                  ESCAPE PLAN MODE
                </span>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Bypass approval prompts for all tool executions in this
                  workspace. Use with caution.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.escape_plan_mode}
                onClick={() =>
                  update("escape_plan_mode", !draft.escape_plan_mode)
                }
                className={cn(
                  "relative ml-4 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  draft.escape_plan_mode ? "bg-red-600" : "bg-neutral-700",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                    draft.escape_plan_mode
                      ? "translate-x-5"
                      : "translate-x-0",
                  )}
                />
              </button>
            </div>
            {draft.escape_plan_mode && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>All safety gates are disabled</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-700 hover:text-neutral-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
