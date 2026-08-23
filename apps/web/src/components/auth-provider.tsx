"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PermissionKey, UserPublic } from "@horizon/shared";
import { hasPermission } from "@horizon/shared";
import {
  bootstrapSession,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "@/lib/api-client";

type AuthContextValue = {
  user: UserPublic | null;
  permissions: PermissionKey[];
  loading: boolean;
  can: (key: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const safety = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 8000);

    bootstrapSession()
      .then((session) => {
        if (!active) return;
        if (session) {
          setUser(session.user);
          setPermissions(session.permissions);
        } else {
          setUser(null);
          setPermissions([]);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setPermissions([]);
        }
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
    setPermissions(data.permissions);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await registerRequest(name, email, password);
      setUser(data.user);
      setPermissions(data.permissions);
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setPermissions([]);
  }, []);

  const can = useCallback(
    (key: PermissionKey) => hasPermission(permissions, key),
    [permissions],
  );

  const value = useMemo(
    () => ({ user, permissions, loading, can, login, register, logout }),
    [user, permissions, loading, can, login, register, logout],
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
