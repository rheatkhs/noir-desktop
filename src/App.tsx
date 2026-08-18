import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import AppLayout from "./components/layout/AppLayout";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";

export default function App() {
  const [workingDir, setWorkingDir] = useState("—");

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

  // Load working directory on mount
  useEffect(() => {
    invoke<string>("get_working_dir")
      .then(setWorkingDir)
      .catch(() => setWorkingDir("unknown"));
  }, []);

  function handleNewSession() {
    createSession();
  }

  return (
    <AppLayout
      model={activeSession?.model || "No model"}
      workingDir={workingDir}
      agentStatus={agentStatus}
      sessions={sessions}
      activeSessionId={activeSession?.id}
      onSelectSession={selectSession}
      onNewSession={handleNewSession}
      messages={messages}
      onSendMessage={sendMessage}
      isStreaming={isStreaming}
      streamingContent={streamingContent}
    />
  );
}
