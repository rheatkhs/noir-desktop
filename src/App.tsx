import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function App() {
  const [workingDir, setWorkingDir] = useState<string>("—");

  async function loadWorkingDir() {
    const dir = await invoke<string>("get_working_dir");
    setWorkingDir(dir);
  }

  return (
    <div className="flex h-screen flex-col">
      {/* HUD Bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 text-xs font-mono tracking-wide text-neutral-400">
        <span className="uppercase text-neutral-100 font-semibold tracking-widest">
          Noir Desktop
        </span>
        <div className="flex items-center gap-4">
          <span>dir: {workingDir}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            IDLE
          </span>
        </div>
      </header>

      {/* Main area */}
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
            Grace Field House
          </h1>
          <p className="text-sm text-neutral-500">
            Standalone AI Agent Workbench
          </p>
          <button
            onClick={loadWorkingDir}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700"
          >
            Test IPC
          </button>
        </div>
      </main>
    </div>
  );
}
