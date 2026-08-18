import { DiffEditor } from "@monaco-editor/react";
import { Check, X, FileCode } from "lucide-react";
import type { DiffData } from "../../types";

interface DiffViewerProps {
  diff: DiffData;
  onAccept: () => void;
  onReject: () => void;
}

export default function DiffViewer({ diff, onAccept, onReject }: DiffViewerProps) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Filename header */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2 text-xs font-mono text-neutral-300">
        <FileCode size={14} className="text-neutral-500" />
        <span>{diff.filename}</span>
      </div>

      {/* Monaco Diff Editor */}
      <div className="flex-1 min-h-[300px]">
        <DiffEditor
          original={diff.original}
          modified={diff.modified}
          language={diff.language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            lineNumbers: "on",
            folding: true,
            wordWrap: "off",
            automaticLayout: true,
          }}
        />
      </div>

      {/* Accept / Reject buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-3 py-2">
        <button
          onClick={onReject}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-red-400"
        >
          <X size={14} />
          Reject
        </button>
        <button
          onClick={onAccept}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
        >
          <Check size={14} />
          Accept
        </button>
      </div>
    </div>
  );
}
