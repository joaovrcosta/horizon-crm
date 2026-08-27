"use client";

import { FormEvent, useEffect, useState } from "react";
import type { EmailSignature } from "@horizon/shared";
import {
  DEFAULT_EMAIL_LOGO_URL,
  DEFAULT_EMAIL_REPLY_TO,
} from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { EmailSignaturePreview } from "@/components/email-signature-preview";
import { SettingsSkeleton } from "@/components/skeleton";
import { SettingsTagCatalog } from "@/components/settings-tag-catalog";
import { apiFetch } from "@/lib/api-client";

type FormState = {
  enabled: boolean;
  replyToEmail: string;
  displayName: string;
  title: string;
  phone: string;
  logoUrl: string;
  company: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  website: string;
  defaultIntro: string;
};

const emptyForm = (name = ""): FormState => ({
  enabled: false,
  replyToEmail: DEFAULT_EMAIL_REPLY_TO,
  displayName: name,
  title: "",
  phone: "",
  logoUrl: DEFAULT_EMAIL_LOGO_URL,
  company: "",
  tagline: "",
  addressLine1: "",
  addressLine2: "",
  website: "",
  defaultIntro: "",
});

function toForm(sig: EmailSignature, fallbackName: string): FormState {
  return {
    enabled: sig.enabled,
    replyToEmail: sig.replyToEmail ?? DEFAULT_EMAIL_REPLY_TO,
    displayName: sig.displayName ?? fallbackName,
    title: sig.title ?? "",
    phone: sig.phone ?? "",
    logoUrl: sig.logoUrl?.trim() || DEFAULT_EMAIL_LOGO_URL,
    company: sig.company ?? "",
    tagline: sig.tagline ?? "",
    addressLine1: sig.addressLine1 ?? "",
    addressLine2: sig.addressLine2 ?? "",
    website: sig.website ?? "",
    defaultIntro: sig.defaultIntro ?? "",
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm(user?.name ?? ""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editingReplyTo, setEditingReplyTo] = useState(false);
  const [replyToDraft, setReplyToDraft] = useState(DEFAULT_EMAIL_REPLY_TO);
  const [savingReplyTo, setSavingReplyTo] = useState(false);
  const [replyToSaved, setReplyToSaved] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<EmailSignature>("/settings/email-signature");
      const next = toForm(data, user.name);
      setForm(next);
      setReplyToDraft(next.replyToEmail);
      setEditingReplyTo(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const data = await apiFetch<EmailSignature>("/settings/email-signature", {
        method: "PUT",
        body: {
          enabled: form.enabled,
          replyToEmail: form.replyToEmail.trim() || DEFAULT_EMAIL_REPLY_TO,
          displayName: form.displayName || null,
          title: form.title || null,
          phone: form.phone || null,
          logoUrl: form.logoUrl.trim() || DEFAULT_EMAIL_LOGO_URL,
          company: form.company || null,
          tagline: form.tagline || null,
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          website: form.website || null,
          defaultIntro: form.defaultIntro || null,
        },
      });
      setForm(toForm(data, user?.name ?? ""));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function startEditReplyTo() {
    setReplyToDraft(form.replyToEmail);
    setReplyToSaved(false);
    setEditingReplyTo(true);
  }

  function cancelEditReplyTo() {
    setReplyToDraft(form.replyToEmail);
    setEditingReplyTo(false);
    setError("");
  }

  async function saveReplyTo() {
    const nextEmail = replyToDraft.trim();
    if (!nextEmail) {
      setError("Informe o e-mail de respostas.");
      return;
    }
    setSavingReplyTo(true);
    setError("");
    setReplyToSaved(false);
    try {
      const data = await apiFetch<EmailSignature>("/settings/email-signature", {
        method: "PUT",
        body: {
          enabled: form.enabled,
          replyToEmail: nextEmail,
          displayName: form.displayName || null,
          title: form.title || null,
          phone: form.phone || null,
          logoUrl: form.logoUrl.trim() || DEFAULT_EMAIL_LOGO_URL,
          company: form.company || null,
          tagline: form.tagline || null,
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          website: form.website || null,
          defaultIntro: form.defaultIntro || null,
        },
      });
      const next = toForm(data, user?.name ?? "");
      setForm(next);
      setReplyToDraft(next.replyToEmail);
      setEditingReplyTo(false);
      setReplyToSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o Reply-To");
    } finally {
      setSavingReplyTo(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSaved(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("A confirmação não confere com a nova senha");
      setPasswordSaving(false);
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("A nova senha deve ter pelo menos 8 caracteres");
      setPasswordSaving(false);
      return;
    }

    try {
      await apiFetch<{ ok: boolean }>("/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        },
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Erro ao redefinir senha",
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  const previewSig: EmailSignature = {
    id: "preview",
    userId: user?.id ?? "",
    enabled: form.enabled,
    replyToEmail: form.replyToEmail.trim() || DEFAULT_EMAIL_REPLY_TO,
    displayName: form.displayName || null,
    title: form.title || null,
    phone: form.phone || null,
    logoUrl: form.logoUrl.trim() || DEFAULT_EMAIL_LOGO_URL,
    company: form.company || null,
    tagline: form.tagline || null,
    addressLine1: form.addressLine1 || null,
    addressLine2: form.addressLine2 || null,
    website: form.website || null,
    defaultIntro: form.defaultIntro || null,
    updatedAt: new Date().toISOString(),
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <h1>Configurações</h1>
          <p>
            Configuração da sua conta ({user?.email}): senha, tags, assinatura
            e corpo padrão de e-mail.
          </p>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="settings-layout">
        <section className="panel settings-password">
          <h2>Redefinição de senha</h2>
          <p className="panel-desc">
            Altere a senha de acesso à sua conta. Você precisará da senha
            atual para confirmar.
          </p>

          <form className="form-grid" onSubmit={changePassword}>
            <label className="span-2">
              Senha atual
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                required
              />
            </label>
            <label className="span-2">
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                minLength={8}
                required
              />
            </label>
            <label className="span-2">
              Confirmar nova senha
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                minLength={8}
                required
              />
            </label>

            {passwordError ? (
              <p className="form-error span-2">{passwordError}</p>
            ) : null}

            <div
              className="modal-actions span-2"
              style={{ justifyContent: "flex-start" }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={passwordSaving}
              >
                {passwordSaving ? "Salvando…" : "Redefinir senha"}
              </button>
              {passwordSaved ? (
                <span className="save-ok">Senha atualizada.</span>
              ) : null}
            </div>
          </form>
        </section>

        <section className="panel settings-reply">
          <h2>Respostas de e-mail</h2>
          <p className="panel-desc">
            Quando um prospect clicar em &quot;Responder&quot;, a mensagem
            será entregue neste endereço — não no e-mail de login da sua
            conta no CRM.
          </p>

          <div className="form-grid">
            <label className="span-2">
              Reply-To (caixa de respostas)
              <div className="reply-to-control">
                <input
                  type="email"
                  value={editingReplyTo ? replyToDraft : form.replyToEmail}
                  onChange={(e) => setReplyToDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingReplyTo) {
                      e.preventDefault();
                      void saveReplyTo();
                    }
                    if (e.key === "Escape" && editingReplyTo) {
                      e.preventDefault();
                      cancelEditReplyTo();
                    }
                  }}
                  placeholder="contato@inbox.halk.solutions"
                  required
                  readOnly={!editingReplyTo}
                  aria-readonly={!editingReplyTo}
                />
                {!editingReplyTo ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={startEditReplyTo}
                  >
                    Alterar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={cancelEditReplyTo}
                      disabled={savingReplyTo}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void saveReplyTo()}
                      disabled={savingReplyTo}
                    >
                      {savingReplyTo ? "Salvando…" : "Salvar"}
                    </button>
                  </>
                )}
              </div>
            </label>
          </div>

          {replyToSaved && !editingReplyTo ? (
            <p className="save-ok">Reply-To atualizado. Os próximos envios usarão este endereço.</p>
          ) : null}

          <p className="field-hint">
            Use um endereço que o Resend receba, por exemplo{" "}
            <code>contato@inbox.halk.solutions</code>. Não use o endereço de
            envio (<code>{DEFAULT_EMAIL_REPLY_TO}</code>), senão as respostas
            não chegam.
          </p>
        </section>

        <section className="panel settings-tags">
          <h2>Categorias e idiomas</h2>
          <p className="panel-desc">
            Catálogo compartilhado da equipe. Categorias e idiomas definem
            quais templates de e-mail aparecem para cada cliente.
          </p>
          <div className="settings-tags-grid">
            <SettingsTagCatalog
              kind="CATEGORY"
              title="Categorias"
              description="Ex.: Hotel, Restaurante, Clínica. Vincule o mesmo nome no template para filtrar o e-mail."
              placeholder="Nova categoria"
            />
            <SettingsTagCatalog
              kind="LANGUAGE"
              title="Idiomas"
              description="Ex.: Português, Inglês, Espanhol. Vincule o mesmo nome no template para filtrar o e-mail."
              placeholder="Novo idioma"
            />
          </div>
        </section>

        <form className="settings-email-form" onSubmit={save}>

        <section className="panel">
          <h2>Assinatura de e-mail</h2>
          <p className="panel-desc">
            Preencha os campos abaixo com seus dados. Ao enviar e-mails de
            prospecção, será usada apenas a sua assinatura — não a de outros
            usuários.
          </p>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) =>
                setForm({ ...form, enabled: e.target.checked })
              }
            />
            Usar minha assinatura nos e-mails
          </label>

          <div className="form-grid form-grid-2">
            <label>
              Nome
              <input
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                placeholder={user?.name}
              />
            </label>
            <label>
              Cargo / título
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Consultor comercial"
              />
            </label>
            <label>
              Telefone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(+55 11) 99999-0000"
              />
            </label>
            <label>
              Website
              <input
                value={form.website}
                onChange={(e) =>
                  setForm({ ...form, website: e.target.value })
                }
                placeholder="seusite.com.br"
              />
            </label>
            <label className="span-2">
              URL do logo
              <input
                value={form.logoUrl}
                onChange={(e) =>
                  setForm({ ...form, logoUrl: e.target.value })
                }
                placeholder={DEFAULT_EMAIL_LOGO_URL}
              />
            </label>
            <label>
              Empresa
              <input
                value={form.company}
                onChange={(e) =>
                  setForm({ ...form, company: e.target.value })
                }
                placeholder="Nome da empresa"
              />
            </label>
            <label>
              Tagline
              <input
                value={form.tagline}
                onChange={(e) =>
                  setForm({ ...form, tagline: e.target.value })
                }
                placeholder="Frase curta (opcional)"
              />
            </label>
            <label>
              Endereço (linha 1)
              <input
                value={form.addressLine1}
                onChange={(e) =>
                  setForm({ ...form, addressLine1: e.target.value })
                }
              />
            </label>
            <label>
              Endereço (linha 2)
              <input
                value={form.addressLine2}
                onChange={(e) =>
                  setForm({ ...form, addressLine2: e.target.value })
                }
              />
            </label>
            <label className="span-2">
              Corpo padrão (introdução)
              <textarea
                rows={5}
                value={form.defaultIntro}
                onChange={(e) =>
                  setForm({ ...form, defaultIntro: e.target.value })
                }
                placeholder={
                  "Olá {{nome}},\n\nTudo bem? Gostaria de apresentar…"
                }
              />
            </label>
          </div>

          <p className="field-hint">
            No corpo padrão você pode usar {"{{nome}}"}, {"{{email}}"},{" "}
            {"{{telefone}}"}, etc. Use URLs https públicas para o logo.
          </p>

          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Salvando…" : "Salvar minha assinatura"}
            </button>
            {saved ? (
              <span className="save-ok">Salvo.</span>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <h2>Prévia</h2>
          <EmailSignaturePreview
            signature={previewSig}
            fallbackName={user?.name}
            intro={form.defaultIntro}
          />
        </section>
        </form>
      </div>
    </div>
  );
}
