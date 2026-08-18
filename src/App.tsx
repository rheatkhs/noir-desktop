import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import Database from "@tauri-apps/plugin-sql";
import AppLayout from "./components/layout/AppLayout";
import MamasGate from "./components/approval/MamasGate";
import SettingsPanel from "./components/settings/SettingsPanel";
import IntelligenceDashboard from "./components/dashboard/IntelligenceDashboard";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";
import { useSettings } from "./hooks/useSettings";
import { useApproval } from "./hooks/useApproval";
import type { Message, ToolCall } from "./types";

function exportToMarkdown(
  sessionTitle: string,
  model: string,
  agentTag: string,
  workspace: string,
  messages: Message[]
): string {
  let md = `# Conversation: ${sessionTitle}\n\n`;
  md += `- **Model**: ${model || "Default"}\n`;
  md += `- **Agent Tag**: ${agentTag || "N/A"}\n`;
  md += `- **Workspace**: \`${workspace}\`\n\n`;
  md += `---\n\n`;

  for (const msg of messages) {
    if (msg.role === "user") {
      md += `### 👤 User:\n\n${msg.content}\n\n`;
    } else if (msg.role === "assistant") {
      md += `### 🤖 Assistant (Noir):\n\n${msg.content || "(No message content)"}\n\n`;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        md += `#### 🛠️ Tool Execution Details:\n\n`;
        for (const tc of msg.tool_calls) {
          md += `- **Tool**: \`${tc.tool_name}\`\n`;
          md += `  - **Status**: \`${tc.status}\`\n`;
          if (tc.duration_ms !== undefined) {
            md += `  - **Duration**: \`${tc.duration_ms}ms\`\n`;
          }
          md += `  - **Input**:\n    \`\`\`json\n    ${tc.input}\n    \`\`\`\n`;
          if (tc.output) {
            md += `  - **Output**:\n    \`\`\`\n    ${tc.output}\n    \`\`\`\n`;
          }
          md += `\n`;
        }
      }
    } else if (msg.role === "system") {
      md += `### ⚙️ System:\n\n${msg.content}\n\n`;
    }
    md += `---\n\n`;
  }
  return md;
}

