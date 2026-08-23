"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ActivityType,
  EmailSignature,
  Prompt,
  Prospect,
  ProspectActivity,
  ProspectStatus,
  UserOption,
} from "@horizon/shared";
import { PROSPECT_STATUSES, STATUS_LABELS } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";
import {
  buildHtmlSignature,
  buildPlainSignature,
  copyHtmlToClipboard,
} from "@/lib/email-signature";
import { EmailSignaturePreview } from "@/components/email-signature-preview";
import {
  applyPromptTemplate,
  formatDateTime,
  fromDatetimeLocalValue,
  isOverdue,
  toDatetimeLocalValue,
  toTelLink,
  toWhatsAppLink,
} from "@/lib/prospect-utils";
import {
  IconEdit,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPlus,
  IconTrash,
  IconWhatsApp,
} from "@/components/icons";

type FormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  mapsUrl: string;
  website: string;
  category: string;
  status: ProspectStatus;
  notes: string;
  lostReason: string;
  estimatedValue: string;
  nextContactAt: string;
  assigneeId: string;
};

const emptyForm = (assigneeId = ""): FormState => ({
  name: "",
  address: "",
  phone: "",
  email: "",
  whatsapp: "",
  mapsUrl: "",
  website: "",
  category: "",
  status: "NEW",
  notes: "",
  lostReason: "",
  estimatedValue: "",
  nextContactAt: "",
  assigneeId,
});

function prospectToForm(p: Prospect): FormState {
  return {
    name: p.name,
    address: p.address ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    whatsapp: p.whatsapp ?? "",
    mapsUrl: p.mapsUrl ?? "",
    website: p.website ?? "",
    category: p.category ?? "",
    status: p.status,
    notes: p.notes ?? "",
    lostReason: p.lostReason ?? "",
    estimatedValue:
      p.estimatedValue != null ? String(p.estimatedValue) : "",
    nextContactAt: toDatetimeLocalValue(p.nextContactAt),
    assigneeId: p.assigneeId ?? "",
  };
}

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  NOTE: "Nota",
  CALL: "Ligação",
  WHATSAPP: "WhatsApp",
  VISIT: "Visita",
  EMAIL: "E-mail",
  STATUS_CHANGE: "Status",
  OTHER: "Outro",
};

