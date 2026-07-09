import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getEstadoCaixa } from "@/lib/caixa.functions";
import { listRegistosHoje } from "@/lib/vendas.functions";
import { formatEUR, metodoLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 text-xl font-semibold " + (muted ? "text-muted-foreground" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Dashboard() {
  const estado = useQuery({ queryKey: ["estado-caixa"], queryFn: () => getEstadoCaixa() });
  const registos = useQuery({
    queryKey: ["registos-hoje"],
    queryFn: () => listRegistosHoje(),
  });

  const t = estado.data?.totais;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
          <p className="text-sm text-muted-foreground">
            Resumo do dia — {new Date().toLocaleDateString("pt-PT")}
          </p>
        </div>
        <div className="flex gap-2">
          {estado.data?.aberta ? (
            <Button asChild>
              <Link to="/vendas">Nova venda</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/caixa">Abrir caixa</Link>
            </Button>
          )}
        </div>
      </div>

      {!estado.data?.aberta && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 px-4 py-3 text-sm">
          Não há caixa aberta hoje. Abra a caixa para começar a registar vendas.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Registos" value={String(t?.numRegistos ?? 0)} />
        <Stat label="Dinheiro" value={formatEUR(t?.dinheiro ?? 0)} />
        <Stat label="Multibanco" value={formatEUR(t?.multibanco ?? 0)} />
        <Stat label="MB Way" value={formatEUR(t?.mbway ?? 0)} />
        <Stat label="Sangrias" value={formatEUR(t?.sangrias ?? 0)} muted />
        <Stat label="Despesas" value={formatEUR(t?.despesas ?? 0)} muted />
        <Stat
          label="Saldo esperado"
          value={formatEUR(t?.saldoEsperado ?? 0)}
        />
        <Stat
          label="Total vendido"
          value={formatEUR(
            (t?.dinheiro ?? 0) + (t?.multibanco ?? 0) + (t?.mbway ?? 0),
          )}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-medium">Últimos registos de hoje</h2>
          <Link to="/vendas" className="text-sm text-muted-foreground hover:text-foreground">
            Ver todos →
          </Link>
        </div>
        <div className="divide-y">
          {(registos.data ?? []).slice(0, 8).map((r) => {
            const row = r as {
              id: string;
              numero: number;
              total: number;
              metodo_pagamento: string;
              created_at: string;
              utilizadores: { nome: string } | null;
              clientes: { nome: string | null } | null;
            };
            return (
              <Link
                key={row.id}
                to="/vendas/$numero"
                params={{ numero: String(row.numero) }}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm text-muted-foreground w-14">
                    #{row.numero}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">
                      {row.clientes?.nome || "Cliente ocasional"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {metodoLabel(row.metodo_pagamento)} · {row.utilizadores?.nome} ·{" "}
                      {new Date(row.created_at).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div className="font-semibold">{formatEUR(row.total)}</div>
              </Link>
            );
          })}
          {(registos.data ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sem registos hoje.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