export default function App() {
  const [workingDir, setWorkingDir] = useState("—");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [tokenCount, setTokenCount] = useState<number>(0);

  const {
    sessions,
    activeSession,
    selectSession,
    createSession,
    deleteSession,
    updateSessionWorkspace,
  } = useSessions();

  const {
    messages,
    sendMessage,
    isStreaming,
    streamingContent,
    agentStatus,
  } = useChat(activeSession?.id);

  const { settings, saveSettings, isLoading } = useSettings();
  const { pendingApproval, respond } = useApproval();

  // Load token count for the active session
  const loadTokenCount = useCallback(async () => {
    if (!activeSession?.id) {
      setTokenCount(0);
      return;
    }
    try {
      const db = await Database.load("sqlite:noir.db");
      const rows = await db.select<Array<{ total: number | null }>>(
        "SELECT SUM(total_tokens) as total FROM metrics WHERE session_id = ?",
        [activeSession.id]
      );
      setTokenCount(rows[0]?.total ?? 0);
    } catch (err) {
      console.error("Failed to load token count:", err);
    }
  }, [activeSession?.id]);

  // Load token count whenever active session changes
  useEffect(() => {
    loadTokenCount();
  }, [activeSession?.id, loadTokenCount]);

  // Listen for agent-finished events and log metrics to database
  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | null = null;

    listen<{
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      estimated_cost: number;
      latency_ms: number;
    }>("agent-finished", async (event) => {
      if (!activeSession?.id || !active) return;
      try {
        const db = await Database.load("sqlite:noir.db");
        const metricId = crypto.randomUUID();
        await db.execute(
          `INSERT INTO metrics (
            id, 
            session_id, 
            prompt_tokens, 
            completion_tokens, 
            total_tokens, 
            estimated_cost, 
            latency_ms, 
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            metricId,
            activeSession.id,
            event.payload.prompt_tokens,
            event.payload.completion_tokens,
            event.payload.total_tokens,
            event.payload.estimated_cost,
            event.payload.latency_ms,
            new Date().toISOString(),
          ]
        );
        // Refresh token count immediately
        loadTokenCount();
      } catch (err) {
        console.error("Failed to insert turn metrics:", err);
      }
    }).then((unsub) => {
      unlistenFn = unsub;
      if (!active) {
        unsub();
      }
    });

    return () => {
      active = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [activeSession?.id, loadTokenCount]);

  // Load working directory on mount
  useEffect(() => {
    invoke<string>("get_working_dir")
      .then(setWorkingDir)
      .catch(() => setWorkingDir("unknown"));
  }, []);

  // Sync Rust working dir when active session changes
  useEffect(() => {
    if (activeSession && activeSession.workspace) {
      setWorkingDir(activeSession.workspace);
      invoke("set_working_dir", { path: activeSession.workspace })
        .catch((err) => console.error("Failed to set working dir in Rust:", err));
    }
  }, [activeSession?.id]);

  // Handle workspace folder picker click
  async function handleDirClick() {
    if (!activeSession) return;
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: workingDir !== "—" ? workingDir : undefined,
      });

      if (selected && typeof selected === "string") {
        setWorkingDir(selected);
        await updateSessionWorkspace(activeSession.id, selected);
        await invoke("set_working_dir", { path: selected });
      }
    } catch (err) {
      console.error("Failed to select workspace directory:", err);
    }
  }

  // Handle exporting conversation history to markdown
  async function handleExportSession() {
    if (!activeSession) return;
    try {
      const db = await Database.load("sqlite:noir.db");
      const rows = await db.select<
        Array<{
          id: string;
          session_id: string;
          role: Message["role"];
          content: string;
          model: string | null;
          created_at: string;
        }>
      >(
        "SELECT id, session_id, role, content, model, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
        [activeSession.id]
      );

      const exportMessages: Message[] = [];
      for (const row of rows) {
        const toolCallRows = await db.select<ToolCall[]>(
          "SELECT id, message_id, tool_name, input, output, status, duration_ms FROM tool_calls WHERE message_id = ? ORDER BY created_at ASC",
          [row.id]
        );

        exportMessages.push({
          id: row.id,
          session_id: row.session_id,
          role: row.role,
          content: row.content,
          model: row.model ?? undefined,
          tool_calls: toolCallRows.length > 0 ? toolCallRows : undefined,
          created_at: row.created_at,
        });
      }

      const markdownContent = exportToMarkdown(
        activeSession.title,
        activeSession.model,
        activeSession.agent_tag,
        activeSession.workspace,
        exportMessages
      );

      const selectedPath = await save({
        defaultPath: `${activeSession.title.toLowerCase().replace(/\s+/g, "-") || "session"}-export.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });

      if (selectedPath) {
        await invoke("write_file", { path: selectedPath, contents: markdownContent });
      }
    } catch (err) {
      console.error("Failed to export session:", err);
    }
  }

  function handleSendMessage(content: string) {
    if (!activeSession) return;
    // Use run_agent for the agentic loop
    invoke("run_agent", {
      config: {
        provider: settings.provider,
        model: settings.model,
        api_key: settings.api_key,
        base_url: settings.base_url || undefined,
        max_tokens: settings.max_tokens,
        temperature: settings.temperature,
      },
      userMessage: content,
      workspace: workingDir,
      escapePlan: settings.escape_plan_mode,
      sessionId: activeSession.id,
    }).catch((err) => console.error("Agent error:", err));

    // Add user message locally for immediate display
    sendMessage(content);
  }

  return (
    <>
      <AppLayout
        model={settings.model}
        workingDir={workingDir}
        agentStatus={agentStatus}
        tokenCount={tokenCount}
        sessions={sessions}
        activeSessionId={activeSession?.id}
        onSelectSession={selectSession}
        onNewSession={() => createSession()}
        messages={messages}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        onSettingsClick={() => setSettingsOpen(true)}
        agentTag={activeSession?.agent_tag}
        onHudClick={() => setDashboardOpen(true)}
        onDirClick={handleDirClick}
        onDeleteSession={deleteSession}
        onExportSession={handleExportSession}
        activeSessionTitle={activeSession?.title}
      />

      {pendingApproval && (
        <MamasGate
          request={pendingApproval}
          onRespond={respond}
        />
      )}

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => {
          saveSettings(newSettings);
          setSettingsOpen(false);
        }}
      />

      {activeSession && (
        <IntelligenceDashboard
          isOpen={dashboardOpen}
          onClose={() => setDashboardOpen(false)}
          sessionId={activeSession.id}
          agentTag={activeSession.agent_tag}
        />
      )}
    </>
  );
}