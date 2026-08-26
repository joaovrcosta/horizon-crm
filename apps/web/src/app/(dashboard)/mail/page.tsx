"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  EmailDeliveryStatus,
  MailFolder,
  MailboxItem,
  MailboxPage,
} from "@horizon/shared";
import { EMAIL_DELIVERY_STATUS_LABELS } from "@horizon/shared";
import { useComposeEmail } from "@/components/compose-email";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconMail,
  IconReply,
  IconSearch,
  IconTrash,
} from "@/components/icons";
import { useToast } from "@/components/toast";
import { MailListSkeleton, MailSkeleton } from "@/components/skeleton";
import { apiFetch } from "@/lib/api-client";
import { htmlToPlainText, prepareEmailMessageHtml } from "@/lib/email-body";
import { formatDateTime } from "@/lib/prospect-utils";
import { notifyMailUnreadRefresh } from "@/hooks/use-mail-unread-count";

const PAGE_SIZE = 50;

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

function formatPager(page: number, pageSize: number, total: number) {
  if (total === 0) return "0–0 de 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}–${end} de ${total.toLocaleString("pt-BR")}`;
}

function deliveryLabel(status: EmailDeliveryStatus | null | undefined) {
  if (!status || status === "SENT") return null;
  return EMAIL_DELIVERY_STATUS_LABELS[status];
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

function replySubject(subject: string) {
  const trimmed = subject.trim() || "(sem assunto)";
  return /^(re|res)\s*:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

const FOLDERS: { id: MailFolder; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "received", label: "Recebidos" },
  { id: "sent", label: "Enviados" },
];

function parseMailboxPage(data: MailboxPage | MailboxItem[] | null | undefined): MailboxPage {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: PAGE_SIZE,
      unreadCount: 0,
    };
  }
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? PAGE_SIZE,
    unreadCount: data?.unreadCount ?? 0,
  };
}

