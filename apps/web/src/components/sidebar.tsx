"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ComposeSidebarButton } from "@/components/compose-email";
import { DailyGoalWidget } from "@/components/daily-goal-widget";
import { useDailyGoalOptional } from "@/components/daily-goal-provider";
import { useTheme } from "@/components/theme-provider";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconLogout,
  IconMail,
  IconMoon,
  IconPipeline,
  IconPrompt,
  IconProspects,
  IconSettings,
  IconSun,
  IconUsers,
  IconVault,
  IconX,
} from "@/components/icons";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useMailUnreadCount } from "@/hooks/use-mail-unread-count";

const NAV = [
  { href: "/", label: "Dashboard", icon: IconDashboard, exact: true },
  { href: "/prospects", label: "Clientes", icon: IconProspects },
  { href: "/mail", label: "E-mails", icon: IconMail },
  { href: "/pipeline", label: "Funil", icon: IconPipeline },
  { href: "/prompts", label: "Templates", icon: IconPrompt },
  { href: "/vaults", label: "Cofres", icon: IconVault },
] as const;

export function Sidebar({
  initialCollapsed = true,
  onMobileClose,
}: {
  initialCollapsed?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, setCollapsed } = useSidebarCollapsed(initialCollapsed);
  const mailUnreadCount = useMailUnreadCount();
  const dailyGoal = useDailyGoalOptional();

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <aside
      id="app-sidebar"
      className={`sidebar${collapsed ? " collapsed" : ""}`}
    >
      <div className="sidebar-brand-row">
        <div className="sidebar-brand" title="Horizon">
          <img
            src="/brand/horizon-logo.svg"
            alt="Horizon"
            className="sidebar-brand-logo"
            width={85}
            height={28}
          />
          <div className="sidebar-brand-copy">
            <span className="sidebar-brand-text">horizon.</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
          title={collapsed ? "Expandir menu" : "Minimizar menu"}
        >
          {collapsed ? (
            <IconChevronRight size={16} />
          ) : (
            <IconChevronLeft size={16} />
          )}
        </button>
        <button
          type="button"
          className="sidebar-close-mobile"
          onClick={onMobileClose}
          aria-label="Fechar menu"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="sidebar-compose">
        <ComposeSidebarButton
          collapsed={collapsed}
          onClick={onMobileClose}
        />
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => {
          const active =
            "exact" in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showMailBadge =
            item.href === "/mail" && mailUnreadCount > 0;
          const badgeLabel =
            mailUnreadCount > 99 ? "99+" : String(mailUnreadCount);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? " active" : ""}`}
              title={
                showMailBadge
                  ? `${item.label} (${badgeLabel} novos)`
                  : item.label
              }
              onClick={onMobileClose}
            >
              <span className="nav-icon">
                <Icon size={17} />
                {showMailBadge && collapsed ? (
                  <span className="nav-badge nav-badge-dot" aria-hidden>
                    {badgeLabel}
                  </span>
                ) : null}
              </span>
              <span className="nav-label">{item.label}</span>
              {showMailBadge && !collapsed ? (
                <span className="nav-badge" aria-label={`${badgeLabel} novos`}>
                  {badgeLabel}
                </span>
              ) : null}
            </Link>
          );
        })}

        {can("users:read") && (
          <Link
            href="/users"
            className={`nav-item${pathname.startsWith("/users") ? " active" : ""}`}
            title="Usuários"
            onClick={onMobileClose}
          >
            <span className="nav-icon">
              <IconUsers size={17} />
            </span>
            <span className="nav-label">Usuários</span>
          </Link>
        )}
      </nav>

      {dailyGoal?.progress?.visible && !collapsed ? (
        <div className="sidebar-daily-goal">
          <DailyGoalWidget
            progress={dailyGoal.progress}
            loading={dailyGoal.loading}
            compact
          />
        </div>
      ) : null}

      <div className="sidebar-footer">
        <div className="sidebar-user-card" title={user?.email}>
          <div className="avatar" aria-hidden>
            {(user?.name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="user-meta">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            title="Sair"
            aria-label="Sair"
          >
            <IconLogout size={15} />
          </button>
        </div>

        <Link
          href="/settings"
          className={`nav-item nav-item-footer${
            pathname.startsWith("/settings") ? " active" : ""
          }`}
          title="Configurações"
          onClick={onMobileClose}
        >
          <span className="nav-icon">
            <IconSettings size={17} />
          </span>
          <span className="nav-label">Configurações</span>
          <IconChevronRight size={14} className="nav-chevron" />
        </Link>

        <button
          type="button"
          className="nav-item nav-item-footer theme-toggle"
          onClick={toggleTheme}
          aria-label={
            theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
          }
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
        >
          <span className="nav-icon">
            {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
          </span>
          <span className="nav-label">
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </span>
          <IconChevronRight size={14} className="nav-chevron" />
        </button>
      </div>
    </aside>
  );
}
