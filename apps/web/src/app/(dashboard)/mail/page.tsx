"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MailboxItem } from "@horizon/shared";
import { useComposeEmail } from "@/components/compose-email";
import {
  IconChevronLeft,
  IconEdit,
  IconMail,
  IconSearch,
  IconTrash,
} from "@/components/icons";
import { apiFetch } from "@/lib/api-client";
import { htmlToPlainText, prepareEmailMessageHtml } from "@/lib/email-body";
import { formatDateTime } from "@/lib/prospect-utils";

function snippet(text: string, max = 120) {
  const clean = htmlToPlainText(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

function formatListDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

function contactLabel(email: MailboxItem) {
  if (email.direction === "received") {
    return email.fromName?.trim() || email.prospectName?.trim() || email.fromEmail;
  }
  return email.toName?.trim() || email.prospectName?.trim() || email.toEmail;
}

function contactEmail(email: MailboxItem) {
  return email.direction === "received" ? email.fromEmail : email.toEmail;
}

export default function MailPage() {
  const { open: openCompose } = useComposeEmail();
  const [emails, setEmails] = useState<MailboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const path = appliedQuery.trim()
        ? `/emails?q=${encodeURIComponent(appliedQuery.trim())}`
        : "/emails";
      const data = await apiFetch<MailboxItem[]>(path);
      setEmails(data);
      setSelectedIds(new Set());
    } catch (err) {
      setEmails([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar e-mails");
    } finally {
      setLoading(false);
    }
  }, [appliedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => emails.find((item) => item.id === selectedId) ?? null,
    [emails, selectedId],
  );

  const allSelected =
    emails.length > 0 && emails.every((item) => selectedIds.has(item.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(emails.map((item) => item.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (selected) {
    const inbound = selected.direction === "received";
    return (
      <div className="mail-page">
        <div className="mail-toolbar">
          <button
            type="button"
            className="mail-toolbar-btn"
            onClick={() => setSelectedId(null)}
          >
            <IconChevronLeft size={16} />
            Voltar
          </button>
          <div className="mail-toolbar-spacer" />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openCompose()}
          >
            <IconEdit size={15} />
            Compose
          </button>
        </div>

        <article className="mail-reading">
          <header className="mail-reading-header">
            <h1>
              {inbound ? (
                <span className="mail-reply-badge">Resposta</span>
              ) : null}
              {selected.subject}
            </h1>
            <div className="mail-reading-meta">
              <div className="mail-reading-people">
                <span className="mail-reading-avatar" aria-hidden>
                  {contactLabel(selected).slice(0, 1).toUpperCase()}
                </span>
                <div>
                  {inbound ? (
                    <>
                      <strong>De {contactLabel(selected)}</strong>
                      <span>&lt;{selected.fromEmail}&gt;</span>
                      <span className="mail-reading-from">
                        Para {selected.toEmail}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Para {contactLabel(selected)}</strong>
                      <span>&lt;{selected.toEmail}&gt;</span>
                      <span className="mail-reading-from">
                        Enviado por {selected.userName}
                        {selected.replyTo
                          ? ` · Reply-To ${selected.replyTo}`
                          : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <time dateTime={selected.createdAt}>
                {formatDateTime(selected.createdAt)}
              </time>
            </div>
            {selected.prospectId ? (
              <Link
                className="mail-prospect-link"
                href={`/prospects?id=${selected.prospectId}`}
              >
                Abrir cliente
              </Link>
            ) : null}
          </header>
          <div
            className="mail-reading-body"
            dangerouslySetInnerHTML={{
              __html: prepareEmailMessageHtml(selected.body),
            }}
          />
        </article>
      </div>
    );
  }

  return (
    <div className="mail-page">
      <div className="mail-toolbar">
        <div className="mail-toolbar-left">
          <h1>
            E-mails
            <span className="count">{emails.length}</span>
          </h1>
        </div>
        <div className="mail-search">
          <IconSearch size={15} />
          <input
            type="search"
            placeholder="Buscar e-mails"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setAppliedQuery(query);
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openCompose()}
        >
          <IconEdit size={15} />
          Compose
        </button>
      </div>

      <div className="mail-table-wrap">
        <div className="mail-table-head">
          <label className="mail-check">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={emails.length === 0}
              aria-label="Selecionar todos"
            />
          </label>
          <span className="mail-col-to">Contato</span>
          <span className="mail-col-subject">Assunto</span>
          <span className="mail-col-date">Data</span>
        </div>

        {loading ? <p className="mail-status">Carregando…</p> : null}
        {!loading && error ? (
          <p className="mail-status mail-status-error">{error}</p>
        ) : null}
        {!loading && !error && emails.length === 0 ? (
          <div className="mail-empty">
            <IconMail size={28} />
            <p>Nenhum e-mail ainda.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openCompose()}
            >
              <IconEdit size={15} />
              Escrever e-mail
            </button>
          </div>
        ) : null}

        <div className="mail-table" role="list">
          {!loading &&
            emails.map((item) => {
              const checked = selectedIds.has(item.id);
              const isReply = item.direction === "received";
              return (
                <div
                  key={item.id}
                  role="listitem"
                  className={`mail-tr${checked ? " checked" : ""}${isReply ? " mail-tr-reply" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <label
                    className="mail-check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(item.id)}
                      aria-label={`Selecionar ${contactLabel(item)}`}
                    />
                  </label>
                  <span className="mail-col-to" title={contactEmail(item)}>
                    {isReply ? (
                      <span className="mail-reply-badge">Resposta</span>
                    ) : null}
                    {contactLabel(item)}
                  </span>
                  <span className="mail-col-subject">
                    <span className="mail-subject">{item.subject}</span>
                    <span className="mail-snippet">
                      {" — "}
                      {snippet(item.body)}
                    </span>
                  </span>
                  <span className="mail-col-date">
                    <time dateTime={item.createdAt}>
                      {formatListDate(item.createdAt)}
                    </time>
                    <span className="mail-row-actions">
                      <button
                        type="button"
                        className="mail-action-btn"
                        title="Excluir (em breve)"
                        disabled
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconTrash size={15} />
                      </button>
                    </span>
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
