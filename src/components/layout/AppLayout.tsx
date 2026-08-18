import type { AgentStatus, Session, Message } from "../../types";
import HudBar from "./HudBar";
import Sidebar from "./Sidebar";
import ChatPanel from "./ChatPanel";

interface AppLayoutProps {
  model: string;
  workingDir: string;
  agentStatus: AgentStatus;
  tokenCount?: number;
  sessions: Session[];
  activeSessionId?: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isStreaming: boolean;
  streamingContent?: string;
  onSettingsClick?: () => void;
  agentTag?: string;
}

export default function AppLayout({
  model,
  workingDir,
  agentStatus,
  tokenCount,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  messages,
  onSendMessage,
  isStreaming,
  streamingContent,
  onSettingsClick,
  agentTag,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <HudBar
        model={model}
        workingDir={workingDir}
        status={agentStatus}
        tokenCount={tokenCount}
        agentTag={agentTag}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={onSelectSession}
          onNew={onNewSession}
          onSettingsClick={onSettingsClick}
        />

        <ChatPanel
          messages={messages}
          onSend={onSendMessage}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
        />
      </div>
    </div>
  );
}
