"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyGoalConfigUser, UserPublic } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { IconPlus, IconTrash } from "@/components/icons";
import { UsersSkeleton } from "@/components/skeleton";

type GoalDraft = {
  targetCount: string;
  enabled: boolean;
};

function goalDraftFromConfig(config: DailyGoalConfigUser): GoalDraft {
  return {
    targetCount: String(config.targetCount),
    enabled: config.enabled,
  };
}

export default function UsersPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [goalByUserId, setGoalByUserId] = useState<
    Record<string, DailyGoalConfigUser>
  >({});
  const [goalDrafts, setGoalDrafts] = useState<Record<string, GoalDraft>>({});
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const canManageGoals = can("goals:manage");

  useEffect(() => {
    if (user && !can("users:read")) {
      router.replace("/prospects");
    }
  }, [user, can, router]);

  function applyGoalConfigs(configs: DailyGoalConfigUser[]) {
    const byId: Record<string, DailyGoalConfigUser> = {};
    const drafts: Record<string, GoalDraft> = {};
    for (const config of configs) {
      byId[config.userId] = config;
      drafts[config.userId] = goalDraftFromConfig(config);
    }
    setGoalByUserId(byId);
    setGoalDrafts(drafts);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const requests: [
        Promise<UserPublic[]>,
        Promise<DailyGoalConfigUser[] | null>,
      ] = [
        apiFetch<UserPublic[]>("/users"),
        canManageGoals
          ? apiFetch<DailyGoalConfigUser[]>("/goals/configs")
          : Promise.resolve(null),
      ];
      const [usersData, configsData] = await Promise.all(requests);
      setUsers(usersData);
      if (configsData) {
        applyGoalConfigs(configsData);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, can, canManageGoals]);

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
      if (canManageGoals) {
        await load();
      }
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
      setGoalByUserId((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
      setGoalDrafts((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  async function saveGoalConfig(userId: string, draftOverride?: GoalDraft) {
    const draft = draftOverride ?? goalDrafts[userId];
    if (!draft) return;

    const targetCount = Number.parseInt(draft.targetCount, 10);
    if (draft.enabled && (!Number.isFinite(targetCount) || targetCount < 1)) {
      setError("Com a meta ativada, informe um número inteiro maior que zero.");
      return;
    }

    setSavingGoalId(userId);
    setError("");
    try {
      const updated = await apiFetch<DailyGoalConfigUser>(
        `/goals/users/${userId}`,
        {
          method: "PUT",
          body: {
            targetCount: draft.enabled ? targetCount : Number.parseInt(draft.targetCount, 10) || 5,
            enabled: draft.enabled,
          },
        },
      );
      setGoalByUserId((prev) => ({ ...prev, [userId]: updated }));
      setGoalDrafts((prev) => ({
        ...prev,
        [userId]: goalDraftFromConfig(updated),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar meta");
    } finally {
      setSavingGoalId(null);
    }
  }

  async function toggleGoalEnabled(userId: string) {
    const draft = goalDrafts[userId] ?? {
      targetCount: "5",
      enabled: false,
    };
    const nextDraft = { ...draft, enabled: !draft.enabled };
    setGoalDrafts((prev) => ({ ...prev, [userId]: nextDraft }));
    await saveGoalConfig(userId, nextDraft);
  }

  if (!can("users:read")) {
    return null;
  }

  if (loading) {
    return <UsersSkeleton />;
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

      {canManageGoals ? (
        <p className="users-goals-intro">
          A meta diária começa <strong>desativada</strong> para todos. Ative
          manualmente por usuário. Conta apenas <strong>cadastro de cliente</strong>{" "}
          feito no dia.
        </p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-wrap">
        <table className="table users-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Papel</th>
              {canManageGoals ? (
                <>
                  <th>Meta diária</th>
                  <th>Meta/dia</th>
                  <th>Hoje</th>
                </>
              ) : null}
              <th>Criado em</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const config = goalByUserId[u.id];
              const draft = goalDrafts[u.id] ?? {
                targetCount: String(config?.targetCount ?? 5),
                enabled: config?.enabled ?? false,
              };
              const isSavingGoal = savingGoalId === u.id;

              return (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role.name}</td>
                  {canManageGoals ? (
                    <>
                      <td>
                        <div className="users-goal-activate">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={draft.enabled}
                            aria-label={
                              draft.enabled
                                ? `Desativar meta diária de ${u.name}`
                                : `Ativar meta diária de ${u.name}`
                            }
                            className={`toggle-switch${draft.enabled ? " is-on" : ""}`}
                            disabled={isSavingGoal}
                            onClick={() => void toggleGoalEnabled(u.id)}
                          >
                            <span className="toggle-switch-thumb" />
                          </button>
                          <span
                            className={`users-goal-status${draft.enabled ? " is-active" : ""}`}
                          >
                            {draft.enabled ? "Ativada" : "Desativada"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <input
                          className="users-goals-target"
                          type="number"
                          min={1}
                          max={100}
                          disabled={!draft.enabled || isSavingGoal}
                          value={draft.targetCount}
                          title={
                            draft.enabled
                              ? "Tarefas por dia"
                              : "Ative a meta diária para editar"
                          }
                          onChange={(e) =>
                            setGoalDrafts((prev) => ({
                              ...prev,
                              [u.id]: {
                                ...draft,
                                targetCount: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td>
                        {draft.enabled && config
                          ? `${config.completedToday}/${config.targetCount}`
                          : "—"}
                      </td>
                    </>
                  ) : null}
                  <td>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="users-row-actions">
                    {canManageGoals ? (
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={!draft.enabled || isSavingGoal}
                        onClick={() => void saveGoalConfig(u.id)}
                      >
                        {isSavingGoal ? "Salvando…" : "Salvar meta"}
                      </button>
                    ) : null}
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
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={createUser}>
            <h2>Novo usuário</h2>
            <p className="text-muted">
              Novos usuários são criados como Membro, com meta diária desativada.
              Promoção a administrador só via banco de dados.
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
