import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  readSidebarCollapsedFromCookie,
  SIDEBAR_COLLAPSED_KEY,
} from "@/lib/sidebar-preference";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = readSidebarCollapsedFromCookie(
    cookieStore.get(SIDEBAR_COLLAPSED_KEY)?.value,
  );

  return (
    <DashboardShell initialSidebarCollapsed={initialSidebarCollapsed}>
      {children}
    </DashboardShell>
  );
}
