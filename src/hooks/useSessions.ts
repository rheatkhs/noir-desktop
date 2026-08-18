import { useState, useEffect, useCallback } from "react";
import Database from "@tauri-apps/plugin-sql";
import type { Session, Message, ToolCall } from "../types";

interface UseSessionsReturn {
  sessions: Session[];
  activeSession: Session | undefined;
  selectSession: (id: string) => void;
  createSession: (title?: string, model?: string) => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<Message[]>;
}

function generateId(): string {
  return crypto.randomUUID();
}

async function getDb(): Promise<Database> {
  return Database.load("sqlite:noir.db");
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();

  const activeSession = sessions.find((s) => s.id === activeId);

  const fetchSessions = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.select<Session[]>(
        "SELECT id, title, workspace, model, agent_tag, created_at, updated_at FROM sessions ORDER BY updated_at DESC",
      );
      setSessions(rows);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const createSession = useCallback(
    async (title?: string, model?: string): Promise<string> => {
      const id = generateId();
      const now = new Date().toISOString();
      try {
        const db = await getDb();
        await db.execute(
          "INSERT INTO sessions (id, title, workspace, model, agent_tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [id, title ?? "Untitled", ".", model ?? "", "", now, now],
        );
        await fetchSessions();
        setActiveId(id);
      } catch (err) {
        console.error("Failed to create session:", err);
      }
      return id;
    },
    [fetchSessions],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM sessions WHERE id = ?", [id]);
        if (activeId === id) {
          setActiveId(undefined);
        }
        await fetchSessions();
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [activeId, fetchSessions],
  );

  const loadMessages = useCallback(async (sessionId: string): Promise<Message[]> => {
    try {
      const db = await getDb();
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
        [sessionId],
      );

      // For each message, load its tool calls
      const messages: Message[] = [];
      for (const row of rows) {
        const toolCallRows = await db.select<ToolCall[]>(
          "SELECT id, message_id, tool_name, input, output, status, duration_ms FROM tool_calls WHERE message_id = ? ORDER BY created_at ASC",
          [row.id],
        );

        messages.push({
          id: row.id,
          session_id: row.session_id,
          role: row.role,
          content: row.content,
          model: row.model ?? undefined,
          tool_calls: toolCallRows.length > 0 ? toolCallRows : undefined,
          created_at: row.created_at,
        });
      }

      return messages;
    } catch (err) {
      console.error("Failed to load messages:", err);
      return [];
    }
  }, []);

  return {
    sessions,
    activeSession,
    selectSession,
    createSession,
    deleteSession,
    loadMessages,
  };
}
