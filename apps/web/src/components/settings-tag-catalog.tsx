"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ProspectTag, ProspectTagKind } from "@horizon/shared";
import { IconEdit, IconPlus, IconTrash, IconX } from "@/components/icons";
import { apiFetch } from "@/lib/api-client";

type SettingsTagCatalogProps = {
  kind: ProspectTagKind;
  title: string;
  description: string;
  placeholder: string;
};

export function SettingsTagCatalog({
  kind,
  title,
  description,
  placeholder,
}: SettingsTagCatalogProps) {
  const [tags, setTags] = useState<ProspectTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<ProspectTag[]>(
        `/prospects/tags?kind=${kind}`,
      );
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar tags");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function addTag(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next) return;
    setSaving(true);
    setError("");
    try {
      const tag = await apiFetch<ProspectTag>("/prospects/tags", {
        method: "POST",
        body: { kind, name: next },
      });
      setTags((prev) => {
        if (prev.some((item) => item.id === tag.id)) return prev;
        return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar tag");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    const next = draft.trim();
    if (!next) return;
    setSaving(true);
    setError("");
    try {
      const tag = await apiFetch<ProspectTag>(`/prospects/tags/${id}`, {
        method: "PATCH",
        body: { name: next },
      });
      setTags((prev) =>
        prev
          .map((item) => (item.id === id ? tag : item))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
      setEditingId(null);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar tag");
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tag: ProspectTag) {
    const kindLabel = kind === "CATEGORY" ? "categoria" : "idioma";
    if (
      !confirm(
        `Remover a ${kindLabel} “${tag.name}”? Ela será desvinculada dos clientes${
          kind === "CATEGORY" ? " e dos templates" : ""
        }.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch<void>(`/prospects/tags/${tag.id}`, { method: "DELETE" });
      setTags((prev) => prev.filter((item) => item.id !== tag.id));
      if (editingId === tag.id) {
        setEditingId(null);
        setDraft("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover tag");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tag-catalog">
      <h3>{title}</h3>
      <p>{description}</p>

      <form className="tag-catalog-add" onSubmit={addTag}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={placeholder}
          maxLength={80}
          disabled={saving}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={saving || !name.trim()}
        >
          <IconPlus size={15} />
          Adicionar
        </button>
      </form>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <p className="tag-catalog-empty">Carregando…</p>
      ) : tags.length === 0 ? (
        <p className="tag-catalog-empty">Nenhuma tag cadastrada ainda.</p>
      ) : (
        <ul className="tag-catalog-list">
          {tags.map((tag) => (
            <li key={tag.id} className="tag-catalog-row">
              {editingId === tag.id ? (
                <>
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={80}
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveEdit(tag.id);
                      }
                      if (event.key === "Escape") {
                        setEditingId(null);
                        setDraft("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving || !draft.trim()}
                    onClick={() => void saveEdit(tag.id)}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(null);
                      setDraft("");
                    }}
                  >
                    <IconX size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className={`tag-chip tag-chip-${kind.toLowerCase()}`}>
                    {tag.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    aria-label={`Editar ${tag.name}`}
                    disabled={saving}
                    onClick={() => {
                      setEditingId(tag.id);
                      setDraft(tag.name);
                    }}
                  >
                    <IconEdit size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    aria-label={`Remover ${tag.name}`}
                    disabled={saving}
                    onClick={() => void removeTag(tag)}
                  >
                    <IconTrash size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
