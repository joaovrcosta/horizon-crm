"use client";

import { useEffect, useState } from "react";
import {
  migrateSidebarPreferenceCookie,
  readSidebarCollapsed,
  SIDEBAR_COLLAPSED_KEY,
  writeSidebarCollapsed,
} from "@/lib/sidebar-preference";

export function useSidebarCollapsed(initialCollapsed = true) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    migrateSidebarPreferenceCookie();
    setCollapsed(readSidebarCollapsed(initialCollapsed));

    function onStorage(event: StorageEvent) {
      if (event.key === SIDEBAR_COLLAPSED_KEY) {
        setCollapsed(readSidebarCollapsed(initialCollapsed));
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [initialCollapsed]);

  function setCollapsedPreference(next: boolean) {
    writeSidebarCollapsed(next);
    setCollapsed(next);
  }

  return { collapsed, setCollapsed: setCollapsedPreference };
}
