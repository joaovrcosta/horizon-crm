export const SIDEBAR_COLLAPSED_KEY = "horizon-sidebar-collapsed";

export function readSidebarCollapsed(defaultCollapsed = true) {
  if (typeof window === "undefined") return defaultCollapsed;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "0";
  } catch {
    return defaultCollapsed;
  }
}

export function readSidebarCollapsedFromCookie(
  cookieValue: string | undefined,
  defaultCollapsed = true,
) {
  if (cookieValue === undefined) return defaultCollapsed;
  return cookieValue !== "0";
}

export function writeSidebarCollapsed(collapsed: boolean) {
  const value = collapsed ? "1" : "0";
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${SIDEBAR_COLLAPSED_KEY}=${value}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export function migrateSidebarPreferenceCookie() {
  if (typeof window === "undefined") return;
  const hasCookie = document.cookie
    .split("; ")
    .some((part) => part.startsWith(`${SIDEBAR_COLLAPSED_KEY}=`));
  if (hasCookie) return;
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "0" || stored === "1") {
      document.cookie = `${SIDEBAR_COLLAPSED_KEY}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {
    /* ignore */
  }
}
