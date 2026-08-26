"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export const MAIL_UNREAD_REFRESH_EVENT = "horizon:mail-unread-refresh";

export function notifyMailUnreadRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MAIL_UNREAD_REFRESH_EVENT));
}

/** Contagem de respostas não lidas para o badge da sidebar. */
export function useMailUnreadCount(pollMs = 30_000) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ unreadCount: number }>(
        "/emails/unread-count",
      );
      setCount(data.unreadCount);
    } catch {
      // silencioso — badge não é crítico
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);

    function onFocus() {
      void refresh();
    }
    function onRefresh() {
      void refresh();
    }

    window.addEventListener("focus", onFocus);
    window.addEventListener(MAIL_UNREAD_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(MAIL_UNREAD_REFRESH_EVENT, onRefresh);
    };
  }, [pollMs, refresh]);

  return count;
}
