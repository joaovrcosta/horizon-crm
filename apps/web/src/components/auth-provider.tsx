"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UserPublic } from "@horizon/shared";
import {
  bootstrapSession,
  loginRequest,
  logoutRequest,
} from "@/lib/api-client";

type AuthContextValue = {
  user: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const safety = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 8000);

    bootstrapSession()
      .then((sessionUser) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        window.clearTimeout(safety);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(safety);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
