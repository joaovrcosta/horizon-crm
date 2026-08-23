"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { IconMoon, IconSun } from "@/components/icons";

type Mode = "login" | "register";

export default function LoginForm() {
  const { user, loading, login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
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
      if (mode === "register") {
        await register(name.trim(), email, password);
      } else {
        await login(email, password);
      }
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "register"
            ? "Falha no cadastro"
            : "Falha no login",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className="boot-screen">
        <p>Carregando…</p>
      </div>
    );
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

      <form className="login-card" onSubmit={onSubmit}>
        <h1>
          horizon<span style={{ color: "var(--cyan)" }}>.</span>
        </h1>
        <p>
          {mode === "login"
            ? "Acesse o painel da agência"
            : "Crie sua conta (papel Membro)"}
        </p>

        <div className="login-tabs" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`btn ${mode === "register" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Cadastrar
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {mode === "register" ? (
          <>
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </>
        ) : null}

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
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting
            ? mode === "register"
              ? "Criando…"
              : "Entrando…"
            : mode === "register"
              ? "Criar conta"
              : "Entrar"}
        </button>
      </form>
    </div>
  );
}
