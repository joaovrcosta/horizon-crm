import type { ApiResponse, AuthLoginResponse, UserPublic } from "@horizon/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
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
          accessToken = null;
          return false;
        }
        const json = (await res.json()) as ApiResponse<AuthLoginResponse>;
        accessToken = json.data.accessToken;
        return true;
      } catch {
        accessToken = null;
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
  accessToken = data.accessToken;
  return data;
}

export async function logoutRequest() {
  try {
    await apiFetch<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      auth: false,
    });
  } finally {
    accessToken = null;
  }
}

export async function fetchMe() {
  return apiFetch<UserPublic>("/auth/me");
}

export async function bootstrapSession(): Promise<UserPublic | null> {
  try {
    const refreshed = await tryRefresh();
    if (!refreshed) return null;
    return await fetchMe();
  } catch {
    accessToken = null;
    return null;
  }
}