export default function MailPage() {
  const { open: openCompose } = useComposeEmail();
  const toast = useToast();
  const [emails, setEmails] = useState<MailboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [folder, setFolder] = useState<MailFolder>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        folder,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (appliedQuery.trim()) params.set("q", appliedQuery.trim());
      const data = parseMailboxPage(
        await apiFetch<MailboxPage | MailboxItem[]>(`/emails?${params.toString()}`),
      );
      setEmails(data.items);
      setTotal(data.total);
      setUnreadCount(data.unreadCount);
      setSelectedIds(new Set());
      const maxPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE) || 1);
      if (page > maxPage) setPage(maxPage);
    } catch (err) {
      setEmails([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "Erro ao carregar e-mails");
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, folder, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onMailChanged() {
      void load();
    }
    window.addEventListener("horizon-mail-changed", onMailChanged);
    return () => window.removeEventListener("horizon-mail-changed", onMailChanged);
  }, [load]);

  const selected = useMemo(
    () => (emails ?? []).find((item) => item.id === selectedId) ?? null,
    [emails, selectedId],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < pageCount && total > 0;

  const allSelected =
    (emails?.length ?? 0) > 0 &&
    emails.every((item) => selectedIds.has(item.id));

  function changeFolder(next: MailFolder) {
    setFolder(next);
    setPage(1);
    setSelectedId(null);
  }

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

  function markLocalRead(id: string) {
    setEmails((prev) =>
      (prev ?? []).map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    notifyMailUnreadRefresh();
  }

  function openEmail(item: MailboxItem) {
    setSelectedId(item.id);
    setOpenedIds((prev) => {
      if (prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    if (item.direction === "received" && item.unread) {
      markLocalRead(item.id);
      void apiFetch<{ ok: boolean }>(
        `/emails/${encodeURIComponent(item.id)}/read`,
        { method: "PATCH" },
      ).catch(() => {
        /* a lista recarrega no próximo load */
      });
    }
  }

  function startReply(item: MailboxItem) {
    openCompose({
      to: item.fromEmail,
      name: item.fromName?.trim() || item.prospectName || undefined,
      subject: replySubject(item.subject),
      reply: true,
    });
  }

  async function deleteEmails(ids: string[]) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0 || deleting) return;
    setDeleting(true);
    try {
      await apiFetch("/emails/bulk-delete", {
        method: "POST",
        body: { ids: unique },
      });
      toast.success(
        unique.length === 1
          ? "E-mail excluído."
          : `${unique.length} e-mails excluídos.`,
      );
      if (selectedId && unique.includes(selectedId)) setSelectedId(null);
      setSelectedIds(new Set());
      await load();
      notifyMailUnreadRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir");
    } finally {
      setDeleting(false);
    }
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
          {inbound ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => startReply(selected)}
            >
              <IconReply size={15} />
              Responder
            </button>
          ) : null}
          <button
            type="button"
            className="mail-toolbar-btn"
            disabled={deleting}
            onClick={() => void deleteEmails([selected.id])}
          >
            <IconTrash size={15} />
            Excluir
          </button>
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
              {!inbound && deliveryLabel(selected.deliveryStatus) ? (
                <span
                  className={`mail-delivery-badge mail-delivery-${selected.deliveryStatus?.toLowerCase()}`}
                >
                  {deliveryLabel(selected.deliveryStatus)}
                </span>
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
                        {selected.deliveredAt
                          ? ` · Entregue ${formatDateTime(selected.deliveredAt)}`
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

  if (loading && emails.length === 0) {
    return <MailSkeleton />;
  }

  const emptyLabel =
    folder === "received"
      ? "Nenhum e-mail recebido."
      : folder === "sent"
        ? "Nenhum e-mail enviado."
        : "Nenhum e-mail ainda.";

  return (
    <div className="mail-page">
      <div className="mail-toolbar">
        <div className="mail-folders" role="tablist" aria-label="Pastas">
          {FOLDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={folder === item.id}
              className={`mail-folder${folder === item.id ? " active" : ""}`}
              onClick={() => changeFolder(item.id)}
            >
              {item.label}
              {item.id === "received" && unreadCount > 0 ? (
                <span className="mail-unread-count">{unreadCount}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="mail-search">
          <IconSearch size={15} />
          <input
            type="search"
            placeholder="Buscar e-mails"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setAppliedQuery(query);
              }
            }}
          />
        </div>
        <div className="mail-pager">
          <span className="mail-pager-range">
            {formatPager(page, PAGE_SIZE, total)}
          </span>
          <button
            type="button"
            className="mail-pager-btn"
            disabled={!canPrev || loading}
            aria-label="Página anterior"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="mail-pager-btn"
            disabled={!canNext || loading}
            aria-label="Próxima página"
            onClick={() => setPage((p) => p + 1)}
          >
            <IconChevronRight size={16} />
          </button>
        </div>
        {selectedIds.size > 0 ? (
          <button
            type="button"
            className="mail-toolbar-btn"
            disabled={deleting}
            onClick={() => void deleteEmails([...selectedIds])}
          >
            <IconTrash size={15} />
            Excluir {selectedIds.size}
          </button>
        ) : null}
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

        {loading ? <MailListSkeleton rows={10} /> : null}
        {!loading && error ? (
          <p className="mail-status mail-status-error">{error}</p>
        ) : null}
        {!loading && !error && emails.length === 0 ? (
          <div className="mail-empty">
            <IconMail size={28} />
            <p>{emptyLabel}</p>
            {folder !== "received" ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openCompose()}
              >
                <IconEdit size={15} />
                Escrever e-mail
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mail-table" role="list">
          {!loading &&
            emails.map((item) => {
              const checked = selectedIds.has(item.id);
              const isReply = item.direction === "received";
              const isUnread =
                item.direction === "received"
                  ? item.unread
                  : !openedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  role="listitem"
                  className={`mail-tr${checked ? " checked" : ""}${
                    isReply ? " mail-tr-reply" : ""
                  }${isUnread ? " mail-tr-unread" : " mail-tr-read"}`}
                  onClick={() => openEmail(item)}
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
                    {!isReply && deliveryLabel(item.deliveryStatus) ? (
                      <span
                        className={`mail-delivery-badge mail-delivery-${item.deliveryStatus?.toLowerCase()}`}
                      >
                        {deliveryLabel(item.deliveryStatus)}
                      </span>
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
                      {isReply ? (
                        <button
                          type="button"
                          className="mail-action-btn"
                          title="Responder"
                          onClick={(e) => {
                            e.stopPropagation();
                            startReply(item);
                          }}
                        >
                          <IconReply size={15} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="mail-action-btn"
                        title="Excluir"
                        disabled={deleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteEmails([item.id]);
                        }}
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