export default function ProspectsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(user?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<ProspectActivity[]>([]);
  const [activityType, setActivityType] = useState<ActivityType>("NOTE");
  const [activityContent, setActivityContent] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [emailPromptId, setEmailPromptId] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [openingEmail, setOpeningEmail] = useState(false);
  const [emailSignature, setEmailSignature] = useState<EmailSignature | null>(
    null,
  );
  const [includeSignature, setIncludeSignature] = useState(true);
  const [emailClipboardHint, setEmailClipboardHint] = useState("");

  const selected = useMemo(
    () => prospects.find((p) => p.id === selectedId) ?? null,
    [prospects, selectedId],
  );

  async function loadUsers() {
    try {
      const data = await apiFetch<UserOption[]>("/users/options");
      setUsers(data);
    } catch {
      // ignore
    }
  }

  async function loadActivities(prospectId: string) {
    try {
      const data = await apiFetch<ProspectActivity[]>(
        `/prospects/${prospectId}/activities`,
      );
      setActivities(data);
    } catch {
      setActivities([]);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (dueFilter) params.set("due", dueFilter);
      const qs = params.toString();
      const data = await apiFetch<Prospect[]>(
        `/prospects${qs ? `?${qs}` : ""}`,
      );
      setProspects(data);
      if (data.length && !selectedId) setSelectedId(data[0].id);
      if (selectedId && !data.some((p) => p.id === selectedId)) {
        setSelectedId(data[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dueFilter]);

  useEffect(() => {
    if (selectedId) void loadActivities(selectedId);
    else setActivities([]);
  }, [selectedId]);

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm(user?.id ?? ""));
    setShowModal(true);
  }

  function openEditModal() {
    if (!selected) return;
    setEditingId(selected.id);
    setForm(prospectToForm(selected));
    setShowModal(true);
  }

  function closeProspectModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm(user?.id ?? ""));
  }

  async function saveProspect(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      estimatedValue: form.estimatedValue
        ? Number(form.estimatedValue)
        : null,
      nextContactAt: fromDatetimeLocalValue(form.nextContactAt),
      assigneeId: form.assigneeId || user?.id || null,
    };
    try {
      if (editingId) {
        const updated = await apiFetch<Prospect>(`/prospects/${editingId}`, {
          method: "PATCH",
          body: payload,
        });
        setProspects((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        closeProspectModal();
      } else {
        const created = await apiFetch<Prospect>("/prospects", {
          method: "POST",
          body: {
            ...payload,
            assigneeId: form.assigneeId || user?.id,
          },
        });
        closeProspectModal();
        setProspects((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? "Erro ao atualizar"
            : "Erro ao criar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateSelected(patch: Record<string, unknown>) {
    if (!selected) return;
    try {
      const updated = await apiFetch<Prospect>(`/prospects/${selected.id}`, {
        method: "PATCH",
        body: patch,
      });
      setProspects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!confirm(`Remover prospect "${selected.name}"?`)) return;
    try {
      await apiFetch<void>(`/prospects/${selected.id}`, { method: "DELETE" });
      setProspects((prev) => prev.filter((p) => p.id !== selected.id));
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  async function addActivity(event: FormEvent) {
    event.preventDefault();
    if (!selected || !activityContent.trim()) return;
    setSavingActivity(true);
    try {
      const created = await apiFetch<ProspectActivity>(
        `/prospects/${selected.id}/activities`,
        {
          method: "POST",
          body: { type: activityType, content: activityContent.trim() },
        },
      );
      setActivities((prev) => [created, ...prev]);
      setActivityContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setSavingActivity(false);
    }
  }

  async function openEmailModal() {
    if (!selected?.email) return;
    setEmailPromptId("");
    setEmailSubject(`Contato — ${selected.name}`);
    setEmailBody("");
    setEmailClipboardHint("");
    setShowEmailModal(true);
    setLoadingPrompts(true);
    try {
      const [promptList, signature] = await Promise.all([
        apiFetch<Prompt[]>("/prompts").catch(() => [] as Prompt[]),
        apiFetch<EmailSignature>("/settings/email-signature"),
      ]);
      setPrompts(promptList);
      setEmailSignature(signature);
      setIncludeSignature(signature.enabled);

      if (signature?.defaultIntro?.trim()) {
        setEmailBody(
          applyPromptTemplate(signature.defaultIntro, {
            name: selected.name,
            email: selected.email,
            phone: selected.phone || selected.whatsapp,
            address: selected.address,
            category: selected.category,
            website: selected.website,
          }),
        );
      }
    } finally {
      setLoadingPrompts(false);
    }
  }

  function applyEmailPrompt(promptId: string) {
    setEmailPromptId(promptId);
    if (!promptId || !selected) return;
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;
    setEmailBody(
      applyPromptTemplate(prompt.content, {
        name: selected.name,
        email: selected.email,
        phone: selected.phone || selected.whatsapp,
        address: selected.address,
        category: selected.category,
        website: selected.website,
      }),
    );
    if (!emailSubject.trim()) {
      setEmailSubject(prompt.title);
    }
  }

  async function sendEmailViaResend() {
    if (!selected?.email) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      setEmailClipboardHint("Preencha assunto e corpo antes de enviar.");
      return;
    }
    setOpeningEmail(true);
    setEmailClipboardHint("");
    try {
      const result = await apiFetch<{
        emailId: string | null;
        activity: ProspectActivity;
        statusUpdated: boolean;
      }>(`/prospects/${selected.id}/emails`, {
        method: "POST",
        body: {
          subject: emailSubject.trim(),
          body: emailBody.trim(),
          includeSignature: includeSignature && Boolean(emailSignature?.enabled),
        },
      });

      setActivities((prev) => [result.activity, ...prev]);
      if (result.statusUpdated) {
        setProspects((prev) =>
          prev.map((p) =>
            p.id === selected.id ? { ...p, status: "CONTACTED" } : p,
          ),
        );
      }
      setEmailClipboardHint("E-mail enviado com sucesso via Resend.");
      setTimeout(() => setShowEmailModal(false), 900);
    } catch (err) {
      setEmailClipboardHint(
        err instanceof Error ? err.message : "Falha ao enviar e-mail",
      );
    } finally {
      setOpeningEmail(false);
    }
  }

  async function copySignatureOnly() {
    if (!emailSignature?.enabled) return;
    setEmailClipboardHint("");
    try {
      const html = await buildHtmlSignature(emailSignature, {
        fallbackName: user?.name,
        embedLogo: true,
      });
      const plain = buildPlainSignature(emailSignature, {
        fallbackName: user?.name,
      });
      if (!html) return;
      const ok = await copyHtmlToClipboard(html, plain);
      setEmailClipboardHint(
        ok
          ? "Assinatura com logo copiada (Ctrl+V)."
          : "Falha ao copiar. Verifique permissões do navegador.",
      );
    } catch {
      setEmailClipboardHint("Erro ao gerar a assinatura com logo.");
    }
  }

  const active = prospects.filter(
    (p) => p.status !== "LOST" && p.status !== "WON",
  );
  const closed = prospects.filter(
    (p) => p.status === "LOST" || p.status === "WON",
  );
  const wa = selected
    ? toWhatsAppLink(selected.whatsapp || selected.phone)
    : null;
  const tel = selected
    ? toTelLink(selected.phone || selected.whatsapp)
    : null;

  return (
    <div className="split-view">
      <section className="list-pane">
        <div className="list-header">
          <h2>
            Prospects
            <span className="count">{prospects.length}</span>
          </h2>
        </div>

        <div className="list-toolbar">
          <input
            placeholder="Buscar nome, telefone, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            {PROSPECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value)}
          >
            <option value="">Qualquer follow-up</option>
            <option value="overdue">Atrasados</option>
            <option value="today">Hoje</option>
            <option value="upcoming">Próximos</option>
          </select>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void load()}
          >
            Filtrar
          </button>
        </div>

        <div className="list-items">
          {loading ? <p className="list-empty">Carregando…</p> : null}
          {error ? (
            <p className="list-empty list-empty-error">{error}</p>
          ) : null}

          {!loading && active.length > 0 ? (
            <>
              <div className="list-section-label">
                Ativos <span className="count">{active.length}</span>
              </div>
              {active.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`list-item${selectedId === p.id ? " selected" : ""}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <strong>{p.name}</strong>
                  <span>{p.address || p.phone || p.email || "Sem contato"}</span>
                  <div className="meta">
                    <span className={`status-pill status-${p.status}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                    {isOverdue(p.nextContactAt, p.status) ? (
                      <span className="status-pill status-overdue">Atrasado</span>
                    ) : null}
                    <span className="meta-assignee">
                      {p.assigneeName || "Sem responsável"}
                    </span>
                  </div>
                </button>
              ))}
            </>
          ) : null}

          {!loading && closed.length > 0 ? (
            <>
              <div className="list-section-label">
                Encerrados <span className="count">{closed.length}</span>
              </div>
              {closed.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`list-item${selectedId === p.id ? " selected" : ""}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <strong>{p.name}</strong>
                  <span>{p.address || "—"}</span>
                </button>
              ))}
            </>
          ) : null}

          {!loading && prospects.length === 0 ? (
            <p className="list-empty">
              Nenhum prospect ainda. Adicione leads do Google Maps.
            </p>
          ) : null}
        </div>

        <div className="list-footer">
          <button
            className="btn btn-primary btn-block"
            type="button"
            onClick={openCreateModal}
          >
            <IconPlus size={16} />
            Adicionar prospect
          </button>
        </div>
      </section>

      <section className="detail-pane">
        {!selected ? (
          <div className="detail-empty">Selecione um prospect</div>
        ) : (
          <>
            <div className="detail-tabs">
              <span>Overview</span>
            </div>

            <div className="detail-section">
              <h3>
                {selected.name}
                {isOverdue(selected.nextContactAt, selected.status) ? (
                  <span
                    className="status-pill status-LOST"
                    style={{ marginLeft: 8 }}
                  >
                    Follow-up atrasado
                  </span>
                ) : null}
              </h3>
              <dl className="kv-grid">
                <div className="kv-row">
                  <dt>Status</dt>
                  <dd>
                    <select
                      value={selected.status}
                      onChange={(e) =>
                        void updateSelected({
                          status: e.target.value as ProspectStatus,
                        })
                      }
                    >
                      {PROSPECT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Responsável</dt>
                  <dd>
                    <select
                      value={selected.assigneeId ?? ""}
                      onChange={(e) =>
                        void updateSelected({
                          assigneeId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Sem responsável</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Próximo contato</dt>
                  <dd>
                    <input
                      type="datetime-local"
                      defaultValue={toDatetimeLocalValue(selected.nextContactAt)}
                      key={`next-${selected.id}-${selected.nextContactAt}`}
                      onBlur={(e) => {
                        const next = fromDatetimeLocalValue(e.target.value);
                        if ((selected.nextContactAt ?? null) !== next) {
                          void updateSelected({ nextContactAt: next });
                        }
                      }}
                    />
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Categoria</dt>
                  <dd>{selected.category || "—"}</dd>
                </div>
                <div className="kv-row">
                  <dt>Telefone</dt>
                  <dd>{selected.phone || "—"}</dd>
                </div>
                <div className="kv-row">
                  <dt>WhatsApp</dt>
                  <dd>{selected.whatsapp || "—"}</dd>
                </div>
                <div className="kv-row">
                  <dt>E-mail</dt>
                  <dd>
                    {selected.email ? (
                      <a href={`mailto:${selected.email}`}>{selected.email}</a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Endereço</dt>
                  <dd>{selected.address || "—"}</dd>
                </div>
                <div className="kv-row">
                  <dt>Ticket est.</dt>
                  <dd>
                    {selected.estimatedValue != null
                      ? selected.estimatedValue.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : "—"}
                  </dd>
                </div>
                {selected.status === "LOST" ? (
                  <div className="kv-row">
                    <dt>Motivo perda</dt>
                    <dd>
                      <input
                        defaultValue={selected.lostReason ?? ""}
                        key={`lost-${selected.id}`}
                        onBlur={(e) => {
                          if ((selected.lostReason ?? "") !== e.target.value) {
                            void updateSelected({ lostReason: e.target.value });
                          }
                        }}
                      />
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="actions-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={openEditModal}
              >
                <IconEdit size={16} />
                Editar
              </button>
              {wa ? (
                <a
                  className="btn btn-whatsapp"
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconWhatsApp size={16} />
                  WhatsApp
                </a>
              ) : null}
              {tel ? (
                <a className="btn btn-secondary" href={tel}>
                  <IconPhone size={16} />
                  Ligar
                </a>
              ) : null}
              {selected.email ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void openEmailModal()}
                >
                  <IconMail size={16} />
                  E-mail
                </button>
              ) : null}
              {selected.mapsUrl ? (
                <a
                  className="btn btn-secondary"
                  href={selected.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconMapPin size={16} />
                  Abrir Maps
                </a>
              ) : null}
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => void removeSelected()}
              >
                <IconTrash size={16} />
                Remover
              </button>
            </div>

            <div className="detail-section">
              <h3>Notas</h3>
              <textarea
                rows={4}
                defaultValue={selected.notes ?? ""}
                key={`notes-${selected.id}`}
                onBlur={(e) => {
                  if ((selected.notes ?? "") !== e.target.value) {
                    void updateSelected({ notes: e.target.value });
                  }
                }}
              />
            </div>

            <div className="detail-section">
              <h3>Atividades</h3>
              <form className="activity-form" onSubmit={addActivity}>
                <select
                  value={activityType}
                  onChange={(e) =>
                    setActivityType(e.target.value as ActivityType)
                  }
                >
                  {(Object.keys(ACTIVITY_LABEL) as ActivityType[])
                    .filter((t) => t !== "STATUS_CHANGE")
                    .map((type) => (
                      <option key={type} value={type}>
                        {ACTIVITY_LABEL[type]}
                      </option>
                    ))}
                </select>
                <input
                  placeholder="O que aconteceu?"
                  value={activityContent}
                  onChange={(e) => setActivityContent(e.target.value)}
                  required
                />
                <button className="btn btn-primary" disabled={savingActivity}>
                  {savingActivity ? "…" : "Registrar"}
                </button>
              </form>
              <div className="timeline">
                {activities.map((a) => (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-meta">
                      <strong>{ACTIVITY_LABEL[a.type]}</strong>
                      <span>
                        {a.userName} · {formatDateTime(a.createdAt)}
                      </span>
                    </div>
                    <p>{a.content}</p>
                  </div>
                ))}
                {activities.length === 0 ? (
                  <p style={{ color: "#6b7280" }}>Nenhuma atividade ainda.</p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      {showModal ? (
        <div className="modal-backdrop">
          <form className="modal modal-wide" onSubmit={saveProspect}>
            <h2>{editingId ? "Editar prospect" : "Novo prospect"}</h2>
            <div className="form-grid form-grid-2">
              <label>
                Nome *
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Categoria
                <input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </label>
              <label>
                Telefone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                WhatsApp
                <input
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm({ ...form, whatsapp: e.target.value })
                  }
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                Responsável
                <select
                  value={form.assigneeId}
                  onChange={(e) =>
                    setForm({ ...form, assigneeId: e.target.value })
                  }
                >
                  <option value="">Sem responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as ProspectStatus,
                    })
                  }
                >
                  {PROSPECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Endereço
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </label>
              <label>
                Próximo contato
                <input
                  type="datetime-local"
                  value={form.nextContactAt}
                  onChange={(e) =>
                    setForm({ ...form, nextContactAt: e.target.value })
                  }
                />
              </label>
              <label>
                Link Google Maps
                <input
                  type="url"
                  value={form.mapsUrl}
                  onChange={(e) =>
                    setForm({ ...form, mapsUrl: e.target.value })
                  }
                />
              </label>
              <label>
                Website
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                />
              </label>
              <label>
                Ticket estimado (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedValue}
                  onChange={(e) =>
                    setForm({ ...form, estimatedValue: e.target.value })
                  }
                />
              </label>
              {form.status === "LOST" ? (
                <label className="span-2">
                  Motivo da perda
                  <input
                    value={form.lostReason}
                    onChange={(e) =>
                      setForm({ ...form, lostReason: e.target.value })
                    }
                  />
                </label>
              ) : null}
              <label className="span-2">
                Notas
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeProspectModal}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving
                  ? "Salvando…"
                  : editingId
                    ? "Salvar alterações"
                    : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showEmailModal && selected?.email ? (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEmailModal(false);
          }}
        >
          <div className="modal modal-wide" role="dialog" aria-modal="true">
            <h2>Enviar e-mail</h2>
            <div className="form-grid">
              <label>
                Para
                <input type="email" value={selected.email} readOnly />
              </label>
              <label>
                Usar prompt
                <select
                  value={emailPromptId}
                  onChange={(e) => applyEmailPrompt(e.target.value)}
                  disabled={loadingPrompts}
                >
                  <option value="">
                    {loadingPrompts
                      ? "Carregando…"
                      : "Nenhum (corpo padrão / manual)"}
                  </option>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                      {p.visibility === "PUBLIC" ? " · público" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assunto
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Assunto do e-mail"
                />
              </label>
              <label>
                Corpo
                <textarea
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Escreva o e-mail, use o corpo padrão das configs ou um prompt."
                />
              </label>
              {emailSignature ? (
                <>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={includeSignature && emailSignature.enabled}
                      disabled={!emailSignature.enabled}
                      onChange={(e) => setIncludeSignature(e.target.checked)}
                    />
                    Incluir assinatura
                    {!emailSignature.enabled
                      ? " (desativada em Configurações)"
                      : ""}
                  </label>
                  {includeSignature && emailSignature.enabled ? (
                    <EmailSignaturePreview
                      signature={emailSignature}
                      fallbackName={user?.name}
                      compact
                    />
                  ) : null}
                </>
              ) : null}
              <p className="field-hint">
                O e-mail é enviado pela API (Resend) com HTML e logo — sem
                copiar/colar. Ajuste a assinatura em{" "}
                <a href="/settings">Configurações</a>.
              </p>
              {emailClipboardHint ? (
                <p
                  className={
                    emailClipboardHint.toLowerCase().includes("sucesso") ||
                    emailClipboardHint.toLowerCase().includes("copiada")
                      ? "save-ok"
                      : "form-error"
                  }
                >
                  {emailClipboardHint}
                </p>
              ) : null}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowEmailModal(false)}
              >
                Fechar
              </button>
              {emailSignature?.enabled ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void copySignatureOnly()}
                >
                  Copiar assinatura
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                disabled={openingEmail}
                onClick={() => void sendEmailViaResend()}
              >
                {openingEmail ? "Enviando…" : "Enviar e-mail"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
