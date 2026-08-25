"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import type {
  ActivityType,
  EmailSignature,
  Prompt,
  Prospect,
  ProspectActivity,
  ProspectStatus,
  SiteQuality,
  UserOption,
} from "@horizon/shared";
import { PROSPECT_STATUSES, SITE_QUALITIES, SITE_QUALITY_LABELS, STATUS_LABELS } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";
import {
  buildHtmlSignature,
  buildPlainSignature,
  copyHtmlToClipboard,
} from "@/lib/email-signature";
import { EmailBodyEditor, EmailBodyToolbar, type EmailBodyEditorHandle } from "@/components/email-body-editor";
import { EmailSignaturePreview } from "@/components/email-signature-preview";
import { CountryFlag } from "@/components/country-flag";
import { CountrySelect } from "@/components/country-select";
import { TagInput } from "@/components/tag-input";
import { SiteQualityMeter } from "@/components/site-quality";
import { ProspectsListSkeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { fireConfetti } from "@/lib/confetti";
import {
  DEFAULT_EMAIL_FONT,
  htmlToPlainText,
  plainTextToEditorHtml,
} from "@/lib/email-body";
import {
  applyPromptTemplate,
  filterPromptsByCategory,
  formatDateTime,
  fromDatetimeLocalValue,
  isOverdue,
  toDatetimeLocalValue,
  toTelLink,
  toWhatsAppLink,
} from "@/lib/prospect-utils";
import {
  composeEmailSchema,
  type ComposeEmailValues,
} from "@/lib/compose-email-schema";
import {
  IconChevronDown,
  IconChevronLeft,
  IconCopy,
  IconEdit,
  IconFilter,
  IconMail,
  IconMapPin,
  IconMinus,
  IconPhone,
  IconPlus,
  IconTrash,
  IconWhatsApp,
  IconX,
} from "@/components/icons";
import { normalizeLinkHref } from "@/lib/email-body";

type FormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  mapsUrl: string;
  website: string;
  siteQuality: SiteQuality | "";
  category: string;
  country: string;
  languages: string[];
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
  siteQuality: "",
  category: "",
  country: "",
  languages: [],
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
    siteQuality: p.siteQuality ?? "",
    category: p.category ?? "",
    country: p.country ?? "",
    languages: p.languages ?? [],
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

const LIST_TABS: Array<{
  value: ProspectStatus;
  label: string;
  empty: string;
  className?: string;
}> = [
  { value: "NEW", label: "Novos", empty: "Nenhum cliente novo." },
  {
    value: "CONTACTED",
    label: "Contactados",
    empty: "Nenhum cliente contactado.",
    className: "tab-contacted",
  },
  {
    value: "NEGOTIATING",
    label: "Negociando",
    empty: "Nenhum cliente em negociação.",
  },
  { value: "WON", label: "Ganhos", empty: "Nenhum cliente ganho." },
  { value: "LOST", label: "Perdidos", empty: "Nenhum cliente perdido." },
];

export default function ProspectsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [createdFromFilter, setCreatedFromFilter] = useState("");
  const [createdToFilter, setCreatedToFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listTab, setListTab] = useState<ProspectStatus | "FILTER">("NEW");
  const filtersRef = useRef<HTMLDivElement>(null);
  const hadFiltersRef = useRef(false);
  const emailBodyEditorRef = useRef<EmailBodyEditorHandle>(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(user?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<ProspectActivity[]>([]);
  const [activityType, setActivityType] = useState<ActivityType>("NOTE");
  const [activityContent, setActivityContent] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "activity">(
    "overview",
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    () => Boolean(initialId),
  );

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailMinimized, setEmailMinimized] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [emailPromptId, setEmailPromptId] = useState("");
  const {
    register: registerEmail,
    control: emailControl,
    handleSubmit: handleEmailSubmit,
    reset: resetEmail,
    setValue: setEmailValue,
    getValues: getEmailValues,
    watch: watchEmail,
    setFocus: setEmailFocus,
  } = useForm<ComposeEmailValues>({
    resolver: zodResolver(composeEmailSchema),
    defaultValues: { to: "", subject: "", body: "" },
    mode: "onSubmit",
  });
  const emailSubject = watchEmail("subject");
  const [emailFontFamily, setEmailFontFamily] = useState<string>(DEFAULT_EMAIL_FONT);
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
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (dueFilter) params.set("due", dueFilter);
      if (assigneeFilter) params.set("assigneeId", assigneeFilter);
      if (countryFilter) params.set("country", countryFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (languageFilter) params.set("language", languageFilter);
      if (createdFromFilter) params.set("createdFrom", createdFromFilter);
      if (createdToFilter) params.set("createdTo", createdToFilter);
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
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
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
  }, [statusFilter, dueFilter, assigneeFilter, countryFilter, categoryFilter, languageFilter, createdFromFilter, createdToFilter]);

  useEffect(() => {
    if (!filtersOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (
        filtersRef.current &&
        !filtersRef.current.contains(event.target as Node)
      ) {
        setFiltersOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (selectedId) void loadActivities(selectedId);
    else setActivities([]);
  }, [selectedId]);

  useEffect(() => {
    setDetailTab("overview");
  }, [selectedId]);

  const activeFilterCount =
    [
      statusFilter,
      dueFilter,
      assigneeFilter,
      countryFilter,
      categoryFilter,
      languageFilter,
    ].filter(Boolean).length +
    (createdFromFilter || createdToFilter ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    if (hasActiveFilters && !hadFiltersRef.current) {
      setListTab("FILTER");
    } else if (!hasActiveFilters && listTab === "FILTER") {
      setListTab("NEW");
    }
    hadFiltersRef.current = hasActiveFilters;
  }, [hasActiveFilters, listTab]);

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm(user?.id ?? ""));
    setFormError("");
    setShowModal(true);
  }

  function openEditModal() {
    if (!selected) return;
    setEditingId(selected.id);
    setForm(prospectToForm(selected));
    setFormError("");
    setShowModal(true);
  }

  function closeProspectModal() {
    setShowModal(false);
    setEditingId(null);
    setFormError("");
    setForm(emptyForm(user?.id ?? ""));
  }

  async function saveProspect(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const payload = {
      ...form,
      category: form.category || null,
      languages: form.languages,
      country: form.country || null,
      website: form.website.trim() || null,
      siteQuality: form.siteQuality || null,
      mapsUrl: form.mapsUrl.trim() || null,
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
        setMobileDetailOpen(true);
        fireConfetti();
      }
    } catch (err) {
      setFormError(
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
      if (typeof patch.status === "string") {
        setListTab(patch.status as ProspectStatus);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!confirm(`Remover cliente "${selected.name}"?`)) return;
    try {
      await apiFetch<void>(`/prospects/${selected.id}`, { method: "DELETE" });
      setProspects((prev) => prev.filter((p) => p.id !== selected.id));
      setSelectedId(null);
      setMobileDetailOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
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
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setSavingActivity(false);
    }
  }

  async function openEmailModal() {
    if (!selected?.email) return;
    setEmailPromptId("");
    resetEmail({ to: selected.email, subject: "", body: "" });
    setEmailFontFamily(DEFAULT_EMAIL_FONT);
    setEmailClipboardHint("");
    setEmailMinimized(false);
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

      if (
        signature?.defaultIntro?.trim() &&
        !htmlToPlainText(getEmailValues("body"))
      ) {
        setEmailValue(
          "body",
          plainTextToEditorHtml(
            applyPromptTemplate(signature.defaultIntro, {
              name: selected.name,
              email: selected.email,
              phone: selected.phone || selected.whatsapp,
              address: selected.address,
              category: selected.category,
              website: selected.website,
              consultantName: user?.name,
            }),
          ),
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
    setEmailValue(
      "body",
      plainTextToEditorHtml(
        applyPromptTemplate(prompt.content, {
          name: selected.name,
          email: selected.email,
          phone: selected.phone || selected.whatsapp,
          address: selected.address,
          category: selected.category,
          website: selected.website,
          consultantName: user?.name,
        }),
      ),
    );
  }

  async function sendEmailViaResend(data: ComposeEmailValues) {
    if (!selected?.email) return;
    setOpeningEmail(true);
    setEmailClipboardHint("");
    try {
      const result = await apiFetch<{
        emailId: string | null;
        replyTo?: string | null;
        activity: ProspectActivity;
        statusUpdated: boolean;
      }>(`/prospects/${selected.id}/emails`, {
        method: "POST",
        body: {
          subject: data.subject,
          body: data.body.trim(),
          fontFamily: emailFontFamily,
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
        setListTab("CONTACTED");
      }
      setShowEmailModal(false);
      toast.success(`E-mail enviado. Respostas vão para ${result.replyTo ?? "hello@halk.solutions"}.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao enviar e-mail";
      setEmailClipboardHint(message);
      toast.error(message);
    } finally {
      setOpeningEmail(false);
    }
  }

  function onInvalidEmailSend(formErrors: FieldErrors<ComposeEmailValues>) {
    const message =
      formErrors.subject?.message ||
      formErrors.body?.message ||
      formErrors.to?.message ||
      "Preencha os campos obrigatórios.";
    setEmailClipboardHint(message);
    toast.error(message);
    if (formErrors.subject) {
      setEmailFocus("subject");
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

  async function copyField(label: string, value: string) {
    const text = value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}`);
    }
  }

  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(
      PROSPECT_STATUSES.map((status) => [status, 0]),
    ) as Record<ProspectStatus, number>;
    for (const p of prospects) {
      counts[p.status] += 1;
    }
    return counts;
  }, [prospects]);

  const categoryPrompts = useMemo(
    () => filterPromptsByCategory(prompts, selected?.category),
    [prompts, selected?.category],
  );

  useEffect(() => {
    if (emailPromptId && !categoryPrompts.some((p) => p.id === emailPromptId)) {
      setEmailPromptId("");
    }
  }, [categoryPrompts, emailPromptId]);

  const listed =
    listTab === "FILTER"
      ? prospects
      : prospects.filter((p) => p.status === listTab);
  const activeListTab =
    listTab === "FILTER"
      ? { label: "Filtro", count: prospects.length }
      : {
          label:
            LIST_TABS.find((tab) => tab.value === listTab)?.label ?? "Clientes",
          count: tabCounts[listTab],
        };
  const wa = selected
    ? toWhatsAppLink(selected.whatsapp || selected.phone)
    : null;
  const tel = selected
    ? toTelLink(selected.phone || selected.whatsapp)
    : null;

  function renderListItem(p: Prospect, compact = false) {
    return (
      <button
        key={p.id}
        type="button"
        className={`list-item${selectedId === p.id ? " selected" : ""}${
          p.status === "CONTACTED" ? " is-contacted" : ""
        }`}
        onClick={() => {
          setSelectedId(p.id);
          setMobileDetailOpen(true);
        }}
      >
        {p.country ? (
          <CountryFlag code={p.country} className="list-item-flag" />
        ) : null}
        <strong>{p.name}</strong>
        <span>
          {compact
            ? p.address || "—"
            : p.address || p.phone || p.email || "Sem contato"}
        </span>
        {!compact ? (
          <div className="meta">
            <span className={`status-pill status-${p.status}`}>
              {STATUS_LABELS[p.status]}
            </span>
            {p.category ? (
              <span className="tag-chip tag-chip-category">{p.category}</span>
            ) : null}
            {(p.languages ?? []).slice(0, 2).map((language) => (
              <span key={language} className="tag-chip tag-chip-language">
                {language}
              </span>
            ))}
            {p.siteQuality ? (
              <SiteQualityMeter value={p.siteQuality} />
            ) : null}
            {isOverdue(p.nextContactAt, p.status) ? (
              <span className="status-pill status-overdue">Atrasado</span>
            ) : null}
            <span className="meta-assignee">
              {p.assigneeName || "Sem responsável"}
            </span>
          </div>
        ) : null}
      </button>
    );
  }

  return (
    <div
      className={`split-view${mobileDetailOpen ? " mobile-detail-open" : ""}`}
    >
      <section className="list-pane">
        <div className="list-header">
          <h2>
            {activeListTab.label}
            <span className="count">{activeListTab.count}</span>
          </h2>
        </div>

        <div className="list-toolbar">
          <div className="list-toolbar-row">
            <input
              className="list-search"
              placeholder="Buscar nome, telefone, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
            <div className="filters-dropdown" ref={filtersRef}>
              <button
                type="button"
                className={`btn btn-secondary filters-trigger${activeFilterCount ? " has-filters" : ""}`}
                aria-expanded={filtersOpen}
                aria-haspopup="true"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <IconFilter size={15} />
                <span>Filtros</span>
                {activeFilterCount > 0 ? (
                  <span className="filters-badge">{activeFilterCount}</span>
                ) : null}
                <IconChevronDown
                  size={14}
                  className={filtersOpen ? "chevron-open" : undefined}
                />
              </button>

              {filtersOpen ? (
                <div className="filters-panel" role="dialog" aria-label="Filtros">
                  <label>
                    Status
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
                  </label>
                  <label>
                    Follow-up
                    <select
                      value={dueFilter}
                      onChange={(e) => setDueFilter(e.target.value)}
                    >
                      <option value="">Qualquer follow-up</option>
                      <option value="overdue">Atrasados</option>
                      <option value="today">Hoje</option>
                      <option value="upcoming">Próximos</option>
                    </select>
                  </label>
                  <div className="filters-date-group">
                    <span>Data de cadastro</span>
                    <div className="filters-date-range">
                      <label>
                        De
                        <input
                          type="date"
                          value={createdFromFilter}
                          max={createdToFilter || undefined}
                          onChange={(e) => setCreatedFromFilter(e.target.value)}
                        />
                      </label>
                      <label>
                        Até
                        <input
                          type="date"
                          value={createdToFilter}
                          min={createdFromFilter || undefined}
                          onChange={(e) => setCreatedToFilter(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                  <label>
                    Responsável
                    <select
                      value={assigneeFilter}
                      onChange={(e) => setAssigneeFilter(e.target.value)}
                    >
                      <option value="">Todos os responsáveis</option>
                      <option value="none">Sem responsável</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    País
                    <CountrySelect
                      value={countryFilter}
                      onChange={setCountryFilter}
                      placeholder="Todos os países"
                    />
                  </label>
                  <label>
                    Categoria
                    <TagInput
                      kind="CATEGORY"
                      value={categoryFilter ? [categoryFilter] : []}
                      onChange={(tags) => setCategoryFilter(tags[0] ?? "")}
                      max={1}
                      allowCreate={false}
                      placeholder="Todas as categorias"
                    />
                  </label>
                  <label>
                    Idioma
                    <TagInput
                      kind="LANGUAGE"
                      value={languageFilter ? [languageFilter] : []}
                      onChange={(tags) => setLanguageFilter(tags[0] ?? "")}
                      max={1}
                      allowCreate={false}
                      placeholder="Todos os idiomas"
                    />
                  </label>
                  <div className="filters-panel-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!activeFilterCount}
                      onClick={() => {
                        setStatusFilter("");
                        setDueFilter("");
                        setAssigneeFilter("");
                        setCountryFilter("");
                        setCategoryFilter("");
                        setLanguageFilter("");
                        setCreatedFromFilter("");
                        setCreatedToFilter("");
                      }}
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setFiltersOpen(false);
                        void load();
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="list-pane-tabs" role="tablist" aria-label="Lista de clientes">
          {hasActiveFilters ? (
            <button
              type="button"
              role="tab"
              aria-selected={listTab === "FILTER"}
              className={`list-pane-tab tab-filter${
                listTab === "FILTER" ? " active" : ""
              }`}
              onClick={() => setListTab("FILTER")}
            >
              Filtro
              <span className="count">{prospects.length}</span>
            </button>
          ) : null}
          {LIST_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={listTab === tab.value}
              className={`list-pane-tab${tab.className ? ` ${tab.className}` : ""}${
                listTab === tab.value ? " active" : ""
              }`}
              onClick={() => setListTab(tab.value)}
            >
              {tab.label}
              <span className="count">{tabCounts[tab.value]}</span>
            </button>
          ))}
        </div>

        <div className="list-items">
          {loading ? <ProspectsListSkeleton /> : null}

          {!loading && listed.length > 0
            ? listed.map((p) =>
                renderListItem(
                  p,
                  listTab === "WON" || listTab === "LOST",
                ),
              )
            : null}

          {!loading && prospects.length === 0 ? (
            <p className="list-empty">
              {hasActiveFilters
                ? "Nenhum cliente corresponde aos filtros."
                : "Nenhum cliente ainda. Adicione leads do Google Maps."}
            </p>
          ) : null}

          {!loading && prospects.length > 0 && listed.length === 0 ? (
            <p className="list-empty">
              {listTab === "FILTER"
                ? "Nenhum cliente corresponde aos filtros."
                : LIST_TABS.find((tab) => tab.value === listTab)?.empty}
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
            Adicionar cliente
          </button>
        </div>
      </section>

      <section className="detail-pane">
        {!selected ? (
          <div className="detail-empty">Selecione um cliente</div>
        ) : (
          <>
            <button
              type="button"
              className="detail-back"
              onClick={() => setMobileDetailOpen(false)}
            >
              <IconChevronLeft size={16} />
              Clientes
            </button>
            <div className="detail-tabs">
              <button
                type="button"
                className={detailTab === "overview" ? "active" : undefined}
                onClick={() => setDetailTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={detailTab === "activity" ? "active" : undefined}
                onClick={() => setDetailTab("activity")}
              >
                Atividade
                {activities.length > 0 ? (
                  <span className="detail-tab-count">{activities.length}</span>
                ) : null}
              </button>
            </div>

            {detailTab === "overview" ? (
              <>
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
                  <dd>
                    <TagInput
                      kind="CATEGORY"
                      value={selected.category ? [selected.category] : []}
                      onChange={(tags) => {
                        const next = tags[0] ?? null;
                        if ((selected.category ?? null) !== next) {
                          void updateSelected({ category: next });
                        }
                      }}
                      max={1}
                      placeholder="Ex.: Arquitetura"
                    />
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>País</dt>
                  <dd>
                    <CountrySelect
                      value={selected.country ?? ""}
                      onChange={(country) => {
                        const next = country || null;
                        if ((selected.country ?? "") !== (country || "")) {
                          void updateSelected({ country: next });
                        }
                      }}
                    />
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Idiomas</dt>
                  <dd>
                    <TagInput
                      kind="LANGUAGE"
                      value={selected.languages ?? []}
                      onChange={(tags) => {
                        const prev = selected.languages ?? [];
                        if (tags.join("|") !== prev.join("|")) {
                          void updateSelected({ languages: tags });
                        }
                      }}
                      placeholder="Ex.: Português, Inglês"
                    />
                  </dd>
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
                      <span className="kv-copyable">
                        <a href={`mailto:${selected.email}`}>{selected.email}</a>
                        <button
                          type="button"
                          className="kv-copy-btn"
                          title="Copiar e-mail"
                          aria-label="Copiar e-mail"
                          onClick={() =>
                            void copyField("E-mail", selected.email!)
                          }
                        >
                          <IconCopy size={13} />
                        </button>
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Site</dt>
                  <dd>
                    {selected.website ? (
                      <span className="kv-copyable">
                        <a
                          href={normalizeLinkHref(selected.website)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {selected.website.replace(/^https?:\/\//i, "")}
                        </a>
                        <button
                          type="button"
                          className="kv-copy-btn"
                          title="Copiar site"
                          aria-label="Copiar site"
                          onClick={() =>
                            void copyField("Site", selected.website!)
                          }
                        >
                          <IconCopy size={13} />
                        </button>
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Qualidade do site</dt>
                  <dd>
                    <select
                      value={selected.siteQuality ?? ""}
                      onChange={(e) =>
                        void updateSelected({
                          siteQuality: (e.target.value || null) as
                            | SiteQuality
                            | null,
                        })
                      }
                    >
                      <option value="">Não informado</option>
                      {SITE_QUALITIES.map((quality) => (
                        <option key={quality} value={quality}>
                          {SITE_QUALITY_LABELS[quality]}
                        </option>
                      ))}
                    </select>
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
              </>
            ) : (
            <div className="detail-section">
              <h3>Histórico</h3>
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
            )}
          </>
        )}
      </section>

      {showModal ? (
        <div className="modal-backdrop">
          <form className="modal modal-wide" onSubmit={saveProspect}>
            <h2>{editingId ? "Editar cliente" : "Novo cliente"}</h2>
            {formError ? <p className="form-error">{formError}</p> : null}
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
                <TagInput
                  kind="CATEGORY"
                  value={form.category ? [form.category] : []}
                  onChange={(tags) =>
                    setForm({ ...form, category: tags[0] ?? "" })
                  }
                  max={1}
                  placeholder="Ex.: Arquitetura"
                />
              </label>
              <label>
                País
                <CountrySelect
                  value={form.country}
                  onChange={(country) =>
                    setForm({ ...form, country })
                  }
                />
              </label>
              <label>
                Idiomas
                <TagInput
                  kind="LANGUAGE"
                  value={form.languages}
                  onChange={(languages) => setForm({ ...form, languages })}
                  placeholder="Ex.: Português"
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
                Website (opcional)
                <input
                  type="text"
                  inputMode="url"
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                  placeholder="exemplo.com.br"
                />
              </label>
              <label>
                Qualidade do site
                <select
                  value={form.siteQuality}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      siteQuality: e.target.value as SiteQuality | "",
                    })
                  }
                >
                  <option value="">Não informado</option>
                  {SITE_QUALITIES.map((quality) => (
                    <option key={quality} value={quality}>
                      {SITE_QUALITY_LABELS[quality]}
                    </option>
                  ))}
                </select>
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
          className={`compose-backdrop${emailMinimized ? " is-minimized" : ""}`}
        >
          <div
            className={`compose-window${emailMinimized ? " is-minimized" : ""}`}
            role="dialog"
            aria-modal={!emailMinimized}
            aria-label="Nova mensagem"
          >
            <header
              className="compose-header"
              onClick={() => setEmailMinimized((v) => !v)}
              title={emailMinimized ? "Expandir" : "Minimizar"}
            >
              <strong>{emailSubject.trim() || "Nova mensagem"}</strong>
              <div
                className="compose-header-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="compose-icon-btn"
                  aria-label={emailMinimized ? "Expandir" : "Minimizar"}
                  title={emailMinimized ? "Expandir" : "Minimizar"}
                  onClick={() => setEmailMinimized((v) => !v)}
                >
                  <IconMinus size={16} />
                </button>
                <button
                  type="button"
                  className="compose-icon-btn"
                  aria-label="Fechar"
                  onClick={() => {
                    setEmailMinimized(false);
                    setShowEmailModal(false);
                  }}
                >
                  <IconX size={16} />
                </button>
              </div>
            </header>

            <div className="compose-window-body">
            <div className="compose-field compose-to">
              <span className="compose-label">Para</span>
              <div className="compose-chip">
                <span className="compose-chip-avatar" aria-hidden>
                  {selected.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="compose-chip-text">
                  <strong>{selected.name}</strong>
                  <em>{selected.email}</em>
                </span>
              </div>
            </div>

            <div className="compose-field">
              <span className="compose-label">Assunto</span>
              <input
                className="compose-input"
                placeholder="Assunto"
                {...registerEmail("subject")}
              />
            </div>

            <div className="compose-field compose-template">
              <span className="compose-label">Template</span>
              <select
                className="compose-input"
                value={emailPromptId}
                onChange={(e) => applyEmailPrompt(e.target.value)}
                disabled={loadingPrompts}
              >
                <option value="">
                  {loadingPrompts
                    ? "Carregando…"
                    : selected?.category && categoryPrompts.length === 0
                      ? `Nenhum template para ${selected.category}`
                      : "Nenhum (escrever manualmente)"}
                </option>
                {categoryPrompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.visibility === "PUBLIC" ? " · público" : ""}
                  </option>
                ))}
              </select>
              {selected?.category ? (
                <p className="field-hint">
                  Mostrando templates da categoria {selected.category}.
                </p>
              ) : (
                <p className="field-hint">
                  Cliente sem categoria — todos os templates. Defina a
                  categoria no cadastro para filtrar.
                </p>
              )}
            </div>

            <div className="compose-body-wrap">
              <Controller
                name="body"
                control={emailControl}
                render={({ field }) => (
                  <EmailBodyEditor
                    ref={emailBodyEditorRef}
                    value={field.value}
                    onChange={field.onChange}
                    fontFamily={emailFontFamily}
                    placeholder="Escreva sua mensagem…"
                  />
                )}
              />
              {emailSignature && includeSignature && emailSignature.enabled ? (
                <div className="compose-signature">
                  <EmailSignaturePreview
                    signature={emailSignature}
                    fallbackName={user?.name}
                    compact
                  />
                </div>
              ) : null}
            </div>

            {!loadingPrompts && emailSignature && !emailSignature.id ? (
              <a href="/settings" className="compose-signature-alert">
                Você ainda não tem assinatura. Cadastrar assinatura
              </a>
            ) : null}

            {emailSignature?.id ? (
              <label className="compose-signature-toggle">
                <input
                  type="checkbox"
                  checked={includeSignature && emailSignature.enabled}
                  disabled={!emailSignature.enabled}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                />
                Incluir assinatura
                {!emailSignature.enabled ? " (desativada)" : ""}
              </label>
            ) : null}

            {emailClipboardHint ? (
              <p
                className={
                  emailClipboardHint.toLowerCase().includes("sucesso") ||
                  emailClipboardHint.toLowerCase().includes("copiada")
                    ? "compose-hint ok"
                    : "compose-hint error"
                }
              >
                {emailClipboardHint}
              </p>
            ) : null}

            <footer className="compose-footer">
              <button
                type="button"
                className="compose-send"
                disabled={openingEmail}
                onClick={() =>
                  void handleEmailSubmit(sendEmailViaResend, onInvalidEmailSend)()
                }
              >
                {openingEmail ? "Enviando…" : "Enviar"}
              </button>
              <div className="compose-footer-right">
                <EmailBodyToolbar
                  fontFamily={emailFontFamily}
                  onFontFamilyChange={setEmailFontFamily}
                  onInsertLink={() => emailBodyEditorRef.current?.insertLink()}
                />
                <div className="compose-footer-tools">
                  {emailSignature?.enabled ? (
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
                    onClick={() => {
                      setEmailMinimized(false);
                      setShowEmailModal(false);
                    }}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            </footer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
