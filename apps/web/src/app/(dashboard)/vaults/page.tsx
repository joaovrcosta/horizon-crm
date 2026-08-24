"use client";

import { FormEvent, useEffect, useState } from "react";
import type { PromptVisibility, Vault, VaultItem } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import {
  IconCopy,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@/components/icons";
import { VaultsSkeleton } from "@/components/skeleton";
import { apiFetch } from "@/lib/api-client";

const emptyVaultForm = {
  name: "",
  description: "",
  visibility: "PRIVATE" as PromptVisibility,
};

const emptyItemForm = {
  title: "",
  content: "",
};

export default function VaultsPage() {
  const { user, can } = useAuth();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showVaultModal, setShowVaultModal] = useState(false);
  const [editingVault, setEditingVault] = useState<Vault | null>(null);
  const [vaultForm, setVaultForm] = useState(emptyVaultForm);
  const [savingVault, setSavingVault] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [savingItem, setSavingItem] = useState(false);

  const selected = vaults.find((v) => v.id === selectedId) ?? null;

  function canManageVault(vault: Vault) {
    return can("vaults:manage_all") || vault.createdById === user?.id;
  }

  async function loadVaults(selectFirst = false) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const qs = params.toString();
      const data = await apiFetch<Vault[]>(`/vaults${qs ? `?${qs}` : ""}`);
      setVaults(data);
      if (selectFirst && data.length > 0) {
        setSelectedId(data[0].id);
      } else if (selectedId && !data.some((v) => v.id === selectedId)) {
        setSelectedId(data[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cofres");
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(vaultId: string) {
    setLoadingItems(true);
    setError("");
    try {
      const data = await apiFetch<VaultItem[]>(`/vaults/${vaultId}/items`);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar itens");
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    void loadVaults(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadItems(selectedId);
    } else {
      setItems([]);
    }
  }, [selectedId]);

  function openCreateVault() {
    setEditingVault(null);
    setVaultForm(emptyVaultForm);
    setShowVaultModal(true);
  }

  function openEditVault(vault: Vault) {
    setEditingVault(vault);
    setVaultForm({
      name: vault.name,
      description: vault.description ?? "",
      visibility: vault.visibility,
    });
    setShowVaultModal(true);
  }

  async function saveVault(event: FormEvent) {
    event.preventDefault();
    setSavingVault(true);
    setError("");
    try {
      const payload = {
        name: vaultForm.name,
        description: vaultForm.description.trim() || null,
        visibility: vaultForm.visibility,
      };

      if (editingVault) {
        const updated = await apiFetch<Vault>(`/vaults/${editingVault.id}`, {
          method: "PATCH",
          body: payload,
        });
        setVaults((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      } else {
        const created = await apiFetch<Vault>("/vaults", {
          method: "POST",
          body: payload,
        });
        setVaults((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }

      setShowVaultModal(false);
      setVaultForm(emptyVaultForm);
      setEditingVault(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar cofre");
    } finally {
      setSavingVault(false);
    }
  }

  async function removeVault(vault: Vault) {
    if (!confirm(`Remover cofre "${vault.name}" e todos os itens?`)) return;
    try {
      await apiFetch<void>(`/vaults/${vault.id}`, { method: "DELETE" });
      setVaults((prev) => {
        const next = prev.filter((v) => v.id !== vault.id);
        if (selectedId === vault.id) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover cofre");
    }
  }

  function openCreateItem() {
    if (!selected) return;
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setShowItemModal(true);
  }

  function openEditItem(item: VaultItem) {
    setEditingItem(item);
    setItemForm({ title: item.title, content: item.content });
    setShowItemModal(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSavingItem(true);
    setError("");
    try {
      const payload = {
        title: itemForm.title,
        content: itemForm.content,
      };

      if (editingItem) {
        const updated = await apiFetch<VaultItem>(
          `/vaults/${selected.id}/items/${editingItem.id}`,
          { method: "PATCH", body: payload },
        );
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await apiFetch<VaultItem>(`/vaults/${selected.id}/items`, {
          method: "POST",
          body: payload,
        });
        setItems((prev) => [...prev, created]);
        setVaults((prev) =>
          prev.map((v) =>
            v.id === selected.id ? { ...v, itemCount: v.itemCount + 1 } : v,
          ),
        );
      }

      setShowItemModal(false);
      setItemForm(emptyItemForm);
      setEditingItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar item");
    } finally {
      setSavingItem(false);
    }
  }

  async function removeItem(item: VaultItem) {
    if (!selected) return;
    if (!confirm(`Remover item "${item.title}"?`)) return;
    try {
      await apiFetch<void>(`/vaults/${selected.id}/items/${item.id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setVaults((prev) =>
        prev.map((v) =>
          v.id === selected.id
            ? { ...v, itemCount: Math.max(0, v.itemCount - 1) }
            : v,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover item");
    }
  }

  async function copyItem(item: VaultItem) {
    await navigator.clipboard.writeText(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (loading) {
    return <VaultsSkeleton />;
  }

  return (
    <div className="vaults-page">
      <div className="page-header">
        <h1>Cofres</h1>
        <button className="btn btn-primary" type="button" onClick={openCreateVault}>
          <IconPlus size={16} />
          Novo cofre
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="split-view vaults-split">
        <section className="list-pane vault-list-pane">
          <div className="list-toolbar vaults-toolbar">
            <div className="list-toolbar-row">
              <input
                className="list-search"
                placeholder="Buscar cofres…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadVaults();
                }}
              />
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => void loadVaults()}
              >
                Buscar
              </button>
            </div>
          </div>

          <ul className="vault-list">
            {vaults.map((vault) => (
              <li key={vault.id}>
                <button
                  type="button"
                  className={`vault-list-item${selectedId === vault.id ? " active" : ""}`}
                  onClick={() => setSelectedId(vault.id)}
                >
                  <span className="vault-list-name">{vault.name}</span>
                  <span className="vault-list-meta">
                    {vault.itemCount} {vault.itemCount === 1 ? "item" : "itens"}
                    {vault.visibility === "PUBLIC" ? " · público" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {vaults.length === 0 ? (
            <p className="vault-empty-hint">
              Nenhum cofre ainda. Crie um para guardar textos que você copia com
              frequência.
            </p>
          ) : null}
        </section>

        <section className="detail-pane vault-detail-pane">
          {selected ? (
            <>
              <div className="vault-detail-header">
                <div>
                  <h2>{selected.name}</h2>
                  {selected.description ? (
                    <p className="vault-description">{selected.description}</p>
                  ) : null}
                  <div className="tags" style={{ marginTop: "0.4rem" }}>
                    <span
                      className={`tag ${selected.visibility === "PUBLIC" ? "tag-public" : "tag-private"}`}
                    >
                      {selected.visibility === "PUBLIC" ? "Público" : "Privado"}
                    </span>
                  </div>
                </div>
                <div className="vault-detail-actions">
                  {canManageVault(selected) ? (
                    <>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => openEditVault(selected)}
                      >
                        <IconEdit size={16} />
                        Editar cofre
                      </button>
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => void removeVault(selected)}
                      >
                        <IconTrash size={16} />
                        Remover
                      </button>
                    </>
                  ) : null}
                  {canManageVault(selected) ? (
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={openCreateItem}
                    >
                      <IconPlus size={16} />
                      Novo item
                    </button>
                  ) : null}
                </div>
              </div>

              {loadingItems ? (
                <p className="field-hint">Carregando itens…</p>
              ) : items.length === 0 ? (
                <p className="vault-empty-hint">
                  Este cofre está vazio. Adicione links, mensagens ou trechos
                  prontos para copiar.
                </p>
              ) : (
                <div className="vault-items-grid">
                  {items.map((item) => (
                    <article key={item.id} className="vault-item-card">
                      <header>
                        <h3>{item.title}</h3>
                      </header>
                      <div className="vault-item-content">{item.content}</div>
                      <div className="vault-item-actions">
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => void copyItem(item)}
                        >
                          <IconCopy size={16} />
                          {copiedId === item.id ? "Copiado!" : "Copiar"}
                        </button>
                        {canManageVault(selected) ? (
                          <>
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={() => openEditItem(item)}
                            >
                              <IconEdit size={16} />
                              Editar
                            </button>
                            <button
                              className="btn btn-danger"
                              type="button"
                              onClick={() => void removeItem(item)}
                            >
                              <IconTrash size={16} />
                              Remover
                            </button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="vault-empty-state">
              <h2>Selecione um cofre</h2>
              <p className="field-hint">
                Organize textos, links e mensagens em cofres separados — um para
                cada contexto ou momento.
              </p>
            </div>
          )}
        </section>
      </div>

      {showVaultModal ? (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={saveVault}>
            <h2>{editingVault ? "Editar cofre" : "Novo cofre"}</h2>
            <div className="form-grid">
              <label>
                Nome *
                <input
                  required
                  placeholder="Ex.: Prospecção, Follow-up, Links úteis"
                  value={vaultForm.name}
                  onChange={(e) =>
                    setVaultForm({ ...vaultForm, name: e.target.value })
                  }
                />
              </label>
              <label>
                Descrição
                <textarea
                  rows={3}
                  placeholder="Para que serve este cofre?"
                  value={vaultForm.description}
                  onChange={(e) =>
                    setVaultForm({ ...vaultForm, description: e.target.value })
                  }
                />
              </label>
              <label>
                Visibilidade *
                <select
                  value={vaultForm.visibility}
                  onChange={(e) =>
                    setVaultForm({
                      ...vaultForm,
                      visibility: e.target.value as PromptVisibility,
                    })
                  }
                >
                  <option value="PRIVATE">Privado — só você (e admin)</option>
                  <option value="PUBLIC">Público — toda a equipe pode ver e copiar</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowVaultModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={savingVault}>
                {savingVault ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showItemModal ? (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={saveItem}>
            <h2>{editingItem ? "Editar item" : "Novo item"}</h2>
            <div className="form-grid">
              <label>
                Título *
                <input
                  required
                  placeholder="Ex.: Mensagem de primeiro contato"
                  value={itemForm.title}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, title: e.target.value })
                  }
                />
              </label>
              <label>
                Conteúdo (texto ou link) *
                <textarea
                  required
                  rows={8}
                  placeholder="Texto ou URL que você quer copiar com um clique"
                  value={itemForm.content}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, content: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowItemModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={savingItem}>
                {savingItem ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
