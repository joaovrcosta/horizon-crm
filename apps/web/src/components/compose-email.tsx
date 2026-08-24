"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EmailSignature, Prompt, Prospect } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { EmailSignaturePreview } from "@/components/email-signature-preview";
import { IconEdit, IconMail, IconTrash, IconX } from "@/components/icons";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api-client";
import {
  buildHtmlSignature,
  buildPlainSignature,
  copyHtmlToClipboard,
} from "@/lib/email-signature";
import { applyPromptTemplate } from "@/lib/prospect-utils";

type ComposeContextValue = {
  open: (opts?: { to?: string; name?: string }) => void;
  close: () => void;
};

type RecipientSuggestion = {
  id: string;
  name: string;
  email: string;
};

const ComposeContext = createContext<ComposeContextValue | null>(null);
const SEARCH_DEBOUNCE_MS = 300;

export function useComposeEmail() {
  const ctx = useContext(ComposeContext);
  if (!ctx) {
    throw new Error("useComposeEmail must be used within ComposeEmailProvider");
  }
  return ctx;
}

export function ComposeEmailProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [promptId, setPromptId] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [signature, setSignature] = useState<EmailSignature | null>(null);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState("");
  const searchSeq = useRef(0);
  const toFieldRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setHint("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchingRecipients(false);
  }, []);

  const openCompose = useCallback((opts?: { to?: string; name?: string }) => {
    setToEmail(opts?.to ?? "");
    setToName(opts?.name ?? "");
    setToQuery(opts?.to ?? opts?.name ?? "");
    setSuggestions([]);
    setShowSuggestions(false);
    setSubject("");
    setBody("");
    setPromptId("");
    setHint("");
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingPrompts(true);

    void (async () => {
      try {
        const [promptList, sig] = await Promise.all([
          apiFetch<Prompt[]>("/prompts").catch(() => [] as Prompt[]),
          apiFetch<EmailSignature>("/settings/email-signature"),
        ]);
        if (cancelled) return;
        setPrompts(promptList);
        setSignature(sig);
        setIncludeSignature(sig.enabled);
        if (sig?.defaultIntro?.trim() && !body.trim()) {
          setBody(
            applyPromptTemplate(sig.defaultIntro, {
              name: toName,
              email: toEmail,
              consultantName: user?.name,
            }),
          );
        }
      } finally {
        if (!cancelled) setLoadingPrompts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only bootstrap when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const q = toQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearchingRecipients(false);
      return;
    }

    if (
      toEmail &&
      (q === toEmail || (toName && q === `${toName} <${toEmail}>`))
    ) {
      setSuggestions([]);
      return;
    }

    const seq = ++searchSeq.current;
    setSearchingRecipients(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await apiFetch<Prospect[]>(
            `/prospects?q=${encodeURIComponent(q)}`,
          );
          if (seq !== searchSeq.current) return;
          const withEmail = results
            .filter((p) => Boolean(p.email?.trim()))
            .slice(0, 8)
            .map((p) => ({
              id: p.id,
              name: p.name,
              email: p.email!.trim(),
            }));
          setSuggestions(withEmail);
          setShowSuggestions(true);
        } catch {
          if (seq !== searchSeq.current) return;
          setSuggestions([]);
        } finally {
          if (seq === searchSeq.current) setSearchingRecipients(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [open, toQuery, toEmail, toName]);

  useEffect(() => {
    if (!showSuggestions) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        toFieldRef.current &&
        !toFieldRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showSuggestions]);

  function selectRecipient(recipient: RecipientSuggestion) {
    setToEmail(recipient.email);
    setToName(recipient.name);
    setToQuery(recipient.email);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function onToQueryChange(value: string) {
    setToQuery(value);
    setShowSuggestions(true);
    setToEmail(value.includes("@") ? value.trim() : "");
    if (!value.includes("@")) setToName("");
  }

  function applyTemplate(id: string) {
    setPromptId(id);
    if (!id) return;
    const prompt = prompts.find((p) => p.id === id);
    if (!prompt) return;
    setBody(
      applyPromptTemplate(prompt.content, {
        name: toName,
        email: toEmail || toQuery,
        consultantName: user?.name,
      }),
    );
    if (!subject.trim()) setSubject(prompt.title);
  }

  async function copySignatureOnly() {
    if (!signature?.enabled) return;
    setHint("");
    try {
      const html = await buildHtmlSignature(signature, {
        fallbackName: user?.name,
        embedLogo: true,
      });
      const plain = buildPlainSignature(signature, {
        fallbackName: user?.name,
      });
      if (!html) return;
      const ok = await copyHtmlToClipboard(html, plain);
      setHint(
        ok
          ? "Assinatura com logo copiada (Ctrl+V)."
          : "Falha ao copiar. Verifique permissões do navegador.",
      );
    } catch {
      setHint("Erro ao gerar a assinatura com logo.");
    }
  }

  async function send() {
    const recipient = (toEmail || toQuery).trim();
    if (!recipient || !subject.trim() || !body.trim()) {
      setHint("Preencha destinatário, assunto e corpo.");
      return;
    }
    if (!recipient.includes("@")) {
      setHint("Informe um e-mail válido ou selecione um cliente.");
      return;
    }
    setSending(true);
    setHint("");
    try {
      const result = await apiFetch<{
        emailId: string | null;
        replyTo?: string | null;
      }>("/emails", {
        method: "POST",
        body: {
          to: recipient,
          subject: subject.trim(),
          body: body.trim(),
          includeSignature: includeSignature && Boolean(signature?.enabled),
        },
      });
      toast.success(
        `E-mail enviado. Respostas vão para ${result.replyTo ?? "hello@halk.solutions"}.`,
      );
      close();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao enviar e-mail";
      setHint(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  const value = useMemo(
    () => ({ open: openCompose, close }),
    [openCompose, close],
  );

  return (
    <ComposeContext.Provider value={value}>
      {children}
      {open ? (
        <div
          className="compose-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="compose-window"
            role="dialog"
            aria-modal="true"
            aria-label="Nova mensagem"
          >
            <header className="compose-header">
              <strong>Nova mensagem</strong>
              <button
                type="button"
                className="compose-icon-btn"
                aria-label="Fechar"
                onClick={close}
              >
                <IconX size={16} />
              </button>
            </header>

            <div className="compose-field compose-to" ref={toFieldRef}>
              <span className="compose-label">Para</span>
              <div className="compose-to-field">
                <input
                  className="compose-input"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={toQuery}
                  onChange={(e) => onToQueryChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Buscar cliente ou digitar e-mail"
                />
                {showSuggestions &&
                (searchingRecipients || suggestions.length > 0) ? (
                  <div className="compose-suggest" role="listbox">
                    {searchingRecipients && suggestions.length === 0 ? (
                      <div className="compose-suggest-empty">Buscando…</div>
                    ) : null}
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        className="compose-suggest-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectRecipient(item)}
                      >
                        <span className="compose-suggest-avatar" aria-hidden>
                          {item.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="compose-suggest-text">
                          <strong>{item.name}</strong>
                          <em>{item.email}</em>
                        </span>
                      </button>
                    ))}
                    {!searchingRecipients && suggestions.length === 0 ? (
                      <div className="compose-suggest-empty">
                        Nenhum cliente encontrado
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="compose-field">
              <span className="compose-label">Assunto</span>
              <input
                className="compose-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto"
              />
            </div>

            <div className="compose-field">
              <span className="compose-label">Template</span>
              <select
                className="compose-input"
                value={promptId}
                onChange={(e) => applyTemplate(e.target.value)}
                disabled={loadingPrompts}
              >
                <option value="">
                  {loadingPrompts
                    ? "Carregando…"
                    : "Nenhum (escrever manualmente)"}
                </option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.visibility === "PUBLIC" ? " · público" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="compose-body-wrap">
              <textarea
                className="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva sua mensagem…"
              />
              {signature && includeSignature && signature.enabled ? (
                <div className="compose-signature">
                  <EmailSignaturePreview
                    signature={signature}
                    fallbackName={user?.name}
                    compact
                  />
                </div>
              ) : null}
            </div>

            {!loadingPrompts && signature && !signature.id ? (
              <a href="/settings" className="compose-signature-alert">
                Você ainda não tem assinatura. Cadastrar assinatura
              </a>
            ) : null}

            {signature?.id ? (
              <label className="compose-signature-toggle">
                <input
                  type="checkbox"
                  checked={includeSignature && signature.enabled}
                  disabled={!signature.enabled}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                />
                Incluir assinatura
                {!signature.enabled ? " (desativada)" : ""}
              </label>
            ) : null}

            {hint ? (
              <p
                className={
                  hint.toLowerCase().includes("copiada")
                    ? "compose-hint ok"
                    : "compose-hint error"
                }
              >
                {hint}
              </p>
            ) : null}

            <footer className="compose-footer">
              <button
                type="button"
                className="compose-send"
                disabled={sending}
                onClick={() => void send()}
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
              <div className="compose-footer-tools">
                {signature?.enabled ? (
                  <button
                    type="button"
                    className="compose-icon-btn"
                    title="Copiar assinatura"
                    onClick={() => void copySignatureOnly()}
                  >
                    <IconMail size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="compose-icon-btn danger"
                  title="Descartar"
                  onClick={close}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </ComposeContext.Provider>
  );
}

/** Botão estilo Gmail para a sidebar */
export function ComposeSidebarButton({
  collapsed,
  onClick,
}: {
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const { open } = useComposeEmail();

  return (
    <button
      type="button"
      className={`sidebar-compose-btn${collapsed ? " collapsed" : ""}`}
      onClick={() => {
        open();
        onClick?.();
      }}
      title="Compose"
      aria-label="Compose"
    >
      <IconEdit size={16} />
      {!collapsed ? <span>Compose</span> : null}
    </button>
  );
}
