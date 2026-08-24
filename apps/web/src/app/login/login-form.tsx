"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { IconMoon, IconSun } from "@/components/icons";

export default function LoginForm() {
  const { user, loading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [loading, user, router, next]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setSubmitting(false);
    }
  }

  // Sempre mostra o formulário — não esconde enquanto checa sessão
  if (user) {
    return <div className="login-page" aria-busy="true" />;
  }

  return (
    <div className="login-page">
      <button
        type="button"
        className="theme-fab"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
        title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>

      <div className="login-shell">
        <h1 className="login-brand">
          <img
            src="/brand/horizon-logo.svg"
            alt=""
            className="login-brand-logo"
            width={106}
            height={40}
          />
          <span className="login-brand-text">horizon.</span>
        </h1>

        <form className="login-card" onSubmit={onSubmit}>
          {error ? <p className="error">{error}</p> : null}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? (
              <span className="btn-spinner" aria-label="Entrando" />
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
