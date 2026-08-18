import { useState, useEffect, useCallback } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import type { ApprovalRequest, ApprovalResponse } from "../types";

export function useApproval() {
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);

  useEffect(() => {
    const unlisten = listen<ApprovalRequest>("approval-request", (event) => {
      setPendingApproval(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const respond = useCallback(
    async (approved: boolean) => {
      if (!pendingApproval) return;
      const response: ApprovalResponse = {
        id: pendingApproval.id,
        approved,
      };
      await emit("approval-response", response);
      setPendingApproval(null);
    },
    [pendingApproval],
  );

  return { pendingApproval, respond };
}
