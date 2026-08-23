"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Prompt, PromptVisibility } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";
import {
  IconCopy,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@/components/icons";
import { PromptsSkeleton } from "@/components/skeleton";

const emptyForm = {
  title: "",
  content: "",
  tags: "",
  visibility: "PRIVATE" as PromptVisibility,
};

export default function PromptsPage() {
  const { user, can } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (visibilityFilter) params.set("visibility", visibilityFilter);
      const qs = params.toString();
      const data = await apiFetch<Prompt[]>(`/prompts${qs ? `?${qs}` : ""}`);
      setPrompts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibilityFilter]);

  function canManage(prompt: Prompt) {
    return can("prompts:manage_all") || prompt.createdById === user?.id;
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(prompt: Prompt) {
    setEditing(prompt);
    setForm({
      title: prompt.title,
      content: prompt.content,
      tags: prompt.tags.join(", "),
      visibility: prompt.visibility,
    });
    setShowModal(true);
  }

  async function savePrompt(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: form.title,
        content: form.content,
        tags,
        visibility: form.visibility,
      };

      if (editing) {
        const updated = await apiFetch<Prompt>(`/prompts/${editing.id}`, {
          method: "PATCH",
          body: payload,
        });
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await apiFetch<Prompt>("/prompts", {
          method: "POST",
          body: payload,
        });
        setPrompts((prev) => [created, ...prev]);
      }

      setShowModal(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrompt(prompt: Prompt) {
    await navigator.clipboard.writeText(prompt.content);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function removePrompt(prompt: Prompt) {
    if (!confirm(`Remover prompt "${prompt.title}"?`)) return;
    try {
      await apiFetch<void>(`/prompts/${prompt.id}`, { method: "DELETE" });
      setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  if (loading) {
    return <PromptsSkeleton />;
  }

  return (
    <div className="prompts-page">
      <div className="page-header">
        <h1>Vault de prompts</h1>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          <IconPlus size={16} />
          Novo prompt
        </button>
      </div>

      <div className="list-toolbar" style={{ padding: 0, marginBottom: "1rem", maxWidth: 560 }}>
        <input
          placeholder="Buscar prompts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
        />
        <select
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value)}
        >
          <option value="">Todos (públicos + meus privados)</option>
          <option value="PUBLIC">Só públicos</option>
          <option value="PRIVATE">Só privados</option>
        </select>
        <button className="btn btn-secondary" type="button" onClick={() => void load()}>
          Buscar
        </button>
      </div>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      <div className="prompt-grid">
        {prompts.map((prompt) => (
          <article key={prompt.id} className="prompt-card">
            <header>
              <div>
                <h3>{prompt.title}</h3>
                <div className="tags" style={{ marginTop: "0.4rem" }}>
                  <span
                    className={`tag ${prompt.visibility === "PUBLIC" ? "tag-public" : "tag-private"}`}
                  >
                    {prompt.visibility === "PUBLIC" ? "Público" : "Privado"}
                  </span>
                  {prompt.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </header>
            <div className="prompt-content">{prompt.content}</div>
            <div className="prompt-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void copyPrompt(prompt)}
              >
                <IconCopy size={16} />
                {copiedId === prompt.id ? "Copiado!" : "Copiar"}
              </button>
              {canManage(prompt) ? (
                <>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => openEdit(prompt)}
                  >
                    <IconEdit size={16} />
                    Editar
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => void removePrompt(prompt)}
                  >
                    <IconTrash size={16} />
                    Remover
                  </button>
                </>
              ) : null}
            </div>
          </article>
        ))}

        {prompts.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            Nenhum prompt no vault. Crie textos e links copiáveis para a equipe.
          </p>
        ) : null}
      </div>

      {showModal ? (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={savePrompt}>
            <h2>{editing ? "Editar prompt" : "Novo prompt"}</h2>
            <div className="form-grid">
              <label>
                Título *
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                Conteúdo (texto ou link) *
                <textarea
                  required
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </label>
              <label>
                Visibilidade *
                <select
                  value={form.visibility}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      visibility: e.target.value as PromptVisibility,
                    })
                  }
                >
                  <option value="PRIVATE">Privado — só você (e admin)</option>
                  <option value="PUBLIC">Público — toda a equipe</option>
                </select>
              </label>
              <label>
                Tags (separadas por vírgula)
                <input
                  placeholder="prospecção, whatsapp, follow-up"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
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
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
