"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ComposeSidebarButton } from "@/components/compose-email";
import { useTheme } from "@/components/theme-provider";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconLogout,
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

const NAV = [
  { href: "/", label: "Dashboard", icon: IconDashboard, exact: true },
  { href: "/prospects", label: "Clientes", icon: IconProspects },
  { href: "/pipeline", label: "Funil", icon: IconPipeline },
  { href: "/prompts", label: "E-mail templates", icon: IconPrompt },
  { href: "/vaults", label: "Cofres", icon: IconVault },
  { href: "/settings", label: "Configurações", icon: IconSettings },
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
          <span className="sidebar-brand-text">horizon.</span>
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? " active" : ""}`}
              title={item.label}
              onClick={onMobileClose}
            >
              <span className="nav-icon">
                <Icon size={16} />
              </span>
              <span className="nav-label">{item.label}</span>
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
              <IconUsers size={16} />
            </span>
            <span className="nav-label">Usuários</span>
          </Link>
        )}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-item theme-toggle"
          onClick={toggleTheme}
          aria-label={
            theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
          }
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
        >
          <span className="nav-icon">
            {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </span>
          <span className="nav-label">
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </span>
        </button>

        <div className="user-card">
          <div className="avatar" aria-hidden title={user?.name}>
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
            <IconLogout size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
