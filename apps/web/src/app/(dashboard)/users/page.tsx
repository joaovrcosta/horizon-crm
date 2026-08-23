"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserPublic } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { IconPlus, IconTrash } from "@/components/icons";

export default function UsersPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (user && !can("users:read")) {
      router.replace("/prospects");
    }
  }, [user, can, router]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const usersData = await apiFetch<UserPublic[]>("/users");
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (can("users:read")) {
      void load();
    }
  }, [user, can]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await apiFetch<UserPublic>("/users", {
        method: "POST",
        body: form,
      });
      setUsers((prev) => [created, ...prev]);
      setShowModal(false);
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(target: UserPublic) {
    if (!confirm(`Remover usuário ${target.email}?`)) return;
    try {
      await apiFetch<void>(`/users/${target.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  if (!can("users:read")) {
    return null;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Usuários</h1>
        <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
          <IconPlus size={16} />
          Criar usuário
        </button>
      </div>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p>Carregando…</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Papel</th>
            <th>Criado em</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role.name}</td>
              <td>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
              <td>
                {can("users:delete") && u.id !== user?.id ? (
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => void removeUser(u)}
                  >
                    <IconTrash size={16} />
                    Remover
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal ? (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={createUser}>
            <h2>Novo usuário</h2>
            <p className="text-muted">
              Novos usuários são criados como Membro. Promoção a administrador só via banco de dados.
            </p>
            <div className="form-grid">
              <label>
                Nome *
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Email *
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                Senha *
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Criando…" : "Criar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
