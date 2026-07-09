import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { relatorioIntervalo } from "@/lib/relatorios.functions";
import { formatEUR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/relatorios")({
  component: RelatoriosPage,
});

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function RelatoriosPage() {
  const [de, setDe] = useState(isoDaysAgo(6));
  const [ate, setAte] = useState(isoDaysAgo(0));
  const [intervalo, setIntervalo] = useState({ de, ate });

  const q = useQuery({
    queryKey: ["relatorio", intervalo.de, intervalo.ate],
    queryFn: () => relatorioIntervalo({ data: intervalo }),
  });

  const t = q.data?.totais;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Totais por intervalo de datas e fecho de caixa por dia.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <Button onClick={() => setIntervalo({ de, ate })}>Aplicar</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Registos" value={String(t?.numRegistos ?? 0)} />
        <Stat label="Total" value={formatEUR(t?.total ?? 0)} />
        <Stat label="Dinheiro" value={formatEUR(t?.dinheiro ?? 0)} />
        <Stat label="Multibanco" value={formatEUR(t?.multibanco ?? 0)} />
        <Stat label="MB Way" value={formatEUR(t?.mbway ?? 0)} />
        <Stat label="Sangrias" value={formatEUR(q.data?.totalSangrias ?? 0)} muted />
        <Stat label="Despesas" value={formatEUR(q.data?.totalDespesas ?? 0)} muted />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b font-medium">Fecho de caixa por dia</div>
        <div className="hidden md:grid grid-cols-[120px_1fr_1fr_1fr] gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
          <div>Data</div>
          <div className="text-right">Saldo inicial</div>
          <div className="text-right">Saldo final</div>
          <div className="text-right">Diferença</div>
        </div>
        <div className="divide-y">
          {(q.data?.caixas ?? []).map((c) => {
            const row = c as {
              id: string;
              data: string;
              saldo_inicial: number;
              saldo_final: number | null;
            };
            const diff =
              row.saldo_final == null ? null : Number(row.saldo_final) - Number(row.saldo_inicial);
            return (
              <div
                key={row.id}
                className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_1fr] gap-2 px-4 py-2 text-sm items-center"
              >
                <div className="font-mono text-muted-foreground">{row.data}</div>
                <div className="text-right">{formatEUR(row.saldo_inicial)}</div>
                <div className="text-right">
                  {row.saldo_final == null ? (
                    <span className="text-muted-foreground italic">em aberto</span>
                  ) : (
                    formatEUR(row.saldo_final)
                  )}
                </div>
                <div className="text-right">
                  {diff == null ? (
                    "—"
                  ) : (
                    <span
                      className={
                        diff === 0
                          ? "text-muted-foreground"
                          : diff > 0
                            ? "text-emerald-600"
                            : "text-destructive"
                      }
                    >
                      {diff > 0 ? "+" : ""}
                      {formatEUR(diff)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(q.data?.caixas ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sem caixas neste intervalo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
