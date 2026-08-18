import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import AppLayout from "./components/layout/AppLayout";
import MamasGate from "./components/approval/MamasGate";
import SettingsPanel from "./components/settings/SettingsPanel";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";
import { useSettings } from "./hooks/useSettings";
import { useApproval } from "./hooks/useApproval";

export default function App() {
  const [workingDir, setWorkingDir] = useState("—");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    sessions,
    activeSession,
    selectSession,
    createSession,
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

  // Load working directory on mount
  useEffect(() => {
    invoke<string>("get_working_dir")
      .then(setWorkingDir)
      .catch(() => setWorkingDir("unknown"));
  }, []);

  function handleSendMessage(content: string) {
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
    </>
  );
}
