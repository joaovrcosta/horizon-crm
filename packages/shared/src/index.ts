export type HealthStatus = {
  status: "ok" | "degraded" | "down";
  service: string;
  timestamp: string;
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
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

export type Prospect = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  mapsUrl: string | null;
  website: string | null;
  category: string | null;
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

export type ProspectStats = {
  total: number;
  byStatus: Record<ProspectStatus, number>;
  overdueCount: number;
  dueTodayCount: number;
  wonThisMonth: number;
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
  visibility: PromptVisibility;
  createdById: string;
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
