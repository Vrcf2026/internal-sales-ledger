import { createFileRoute, redirect } from "@tanstack/react-router";
import { me } from "@/lib/auth.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  atualizarUtilizador,
  criarUtilizador,
  listUtilizadores,
} from "@/lib/utilizadores.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/utilizadores")({
  beforeLoad: async () => {
    const user = await me();
    if (!user || user.papel !== "admin") throw redirect({ to: "/" });
  },
  component: UtilizadoresPage,
});

function UtilizadoresPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["utilizadores"], queryFn: () => listUtilizadores() });
  const criar = useServerFn(criarUtilizador);
  const atualizar = useServerFn(atualizarUtilizador);

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [papel, setPapel] = useState<"admin" | "operador" | "vendedor">("operador");

  const [pwOpen, setPwOpen] = useState(false);
  const [pwId, setPwId] = useState<string | null>(null);
  const [pwPapel, setPwPapel] = useState<"admin" | "operador" | "vendedor" | null>(null);
  const [pwNovoPapel, setPwNovoPapel] = useState<"admin" | "operador" | "vendedor" | null>(null);
  const [pwValue, setPwValue] = useState("");

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["utilizadores"] });
  }

  async function guardarNovo() {
    if (papel === "vendedor" && !/^\d{4}$/.test(password)) {
      toast.error("A password do vendedor deve ter 4 dígitos.");
      return;
    }
    try {
      await criar({ data: { nome: nome.trim(), password, papel } });
      toast.success("Utilizador criado");
      setOpen(false);
      setNome("");
      setPassword("");
      setPapel("operador");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function togglePapel(id: string, novoPapel: "admin" | "operador" | "vendedor") {
    if (novoPapel === "vendedor") {
      setPwId(id);
      setPwPapel("vendedor");
      setPwNovoPapel("vendedor");
      setPwValue("");
      setPwOpen(true);
      return;
    }
    try {
      await atualizar({ data: { id, papel: novoPapel } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    try {
      await atualizar({ data: { id, ativo } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function alterarPw() {
    if (!pwId) return;
    if (pwPapel === "vendedor" && !/^\d{4}$/.test(pwValue)) {
      toast.error("A password do vendedor deve ter 4 dígitos.");
      return;
    }
    try {
      await atualizar({ data: { id: pwId, password: pwValue, papel: pwNovoPapel ?? undefined } });
      toast.success("Password alterada");
      setPwOpen(false);
      setPwValue("");
      setPwId(null);
      setPwPapel(null);
      setPwNovoPapel(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Utilizadores</h1>
          <p className="text-sm text-muted-foreground">Gestão de contas e papéis.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Novo utilizador</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo utilizador</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  inputMode={papel === "vendedor" ? "numeric" : undefined}
                  maxLength={papel === "vendedor" ? 4 : undefined}
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      papel === "vendedor"
                        ? e.target.value.replace(/\D/g, "").slice(0, 4)
                        : e.target.value,
                    )
                  }
                />
                {papel === "vendedor" && (
                  <p className="text-xs text-muted-foreground">Obrigatório: 4 dígitos.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select
                  value={papel}
                  onValueChange={(v) => setPapel(v as "admin" | "operador" | "vendedor")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={guardarNovo}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="hidden md:grid grid-cols-[1fr_140px_100px_260px] gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
          <div>Nome</div>
          <div>Papel</div>
          <div>Ativo</div>
          <div className="text-right">Ações</div>
        </div>
        <div className="divide-y">
          {(q.data ?? []).map((row) => {
            const u = row as {
              id: string;
              nome: string;
              papel: "admin" | "operador" | "vendedor";
              ativo: boolean;
            };
            return (
              <div
                key={u.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_100px_260px] gap-2 px-4 py-2 items-center text-sm"
              >
                <div className={u.ativo ? "font-medium" : "text-muted-foreground"}>{u.nome}</div>
                <div>
                  <Select
                    value={u.papel}
                    onValueChange={(v) => togglePapel(u.id, v as "admin" | "operador" | "vendedor")}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-muted-foreground">{u.ativo ? "Sim" : "Não"}</div>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPwId(u.id);
                      setPwPapel(u.papel);
                      setPwNovoPapel(null);
                      setPwValue("");
                      setPwOpen(true);
                    }}
                  >
                    Password
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleAtivo(u.id, !u.ativo)}>
                    {u.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar password</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nova password</Label>
            <Input
              type="password"
              inputMode={pwPapel === "vendedor" ? "numeric" : undefined}
              maxLength={pwPapel === "vendedor" ? 4 : undefined}
              value={pwValue}
              onChange={(e) =>
                setPwValue(
                  pwPapel === "vendedor"
                    ? e.target.value.replace(/\D/g, "").slice(0, 4)
                    : e.target.value,
                )
              }
            />
            {pwPapel === "vendedor" && (
              <p className="text-xs text-muted-foreground">Obrigatório: 4 dígitos.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={alterarPw}>Alterar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
