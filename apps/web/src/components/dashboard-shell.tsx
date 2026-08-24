"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { ComposeEmailProvider } from "@/components/compose-email";
import { Sidebar } from "@/components/sidebar";
import { IconMenu } from "@/components/icons";

export function DashboardShell({
  children,
  initialSidebarCollapsed = true,
}: {
  children: React.ReactNode;
  initialSidebarCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  return (
    <AuthGuard initialSidebarCollapsed={initialSidebarCollapsed}>
      <ComposeEmailProvider>
        <div className={`dashboard${mobileNavOpen ? " mobile-nav-open" : ""}`}>
          <header className="mobile-topbar">
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label="Abrir menu"
              aria-expanded={mobileNavOpen}
              aria-controls="app-sidebar"
              onClick={() => setMobileNavOpen(true)}
            >
              <IconMenu size={20} />
            </button>
            <div className="mobile-topbar-brand">
              <img
                src="/brand/horizon-logo.svg"
                alt=""
                className="mobile-topbar-logo"
                width={85}
                height={28}
              />
              <span>horizon.</span>
            </div>
          </header>
          <button
            type="button"
            className="mobile-nav-backdrop"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setMobileNavOpen(false)}
          />
          <Sidebar
            initialCollapsed={initialSidebarCollapsed}
            onMobileClose={() => setMobileNavOpen(false)}
          />
          <div className="dashboard-main">{children}</div>
        </div>
      </ComposeEmailProvider>
    </AuthGuard>
  );
}
