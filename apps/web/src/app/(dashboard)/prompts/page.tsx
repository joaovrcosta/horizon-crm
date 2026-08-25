"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Prompt, PromptVisibility } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import {
  EmailBodyEditor,
  EmailBodyToolbar,
  type EmailBodyEditorHandle,
} from "@/components/email-body-editor";
import {
  IconCopy,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@/components/icons";
import { PromptsSkeleton } from "@/components/skeleton";
import { apiFetch } from "@/lib/api-client";
import {
  DEFAULT_EMAIL_FONT,
  htmlToPlainText,
  plainTextToEditorHtml,
} from "@/lib/email-body";
import {
  formatPromptVariableTokens,
  PROMPT_TEMPLATE_VARIABLE_HINTS,
} from "@/lib/prospect-utils";

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
  const contentEditorRef = useRef<EmailBodyEditorHandle>(null);

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

  function canEdit(prompt: Prompt) {
    return (
      can("prompts:manage_all") ||
      prompt.createdById === user?.id ||
      prompt.visibility === "PUBLIC"
    );
  }

  function canDelete(prompt: Prompt) {
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
      content: plainTextToEditorHtml(prompt.content),
      tags: prompt.tags.join(", "),
      visibility: prompt.visibility,
    });
    setShowModal(true);
  }

  async function savePrompt(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!htmlToPlainText(form.content)) {
      setError("Preencha o conteúdo do template.");
      return;
    }
    setSaving(true);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: form.title,
        content: form.content.trim(),
        tags,
        visibility: form.visibility,
      };

      if (editing) {
        const updated = await apiFetch<Prompt>(`/prompts/${editing.id}`, {
          method: "PATCH",
          body: payload,
        });
        setPrompts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
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
    await navigator.clipboard.writeText(
      htmlToPlainText(prompt.content) || prompt.content,
    );
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function removePrompt(prompt: Prompt) {
    if (!confirm(`Remover template "${prompt.title}"?`)) return;
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
        <h1>E-mail templates</h1>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          <IconPlus size={16} />
          Novo template
        </button>
      </div>

      <div className="list-toolbar prompts-toolbar">
        <div className="list-toolbar-row">
          <input
            className="list-search"
            placeholder="Buscar templates…"
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
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void load()}
          >
            Buscar
          </button>
        </div>
      </div>

      {error && !showModal ? (
        <p style={{ color: "#b91c1c" }}>{error}</p>
      ) : null}

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
            <div className="prompt-content">
              {htmlToPlainText(prompt.content) || prompt.content}
            </div>
            <div className="prompt-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void copyPrompt(prompt)}
              >
                <IconCopy size={16} />
                {copiedId === prompt.id ? "Copiado!" : "Copiar"}
              </button>
              {canEdit(prompt) ? (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => openEdit(prompt)}
                >
                  <IconEdit size={16} />
                  Editar
                </button>
              ) : null}
              {canDelete(prompt) ? (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => void removePrompt(prompt)}
                >
                  <IconTrash size={16} />
                  Remover
                </button>
              ) : null}
            </div>
          </article>
        ))}

        {prompts.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            Nenhum template de e-mail. Crie textos reutilizáveis para a equipe.
          </p>
        ) : null}
      </div>

      {showModal ? (
        <div className="modal-backdrop">
          <form className="modal modal-wide prompt-modal" onSubmit={savePrompt}>
            <h2>{editing ? "Editar template" : "Novo template"}</h2>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-grid">
              <label>
                Título *
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <div className="template-content-field">
                <div className="template-content-label-row">
                  <span>Conteúdo *</span>
                  <EmailBodyToolbar
                    showFont={false}
                    onInsertLink={() => contentEditorRef.current?.insertLink()}
                  />
                </div>
                <div className="template-content-editor">
                  <EmailBodyEditor
                    ref={contentEditorRef}
                    value={form.content}
                    onChange={(content) => setForm({ ...form, content })}
                    fontFamily={DEFAULT_EMAIL_FONT}
                    placeholder={
                      "Olá {{nome}},\n\nTudo bem? Vi que você atua em {{categoria}}…"
                    }
                  />
                </div>
                <p className="field-hint">
                  Selecione um texto e clique em Link para inserir um hyperlink.
                </p>
              </div>
              <details className="template-vars-dropdown">
                <summary>
                  Variáveis disponíveis para personalizar o e-mail
                </summary>
                <p className="field-hint">
                  Ao enviar e-mail, estas variáveis são preenchidas
                  automaticamente. Use <code>{"{{consultantName}}"}</code> para
                  o nome de quem está logado.
                </p>
                <ul className="template-vars-list">
                  {PROMPT_TEMPLATE_VARIABLE_HINTS.map(({ keys, label }) => (
                    <li key={keys[0]}>
                      <code>{formatPromptVariableTokens(keys)}</code>
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </details>
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
                onClick={() => {
                  setShowModal(false);
                  setError("");
                }}
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
