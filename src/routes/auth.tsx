import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { login } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const doLogin = useServerFn(login);
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      await doLogin({ data: { nome: nome.trim(), password } });
      navigate({ to: "/" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao iniciar sessão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Controlo Interno
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Controlo de Vendas
          </h1>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border bg-card p-6 shadow-sm space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="nome">Utilizador</Label>
            <Input
              id="nome"
              autoFocus
              autoComplete="username"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {erro && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {erro}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "A entrar…" : "Entrar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Documento interno — sem valor fiscal.
        </p>
      </div>
    </div>
  );
}
