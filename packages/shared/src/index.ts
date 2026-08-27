export type HealthStatus = {
  status: "ok" | "degraded" | "down";
  service: string;
  timestamp: string;
};

export type DailyGoalToday = {
  visible: boolean;
  target: number;
  completed: number;
  remaining: number;
  reached: boolean;
};

export type DailyGoalConfigUser = {
  userId: string;
  userName: string;
  userEmail: string;
  targetCount: number;
  enabled: boolean;
  completedToday: number;
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
  dailyGoal?: DailyGoalToday;
};

export type ApiError = {
  error: string;
  details?: unknown;
};

export type {
  AuthSession,
  PermissionKey,
  RolePublic,
} from "./rbac";
export {
  hasAnyPermission,
  hasPermission,
  PERMISSION_KEYS,
} from "./rbac";

export type ProspectStatus =
  | "NEW"
  | "CONTACTED"
  | "NEGOTIATING"
  | "WON"
  | "LOST";

export type SiteQuality = "NO_SITE" | "LOW" | "MEDIUM" | "HIGH";

export type ActivityType =
  | "NOTE"
  | "CALL"
  | "WHATSAPP"
  | "VISIT"
  | "EMAIL"
  | "STATUS_CHANGE"
  | "OTHER";

import type { RolePublic } from "./rbac";

export type UserPublic = {
  id: string;
  email: string;
  name: string;
  role: RolePublic;
  createdAt: string;
};

export type UserOption = {
  id: string;
  name: string;
};

import type { PermissionKey } from "./rbac";

export type AuthLoginResponse = {
  accessToken: string;
  user: UserPublic;
  permissions: PermissionKey[];
};

export type ProspectTagKind = "CATEGORY" | "LANGUAGE";

export type ProspectTag = {
  id: string;
  kind: ProspectTagKind;
  name: string;
};

export type Prospect = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  mapsUrl: string | null;
  website: string | null;
  siteQuality: SiteQuality | null;
  category: string | null;
  country: string | null; // ISO 3166-1 alpha-2 (ex.: BR)
  languages: string[];
  status: ProspectStatus;
  notes: string | null;
  lostReason: string | null;
  estimatedValue: number | null;
  nextContactAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
};

export type ProspectActivity = {
  id: string;
  prospectId: string;
  userId: string;
  userName: string;
  type: ActivityType;
  content: string;
  createdAt: string;
};

export type MetricTrend = {
  /** Variação percentual vs período anterior */
  percent: number;
  /** Variação absoluta vs período anterior */
  delta: number;
};

export type StatsPeriod = {
  days: number | null;
  from: string;
  to: string;
  compareLabel: string;
};

export type ProspectStats = {
  total: number;
  byStatus: Record<ProspectStatus, number>;
  overdueCount: number;
  dueTodayCount: number;
  wonThisMonth: number;
  period: StatsPeriod;
  trends: {
    total: MetricTrend;
    overdue: MetricTrend;
    dueToday: MetricTrend;
    wonThisMonth: MetricTrend;
  };
  overdue: Array<{
    id: string;
    name: string;
    nextContactAt: string;
    assigneeName: string | null;
    status: ProspectStatus;
  }>;
};

export type PromptVisibility = "PUBLIC" | "PRIVATE";

export type Prompt = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  languages: string[];
  visibility: PromptVisibility;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type Vault = {
  id: string;
  name: string;
  description: string | null;
  visibility: PromptVisibility;
  createdById: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type VaultItem = {
  id: string;
  vaultId: string;
  title: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EmailSignature = {
  id: string;
  userId: string;
  enabled: boolean;
  replyToEmail: string | null;
  displayName: string | null;
  title: string | null;
  phone: string | null;
  logoUrl: string | null;
  company: string | null;
  tagline: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  website: string | null;
  defaultIntro: string | null;
  updatedAt: string;
};

export type SentEmail = {
  id: string;
  userId: string;
  userName: string;
  prospectId: string | null;
  prospectName: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  body: string;
  replyTo: string | null;
  providerId: string | null;
  deliveryStatus: EmailDeliveryStatus;
  deliveredAt: string | null;
  createdAt: string;
};

export type EmailDeliveryStatus =
  | "SENT"
  | "DELIVERED"
  | "BOUNCED"
  | "FAILED"
  | "COMPLAINED";

export const EMAIL_DELIVERY_STATUS_LABELS: Record<EmailDeliveryStatus, string> = {
  SENT: "Enviado",
  DELIVERED: "Entregue",
  BOUNCED: "Bounce",
  FAILED: "Falhou",
  COMPLAINED: "Spam",
};

export type MailDirection = "sent" | "received";

export type MailFolder = "all" | "sent" | "received";

export type MailboxItem = {
  id: string;
  direction: MailDirection;
  isReply: boolean;
  unread: boolean;
  userId: string | null;
  userName: string | null;
  prospectId: string | null;
  prospectName: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  body: string;
  replyTo: string | null;
  providerId: string | null;
  deliveryStatus: EmailDeliveryStatus | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type MailboxPage = {
  items: MailboxItem[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
};

export type EmailSignatureInput = {
  enabled: boolean;
  replyToEmail: string | null;
  displayName: string | null;
  title: string | null;
  phone: string | null;
  logoUrl: string | null;
  company: string | null;
  tagline: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  website: string | null;
  defaultIntro: string | null;
};

export const DEFAULT_EMAIL_REPLY_TO = "hello@halk.solutions";

export const DEFAULT_EMAIL_LOGO_URL =
  "https://raw.githubusercontent.com/joaovrcosta/code-icons/main/halk-logo-blue-gradient.png";

export const PROMPT_VISIBILITIES: PromptVisibility[] = ["PUBLIC", "PRIVATE"];

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "WON",
  "LOST",
];

export const ACTIVITY_TYPES: ActivityType[] = [
  "NOTE",
  "CALL",
  "WHATSAPP",
  "VISIT",
  "EMAIL",
  "STATUS_CHANGE",
  "OTHER",
];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contactado",
  NEGOTIATING: "Negociando",
  WON: "Ganho",
  LOST: "Perdido",
};

export const SITE_QUALITIES: SiteQuality[] = ["NO_SITE", "LOW", "MEDIUM", "HIGH"];

export const SITE_QUALITY_LABELS: Record<SiteQuality, string> = {
  NO_SITE: "Sem site",
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
};

export function createHealthStatus(service: string): HealthStatus {
  return {
    status: "ok",
    service,
    timestamp: new Date().toISOString(),
  };
}

export function digitsOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length ? digits : null;
}

export type { CountryOption } from "./countries";
export {
  getCountryName,
  getCountryFilterValues,
  getCountryOptions,
  normalizeCountryCode,
} from "./countries";
