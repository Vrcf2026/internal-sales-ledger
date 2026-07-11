import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listContaCorrente,
  registarPagamento,
  type ContaCorrenteRegisto,
} from "@/lib/pagamentos.functions";
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

export const Route = createFileRoute("/_app/conta-corrente")({
  component: ContaCorrentePage,
});

type Grupo = {
  key: string;
  clienteNome: string;
  clienteNif: string | null;
  clienteTelefone: string | null;
  total: number;
  pago: number;
  saldo: number;
  registos: ContaCorrenteRegisto[];
};

function ContaCorrentePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["conta-corrente"], queryFn: () => listContaCorrente() });
  const vendedores = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });

  const doPagar = useServerFn(registarPagamento);
  const doConfirmarVendedor = useServerFn(confirmarVendedorAcesso);

  const [vendedorId, setVendedorId] = useState("");
  const [vendedorPin, setVendedorPin] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessVendedorId, setAccessVendedorId] = useState("");
  const [accessPin, setAccessPin] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);

  const [pagOpen, setPagOpen] = useState(false);
  const [alvo, setAlvo] = useState<ContaCorrenteRegisto | null>(null);
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState<"dinheiro" | "multibanco" | "mbway">("dinheiro");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vendedorId || vendedores.isLoading) return;
    const lista = (vendedores.data ?? []) as { id: string; nome: string }[];
    if (lista.length === 1) setAccessVendedorId(lista[0].id);
    if (lista.length > 0) setAccessOpen(true);
  }, [vendedores.data, vendedores.isLoading, vendedorId]);

  const vendedorAtual = useMemo(
    () =>
      ((vendedores.data ?? []) as { id: string; nome: string }[]).find(
        (v) => v.id === vendedorId,
      ),
    [vendedores.data, vendedorId],
  );

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
      const v = await doConfirmarVendedor({
        data: { vendedor_id: accessVendedorId, password: accessPin },
      });
      setVendedorId(v.id);
      setVendedorPin(accessPin);
      setAccessOpen(false);
      setAccessPin("");
      toast.success(`Vendedor: ${v.nome}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setAccessSaving(false);
    }
  }

  function trocarVendedor() {
    setAccessVendedorId(vendedorId);
    setAccessPin("");
    setAccessOpen(true);
  }

  const grupos = useMemo<Grupo[]>(() => {
    const m = new Map<string, Grupo>();
    for (const r of q.data ?? []) {
      const key = r.cliente?.id ?? "__sem";
      const nome = r.cliente?.nome || r.cliente?.nif || "Sem cliente";
      let g = m.get(key);
      if (!g) {
        g = {
          key,
          clienteNome: nome,
          clienteNif: r.cliente?.nif ?? null,
          clienteTelefone: r.cliente?.telefone ?? null,
          total: 0,
          pago: 0,
          saldo: 0,
          registos: [],
        };
        m.set(key, g);
      }
      g.total += r.total;
      g.pago += r.pago;
      g.saldo += r.saldo;
      g.registos.push(r);
    }
    return [...m.values()]
      .filter((g) => g.saldo > 0.001)
      .sort((a, b) => b.saldo - a.saldo);
  }, [q.data]);

  function abrirPagamento(r: ContaCorrenteRegisto) {
    if (!vendedorId || !vendedorPin) {
      setAccessOpen(true);
      return;
    }
    setAlvo(r);
    setValor(r.saldo.toFixed(2));
    setMetodo("dinheiro");
    setObs("");
    setPagOpen(true);
  }

  async function confirmarPagamento() {
    if (!alvo) return;
    const v = Number(valor);
    if (!v || v <= 0) {
      toast.error("Introduza um valor válido.");
      return;
    }
    setSaving(true);
    try {
      await doPagar({
        data: {
          registo_id: alvo.id,
          valor: v,
          metodo_pagamento: metodo,
          descricao: obs.trim() || null,
          vendedor_id: vendedorId,
          vendedor_password: vendedorPin,
        },
      });
      toast.success("Pagamento registado");
      setPagOpen(false);
      setAlvo(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["conta-corrente"] }),
        qc.invalidateQueries({ queryKey: ["estado-caixa"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  const totalDivida = grupos.reduce((a, g) => a + g.saldo, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conta corrente</h1>
          <p className="text-sm text-muted-foreground">
            Vendas a crédito por liquidar. Total em dívida:{" "}
            <strong>{formatEUR(totalDivida)}</strong>
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

      {q.isLoading && <div className="text-sm text-muted-foreground">A carregar…</div>}

      {!q.isLoading && grupos.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
          Sem vendas em dívida.
        </div>
      )}

      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g.key} className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/40">
              <div>
                <div className="font-medium">{g.clienteNome}</div>
                <div className="text-xs text-muted-foreground">
                  {g.clienteNif ? `NIF ${g.clienteNif}` : ""}
                  {g.clienteNif && g.clienteTelefone ? " · " : ""}
                  {g.clienteTelefone ?? ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Em dívida
                </div>
                <div className="text-lg font-semibold">{formatEUR(g.saldo)}</div>
              </div>
            </div>
            <div className="divide-y">
              {g.registos.map((r) => (
                <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      <Link
                        to="/vendas/$numero"
                        params={{ numero: String(r.numero) }}
                        className="hover:underline"
                      >
                        Registo #{r.numero}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(r.data).toLocaleDateString("pt-PT")}
                      </span>
                    </div>
                    {r.descricao && (
                      <div className="text-xs text-muted-foreground truncate">{r.descricao}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Total {formatEUR(r.total)} · Pago {formatEUR(r.pago)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatEUR(r.saldo)}</div>
                    <Button size="sm" className="mt-1" onClick={() => abrirPagamento(r)}>
                      Liquidar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={pagOpen} onOpenChange={setPagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registar pagamento {alvo ? `— Registo #${alvo.numero}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {alvo && (
              <div className="text-sm text-muted-foreground">
                Saldo em dívida: <strong>{formatEUR(alvo.saldo)}</strong>
              </div>
            )}
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
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as typeof metodo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="multibanco">Multibanco</SelectItem>
                  <SelectItem value="mbway">MB Way</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={confirmarPagamento} disabled={saving}>
              {saving ? "A registar…" : "Registar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
