import type {
  ApiResponse,
  AuthLoginResponse,
  AuthSession,
} from "@horizon/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const ACCESS_TOKEN_KEY = "horizon_access_token";
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function loadStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function persistToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") return;
  try {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, bufferMs = REFRESH_BUFFER_MS): boolean {
  const exp = getTokenExpiryMs(token);
  if (!exp) return true;
  return Date.now() >= exp - bufferMs;
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleProactiveRefresh(token: string) {
  clearRefreshTimer();
  const exp = getTokenExpiryMs(token);
  if (!exp) return;

  const delay = Math.max(exp - Date.now() - REFRESH_BUFFER_MS, 30_000);
  refreshTimer = setTimeout(() => {
    void tryRefresh();
  }, delay);
}

export function setAccessToken(token: string | null) {
  persistToken(token);
  if (token) scheduleProactiveRefresh(token);
  else clearRefreshTimer();
}

export function getAccessToken() {
  return accessToken;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 8000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          persistToken(null);
          clearRefreshTimer();
          return false;
        }
        const json = (await res.json()) as ApiResponse<AuthLoginResponse>;
        persistToken(json.data.accessToken);
        scheduleProactiveRefresh(json.data.accessToken);
        return true;
      } catch {
        persistToken(null);
        clearRefreshTimer();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  if (auth && accessToken && isTokenExpired(accessToken)) {
    await tryRefresh();
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res = await fetchWithTimeout(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
      res = await fetchWithTimeout(`${API_URL}${path}`, {
        method,
        headers,
        credentials: "include",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof json === "object" && json && "error" in json
        ? String((json as { error: string }).error)
        : "Falha na requisição";
    throw new Error(message);
  }

  return (json as ApiResponse<T>).data;
}

export async function loginRequest(email: string, password: string) {
  const data = await apiFetch<AuthLoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  persistToken(data.accessToken);
  scheduleProactiveRefresh(data.accessToken);
  return data;
}

export async function logoutRequest() {
  try {
    await apiFetch<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      auth: false,
    });
  } finally {
    persistToken(null);
    clearRefreshTimer();
  }
}

export async function fetchMe() {
  return apiFetch<AuthSession>("/auth/me");
}

export async function bootstrapSession(): Promise<AuthSession | null> {
  try {
    const stored = loadStoredToken();
    if (stored && !isTokenExpired(stored)) {
      persistToken(stored);
      scheduleProactiveRefresh(stored);
      return await fetchMe();
    }

    const refreshed = await tryRefresh();
    if (!refreshed) return null;
    return await fetchMe();
  } catch {
    persistToken(null);
    clearRefreshTimer();
    return null;
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!accessToken) {
      const stored = loadStoredToken();
      if (stored && !isTokenExpired(stored)) {
        persistToken(stored);
        scheduleProactiveRefresh(stored);
      }
    }
    if (accessToken && isTokenExpired(accessToken)) {
      void tryRefresh();
    }
  });
}
