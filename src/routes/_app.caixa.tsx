import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  abrirCaixa,
  fecharCaixa,
  getEstadoCaixa,
  listSaidasHoje,
  registarSaida,
} from "@/lib/caixa.functions";
import { confirmarVendedorAcesso, listVendedores } from "@/lib/utilizadores.functions";
import { formatEUR } from "@/lib/format";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/caixa")({
  component: CaixaPage,
});

function CaixaPage() {
  const qc = useQueryClient();
  const estado = useQuery({ queryKey: ["estado-caixa"], queryFn: () => getEstadoCaixa() });
  const saidas = useQuery({ queryKey: ["saidas-hoje"], queryFn: () => listSaidasHoje() });
  const vendedores = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });

  const doAbrir = useServerFn(abrirCaixa);
  const doFechar = useServerFn(fecharCaixa);
  const doSaida = useServerFn(registarSaida);
  const doConfirmarVendedor = useServerFn(confirmarVendedorAcesso);

  const [saldoInicial, setSaldoInicial] = useState("");
  const [saldoFinal, setSaldoFinal] = useState("");
  const [tipo, setTipo] = useState<"sangria" | "despesa">("sangria");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [vendedorPin, setVendedorPin] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessVendedorId, setAccessVendedorId] = useState("");
  const [accessPin, setAccessPin] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);

  useEffect(() => {
    if (vendedorId || vendedores.isLoading) return;
    const lista = (vendedores.data ?? []) as { id: string; nome: string }[];
    if (lista.length === 1) setAccessVendedorId(lista[0].id);
    if (lista.length > 0) setAccessOpen(true);
  }, [vendedores.data, vendedores.isLoading, vendedorId]);

  const vendedorAtual = useMemo(
    () =>
      ((vendedores.data ?? []) as { id: string; nome: string }[]).find((v) => v.id === vendedorId),
    [vendedores.data, vendedorId],
  );

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["estado-caixa"] }),
      qc.invalidateQueries({ queryKey: ["saidas-hoje"] }),
    ]);
  }

  async function confirmarAcessoVendedor() {
    if (!accessVendedorId) {
      toast.error("Escolha o vendedor.");
      return;
    }
    if (!/^\d{4}$/.test(accessPin)) {
      toast.error("A password do vendedor deve ter 4 dígitos.");
      return;
    }
    setAccessSaving(true);
    try {
      const vendedor = await doConfirmarVendedor({
        data: { vendedor_id: accessVendedorId, password: accessPin },
      });
      setVendedorId(vendedor.id);
      setVendedorPin(accessPin);
      setAccessOpen(false);
      setAccessPin("");
      toast.success(`Vendedor: ${vendedor.nome}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setAccessSaving(false);
    }
  }

  function exigirVendedor() {
    if (vendedorId && vendedorPin) return true;
    if ((vendedores.data ?? []).length === 0) {
      toast.error("Não existem vendedores. Crie um em Utilizadores.");
      return false;
    }
    setAccessOpen(true);
    return false;
  }

  function trocarVendedor() {
    setAccessVendedorId(vendedorId);
    setAccessPin("");
    setAccessOpen(true);
  }

  async function handleAbrir() {
    if (!exigirVendedor()) return;
    try {
      await doAbrir({
        data: {
          saldo_inicial: Number(saldoInicial) || 0,
          vendedor_id: vendedorId,
          vendedor_password: vendedorPin,
        },
      });
      toast.success("Caixa aberta");
      setSaldoInicial("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleFechar() {
    if (!exigirVendedor()) return;
    try {
      await doFechar({
        data: {
          saldo_final: Number(saldoFinal) || 0,
          vendedor_id: vendedorId,
          vendedor_password: vendedorPin,
        },
      });
      toast.success("Caixa fechada");
      setSaldoFinal("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleSaida() {
    if (!exigirVendedor()) return;
    try {
      await doSaida({
        data: {
          tipo,
          descricao: descricao.trim(),
          valor: Number(valor) || 0,
          vendedor_id: vendedorId,
          vendedor_password: vendedorPin,
        },
      });
      toast.success("Saída registada");
      setDescricao("");
      setValor("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const t = estado.data?.totais;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Caixa diário</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("pt-PT", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Vendedor</div>
            <div className="text-sm font-medium">{vendedorAtual?.nome ?? "Por confirmar"}</div>
            <Button variant="outline" size="sm" className="mt-2" onClick={trocarVendedor}>
              Trocar
            </Button>
          </div>
        </div>
      </div>

      {(vendedores.data ?? []).length === 0 && !vendedores.isLoading && (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Crie pelo menos um utilizador com papel Vendedor para usar vendas e caixa.
        </div>
      )}

      {!estado.data?.aberta ? (
        <div className="rounded-lg border bg-card p-5 max-w-md">
          <h2 className="font-medium">Abrir caixa</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Introduza o saldo inicial em dinheiro.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="si">Saldo inicial (€)</Label>
            <Input
              id="si"
              type="number"
              step="0.01"
              min="0"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
            />
          </div>
          <Button onClick={handleAbrir} className="mt-4 w-full">
            Abrir caixa
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Saldo inicial
              </div>
              <div className="mt-1 text-xl font-semibold">
                {formatEUR(
                  (estado.data?.caixa as { saldo_inicial: number } | null)?.saldo_inicial ?? 0,
                )}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Vendas em dinheiro
              </div>
              <div className="mt-1 text-xl font-semibold">{formatEUR(t?.dinheiro ?? 0)}</div>
              {(t?.liquidacoes ?? 0) > 0 && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  inclui {formatEUR(t?.liquidacoes ?? 0)} de liquidações
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Saídas</div>
              <div className="mt-1 text-xl font-semibold">
                {formatEUR((t?.sangrias ?? 0) + (t?.despesas ?? 0))}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Saldo esperado
              </div>
              <div className="mt-1 text-xl font-semibold">{formatEUR(t?.saldoEsperado ?? 0)}</div>
            </div>
          </div>

          {(t?.credito ?? 0) > 0 && (
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100">
              Vendas a crédito hoje: <strong>{formatEUR(t?.credito ?? 0)}</strong> — não entram na
              caixa até serem liquidadas.
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-medium">Registar saída</h2>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as "sangria" | "despesa")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sangria">Sangria</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex.: reforço banco, compra de café…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
                <Button onClick={handleSaida} className="w-full">
                  Registar saída
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-medium">Fechar caixa</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Introduza o valor contado em caixa no fim do dia.
              </p>
              <div className="mt-4 space-y-2">
                <Label>Saldo esperado</Label>
                <div className="text-lg font-semibold">{formatEUR(t?.saldoEsperado ?? 0)}</div>
              </div>
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="sf">Saldo contado (€)</Label>
                <Input
                  id="sf"
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldoFinal}
                  onChange={(e) => setSaldoFinal(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={handleFechar} className="mt-4 w-full">
                Fechar caixa
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b font-medium">Saídas de hoje</div>
            <div className="divide-y">
              {(saidas.data ?? []).map((s) => {
                const row = s as {
                  id: string;
                  tipo: string;
                  descricao: string;
                  valor: number;
                  criado_em: string;
                  utilizadores: { nome: string } | null;
                };
                return (
                  <div key={row.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {row.descricao}
                        <span className="ml-2 text-xs uppercase tracking-wider text-muted-foreground">
                          {row.tipo}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.utilizadores?.nome} ·{" "}
                        {new Date(row.criado_em).toLocaleTimeString("pt-PT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="font-semibold">-{formatEUR(row.valor)}</div>
                  </div>
                );
              })}
              {(saidas.data ?? []).length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Sem saídas registadas.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog
        open={accessOpen}
        onOpenChange={(open) => {
          if (open) setAccessOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Identificar vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              <Select value={accessVendedorId} onValueChange={setAccessVendedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {(vendedores.data ?? []).map((v) => {
                    const row = v as { id: string; nome: string };
                    return (
                      <SelectItem key={row.id} value={row.id}>
                        {row.nome}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Password do vendedor</Label>
              <Input
                type="password"
                autoFocus
                inputMode="numeric"
                maxLength={4}
                value={accessPin}
                onChange={(e) => setAccessPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !accessSaving) confirmarAcessoVendedor();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={confirmarAcessoVendedor} disabled={accessSaving}>
              {accessSaving ? "A confirmar…" : "Entrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
