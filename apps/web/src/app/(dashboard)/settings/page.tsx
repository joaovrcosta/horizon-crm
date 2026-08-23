"use client";

import { FormEvent, useEffect, useState } from "react";
import type { EmailSignature } from "@horizon/shared";
import { DEFAULT_EMAIL_REPLY_TO } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { EmailSignaturePreview } from "@/components/email-signature-preview";
import { SettingsSkeleton } from "@/components/skeleton";
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
  logoUrl: "",
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
    logoUrl: sig.logoUrl ?? "",
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

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<EmailSignature>("/settings/email-signature");
      setForm(toForm(data, user.name));
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
          logoUrl: form.logoUrl || null,
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

  const previewSig: EmailSignature = {
    id: "preview",
    userId: user?.id ?? "",
    enabled: form.enabled,
    replyToEmail: form.replyToEmail.trim() || DEFAULT_EMAIL_REPLY_TO,
    displayName: form.displayName || null,
    title: form.title || null,
    phone: form.phone || null,
    logoUrl: form.logoUrl || null,
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
            Configuração pessoal da sua conta ({user?.email}). Cada usuário tem
            sua própria assinatura e corpo padrão de e-mail.
          </p>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <form className="settings-layout" onSubmit={save}>
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
              <input
                type="email"
                value={form.replyToEmail}
                onChange={(e) =>
                  setForm({ ...form, replyToEmail: e.target.value })
                }
                placeholder={DEFAULT_EMAIL_REPLY_TO}
                required
              />
            </label>
          </div>

          <p className="field-hint">
            Padrão da equipe: {DEFAULT_EMAIL_REPLY_TO}. Use um endereço real
            que você monitora (Outlook, Gmail, etc.).
          </p>
        </section>

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
                placeholder="https://… (opcional)"
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
  );
}
