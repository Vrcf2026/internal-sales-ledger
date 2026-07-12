import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { me } from "@/lib/auth.functions";
import { listRegistos } from "@/lib/vendas.functions";
import { listCaixas, getCaixaDetalhe, reabrirCaixa } from "@/lib/caixa.functions";
import { formatEUR, metodoLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_app/historico")({
  component: HistoricoPage,
});

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function menos(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function HistoricoPage() {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const isAdmin = meQuery.data?.papel === "admin";
  const [tab, setTab] = useState<"registos" | "fechos">("registos");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          Consultar, reimprimir {isAdmin ? "e editar" : ""} documentos anteriores.
        </p>
      </div>
      <div className="flex gap-1 border-b">
        {(["registos", "fechos"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              "px-4 py-2 text-sm border-b-2 -mb-px transition-colors " +
              (tab === k
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {k === "registos" ? "Registos" : "Fechos de caixa"}
          </button>
        ))}
      </div>
      {tab === "registos" ? <RegistosTab /> : <FechosTab isAdmin={!!isAdmin} />}
    </div>
  );
}

function RegistosTab() {
  const [de, setDe] = useState(menos(30));
  const [ate, setAte] = useState(hoje());
  const [numero, setNumero] = useState("");
  const filtro = useMemo(
    () => ({
      de,
      ate,
      numero: numero.trim() ? Number(numero.trim()) : null,
    }),
    [de, ate, numero],
  );
  const q = useQuery({
    queryKey: ["registos-hist", filtro],
    queryFn: () => listRegistos({ data: filtro }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] items-end">
        <div>
          <Label>De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <Label>Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div>
          <Label>Nº registo</Label>
          <Input
            inputMode="numeric"
            placeholder="ex.: 42"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button variant="outline" onClick={() => q.refetch()}>
          Atualizar
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Cliente</th>
              <th className="text-left px-3 py-2">Vendedor</th>
              <th className="text-left px-3 py-2">Método</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data ?? []).map((r) => {
              const row = r as {
                id: string;
                numero: number;
                data: string;
                total: number;
                metodo_pagamento: string;
                faturado: boolean;
                anulado: boolean;
                clientes: { nome: string | null } | null;
                vendedor: { nome: string } | null;
              };
              return (
                <tr key={row.id} className={row.anulado ? "opacity-50" : ""}>
                  <td className="px-3 py-2 font-mono">#{row.numero}</td>
                  <td className="px-3 py-2">{row.data}</td>
                  <td className="px-3 py-2">{row.clientes?.nome ?? "—"}</td>
                  <td className="px-3 py-2">{row.vendedor?.nome ?? "—"}</td>
                  <td className="px-3 py-2">
                    {metodoLabel(row.metodo_pagamento as never)}
                    {row.anulado && (
                      <span className="ml-2 text-xs text-destructive">anulado</span>
                    )}
                    {row.faturado && (
                      <span className="ml-2 text-xs text-emerald-600">faturado</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatEUR(row.total)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/vendas/$numero" params={{ numero: String(row.numero) }}>
                        Abrir
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Sem registos no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FechosTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [de, setDe] = useState(menos(30));
  const [ate, setAte] = useState(hoje());
  const filtro = useMemo(() => ({ de, ate }), [de, ate]);
  const q = useQuery({
    queryKey: ["caixas-hist", filtro],
    queryFn: () => listCaixas({ data: filtro }),
  });

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [reabrirId, setReabrirId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const doReabrir = useServerFn(reabrirCaixa);

  async function confirmarReabrir() {
    if (!reabrirId) return;
    if (motivo.trim().length < 3) {
      toast.error("Indique o motivo da reabertura.");
      return;
    }
    try {
      await doReabrir({ data: { id: reabrirId, motivo: motivo.trim() } });
      toast.success("Dia reaberto");
      setReabrirId(null);
      setMotivo("");
      await qc.invalidateQueries({ queryKey: ["caixas-hist"] });
      await qc.invalidateQueries({ queryKey: ["estado-caixa"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
        <div>
          <Label>De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <Label>Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => q.refetch()}>
          Atualizar
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Abriu</th>
              <th className="text-left px-3 py-2">Fechou</th>
              <th className="text-right px-3 py-2">Saldo inicial</th>
              <th className="text-right px-3 py-2">Saldo final</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data ?? []).map((r) => {
              const row = r as {
                id: string;
                data: string;
                estado: string;
                saldo_inicial: number;
                saldo_final: number | null;
                num_fechos: number;
                reaberta: boolean;
                abertura: { nome: string } | null;
                fecho: { nome: string } | null;
              };
              return (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.data}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "text-xs font-medium uppercase tracking-wider rounded px-2 py-0.5 " +
                        (row.estado === "aberto"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {row.estado}
                    </span>
                    {row.reaberta && (
                      <span className="ml-2 text-xs text-amber-700">reaberta</span>
                    )}
                    {row.num_fechos > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {row.num_fechos} fechos
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.abertura?.nome ?? "—"}</td>
                  <td className="px-3 py-2">{row.fecho?.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{formatEUR(row.saldo_inicial)}</td>
                  <td className="px-3 py-2 text-right">
                    {row.saldo_final != null ? formatEUR(row.saldo_final) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setDetalheId(row.id)}>
                      Ver / imprimir
                    </Button>
                    {isAdmin && row.estado === "fechado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReabrirId(row.id);
                          setMotivo("");
                        }}
                      >
                        Reabrir dia
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Sem fechos no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!reabrirId} onOpenChange={(o) => !o && setReabrirId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Ao reabrir, poderá rectificar o fecho. A ação fica registada.
            </p>
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirId(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarReabrir}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FechoDetalhe id={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}

function FechoDetalhe({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["caixa-detalhe", id],
    queryFn: () => getCaixaDetalhe({ data: { id: id as string } }),
    enabled: !!id,
  });
  const d = q.data as
    | {
        caixa: {
          data: string;
          estado: string;
          saldo_inicial: number;
          saldo_final: number | null;
          aberto_em: string;
          fechado_em: string | null;
          num_fechos: number;
          reaberta: boolean;
          reaberta_motivo: string | null;
          abertura: { nome: string } | null;
          fecho: { nome: string } | null;
          reabertura: { nome: string } | null;
        };
        totais: {
          dinheiro: number;
          multibanco: number;
          mbway: number;
          credito: number;
          liquidacoes: number;
          sangrias: number;
          despesas: number;
          numRegistos: number;
          saldoEsperado: number;
        };
        saidas: {
          id: string;
          tipo: string;
          descricao: string;
          valor: number;
        }[];
        registos: {
          id: string;
          numero: number;
          total: number;
          metodo_pagamento: string;
          anulado: boolean;
          vendedor: { nome: string } | null;
          clientes: { nome: string | null } | null;
        }[];
      }
    | undefined;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl print:max-w-none print:shadow-none">
        <DialogHeader>
          <DialogTitle>
            Fecho de caixa {d?.caixa.data ? `— ${d.caixa.data}` : ""}
          </DialogTitle>
        </DialogHeader>
        {!d ? (
          <div className="text-sm text-muted-foreground">A carregar…</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                Aberta por <strong>{d.caixa.abertura?.nome ?? "—"}</strong>
                <div className="text-xs text-muted-foreground">
                  {new Date(d.caixa.aberto_em).toLocaleString("pt-PT")}
                </div>
              </div>
              <div className="text-right">
                {d.caixa.fechado_em && (
                  <>
                    Fechada por <strong>{d.caixa.fecho?.nome ?? "—"}</strong>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.caixa.fechado_em).toLocaleString("pt-PT")}
                    </div>
                  </>
                )}
              </div>
            </div>
            {d.caixa.reaberta && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Reaberta por {d.caixa.reabertura?.nome ?? "—"} — motivo:{" "}
                {d.caixa.reaberta_motivo ?? "—"} · {d.caixa.num_fechos} fechos
              </div>
            )}

            <div className="rounded border">
              <table className="w-full">
                <tbody className="divide-y">
                  <tr>
                    <td className="px-3 py-1.5 text-muted-foreground">Saldo inicial</td>
                    <td className="px-3 py-1.5 text-right">
                      {formatEUR(d.caixa.saldo_inicial)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      Vendas em dinheiro
                      {d.totais.liquidacoes > 0
                        ? ` (inclui ${formatEUR(d.totais.liquidacoes)} de liquidações)`
                        : ""}
                    </td>
                    <td className="px-3 py-1.5 text-right">{formatEUR(d.totais.dinheiro)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-muted-foreground">Multibanco</td>
                    <td className="px-3 py-1.5 text-right">{formatEUR(d.totais.multibanco)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-muted-foreground">MB Way</td>
                    <td className="px-3 py-1.5 text-right">{formatEUR(d.totais.mbway)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-muted-foreground">A crédito</td>
                    <td className="px-3 py-1.5 text-right">{formatEUR(d.totais.credito)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-muted-foreground">Sangrias</td>
                    <td className="px-3 py-1.5 text-right">
                      -{formatEUR(d.totais.sangrias)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-muted-foreground">Despesas</td>
                    <td className="px-3 py-1.5 text-right">
                      -{formatEUR(d.totais.despesas)}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="px-3 py-2">Saldo esperado</td>
                    <td className="px-3 py-2 text-right">
                      {formatEUR(d.totais.saldoEsperado)}
                    </td>
                  </tr>
                  {d.caixa.saldo_final != null && (
                    <tr className="font-semibold">
                      <td className="px-3 py-2">Saldo contado</td>
                      <td className="px-3 py-2 text-right">
                        {formatEUR(d.caixa.saldo_final)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          (dif.{" "}
                          {formatEUR(
                            Number(d.caixa.saldo_final) - d.totais.saldoEsperado,
                          )}
                          )
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-muted-foreground">
              {d.totais.numRegistos} registos ·{" "}
              {d.saidas.length} saídas
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
