export function pageTitleFromPathname(pathname: string) {
  if (pathname.startsWith("/prospects")) return "Clientes";
  if (pathname.startsWith("/mail")) return "E-mails";
  if (pathname.startsWith("/pipeline")) return "Funil";
  if (pathname.startsWith("/prompts")) return "Templates";
  if (pathname.startsWith("/vaults")) return "Cofres";
  if (pathname.startsWith("/users")) return "Usuários";
  if (pathname.startsWith("/settings")) return "Configurações";
  if (pathname === "/" || pathname === "") return "Dashboard";
  return "Horizon";
}
