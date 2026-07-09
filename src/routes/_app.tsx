import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { logout, me } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await me();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  loader: ({ context }) => context,
  component: AppLayout,
});

const NAV = [
  { to: "/", label: "Início", exact: true },
  { to: "/vendas", label: "Vendas" },
  { to: "/caixa", label: "Caixa" },
  { to: "/catalogo", label: "Catálogo", admin: true },
  { to: "/clientes", label: "Clientes" },
  { to: "/utilizadores", label: "Utilizadores", admin: true },
  { to: "/relatorios", label: "Relatórios" },
] as const;

function AppLayout() {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => me(),
    staleTime: 60_000,
  });
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const doLogout = useServerFn(logout);

  const isAdmin = user?.papel === "admin";

  async function handleLogout() {
    await doLogout();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold tracking-tight text-foreground">
              Controlo de Vendas
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.filter((n) => !n.admin || isAdmin).map((n) => {
                const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={
                      "px-3 py-1.5 rounded-md text-sm transition-colors " +
                      (active
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted")
                    }
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-xs text-right leading-tight">
                <div className="font-medium text-foreground">{user.nome}</div>
                <div className="text-muted-foreground uppercase tracking-wider">
                  {user.papel}
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>
        <nav className="md:hidden border-t px-2 py-2 flex flex-wrap gap-1">
          {NAV.filter((n) => !n.admin || isAdmin).map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "px-2.5 py-1 rounded-md text-xs " +
                  (active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
      <footer className="border-t py-3">
        <div className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground text-center">
          Documento interno — sem valor fiscal. Não é software de faturação certificado.
        </div>
      </footer>
    </div>
  );
}
