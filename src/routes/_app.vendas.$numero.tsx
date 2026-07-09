import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getRegisto } from "@/lib/vendas.functions";
import { formatEUR, metodoLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_app/vendas/$numero")({
  component: TalaoPage,
});

function TalaoPage() {
  const { numero } = Route.useParams();
  const num = Number(numero);
  const q = useQuery({
    queryKey: ["registo", num],
    queryFn: () => getRegisto({ data: { numero: num } }),
    retry: false,
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  if (q.isError || !q.data) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="text-sm">Registo #{numero} não encontrado.</div>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/vendas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const r = q.data as {
    numero: number;
    data: string;
    total: number;
    metodo_pagamento: string;
    descricao: string | null;
    created_at: string;
    utilizadores: { nome: string } | null;
    clientes: { nome: string | null; nif: string | null; telefone: string | null } | null;
    registo_itens: {
      descricao: string;
      quantidade: number;
      preco_unitario: number;
      subtotal: number;
    }[];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link to="/vendas" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            Talão de controlo #{r.numero}
          </h1>
        </div>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <div className="rounded-lg border bg-card mx-auto max-w-md p-6 print:border-0 print:shadow-none print:max-w-none">
        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Documento interno
          </div>
          <div className="text-lg font-semibold mt-1">Talão de controlo</div>
          <div className="text-sm text-muted-foreground">Sem valor fiscal</div>
        </div>

        <div className="border-t border-b py-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Nº</div>
            <div className="font-mono font-semibold">#{r.numero}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Data</div>
            <div>{new Date(r.created_at).toLocaleString("pt-PT")}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Operador
            </div>
            <div>{r.utilizadores?.nome ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Pagamento
            </div>
            <div>{metodoLabel(r.metodo_pagamento)}</div>
          </div>
        </div>

        {r.clientes && (r.clientes.nome || r.clientes.nif || r.clientes.telefone) && (
          <div className="py-3 border-b text-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Cliente
            </div>
            <div>{r.clientes.nome}</div>
            {r.clientes.nif && (
              <div className="text-xs text-muted-foreground">NIF: {r.clientes.nif}</div>
            )}
            {r.clientes.telefone && (
              <div className="text-xs text-muted-foreground">Tel.: {r.clientes.telefone}</div>
            )}
          </div>
        )}

        <div className="py-3 space-y-2">
          {r.registo_itens.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <div className="pr-2">
                <div>{it.descricao}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(it.quantidade)} × {formatEUR(it.preco_unitario)}
                </div>
              </div>
              <div className="font-medium whitespace-nowrap">
                {formatEUR(it.subtotal ?? it.quantidade * it.preco_unitario)}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-bold">{formatEUR(r.total)}</span>
        </div>

        {r.descricao && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            {r.descricao}
          </div>
        )}

        <div className="mt-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Documento interno — sem valor fiscal
        </div>
      </div>

      <style>{`
        @media print {
          header, footer, nav { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
