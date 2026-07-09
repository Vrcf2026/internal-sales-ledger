import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { me } from "@/lib/auth.functions";
import { listCatalogo } from "@/lib/catalogo.functions";
import { listClientes } from "@/lib/clientes.functions";
import { listVendedores } from "@/lib/utilizadores.functions";
import {
  anularRegisto,
  atualizarRegisto,
  getRegisto,
  marcarFaturado,
  reativarRegisto,
} from "@/lib/vendas.functions";
import { formatEUR, metodoLabel } from "@/lib/format";
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
import { Printer, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/vendas/$numero")({
  component: TalaoPage,
});

type Linha = {
  key: string;
  catalogo_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};

function novaLinha(): Linha {
  return {
    key: Math.random().toString(36).slice(2),
    catalogo_id: null,
    descricao: "",
    quantidade: 1,
    preco_unitario: 0,
  };
}

function TalaoPage() {
  const { numero } = Route.useParams();
  const num = Number(numero);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const q = useQuery({
    queryKey: ["registo", num],
    queryFn: () => getRegisto({ data: { numero: num } }),
    retry: false,
  });

  const doMarcarFaturado = useServerFn(marcarFaturado);
  const doAnular = useServerFn(anularRegisto);
  const doReativar = useServerFn(reativarRegisto);
  const doAtualizar = useServerFn(atualizarRegisto);

  const [motivo, setMotivo] = useState("");
  const [anularOpen, setAnularOpen] = useState(false);

  const [editando, setEditando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [metodo, setMetodo] = useState<"dinheiro" | "multibanco" | "mbway">("dinheiro");
  const [vendedorId, setVendedorId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  const catalogo = useQuery({
    queryKey: ["catalogo", true],
    queryFn: () => listCatalogo({ data: { apenasAtivos: true } }),
    enabled: editando,
  });
  const vendedores = useQuery({
    queryKey: ["vendedores"],
    queryFn: () => listVendedores(),
    enabled: editando,
  });
  const clientes = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listClientes(),
    enabled: editando,
  });

  const isAdmin = meQuery.data?.papel === "admin";

  function iniciarEdicao() {
    if (!q.data) return;
    setLinhas(
      q.data.registo_itens.map((it) => ({
        key: Math.random().toString(36).slice(2),
        catalogo_id: null,
        descricao: it.descricao,
        quantidade: Number(it.quantidade),
        preco_unitario: Number(it.preco_unitario),
      })),
    );
    setMetodo(q.data.metodo_pagamento);
    setDescricao(q.data.descricao ?? "");
    setEditando(true);
  }

  useEffect(() => {
    if (editando && q.data && vendedores.data && !vendedorId) {
      // tenta pré-selecionar o vendedor atual comparando pelo nome (fallback simples)
      const atual = (vendedores.data as { id: string; nome: string }[]).find(
        (v) => v.nome === q.data.vendedor?.nome,
      );
      if (atual) setVendedorId(atual.id);
    }
    if (editando && q.data && clientes.data && !clienteId && q.data.clientes) {
      const atual = (
        clientes.data as { id: string; nome: string | null; nif: string | null }[]
      ).find((c) => c.nif === q.data.clientes?.nif && q.data.clientes?.nif);
      if (atual) setClienteId(atual.id);
    }
  }, [editando, q.data, vendedores.data, clientes.data, vendedorId, clienteId]);

  function atualizaLinha(key: string, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function escolheProduto(key: string, catId: string) {
    const p = (catalogo.data ?? []).find((c) => (c as { id: string }).id === catId) as
      { id: string; nome: string; preco: number } | undefined;
    if (!p) return;
    atualizaLinha(key, {
      catalogo_id: p.id,
      descricao: p.nome,
      preco_unitario: Number(p.preco),
    });
  }

  const totalEdicao = useMemo(
    () => linhas.reduce((a, l) => a + l.quantidade * l.preco_unitario, 0),
    [linhas],
  );

  async function guardarEdicao() {
    if (!q.data) return;
    const validas = linhas.filter((l) => l.descricao.trim() && l.quantidade > 0);
    if (validas.length === 0) {
      toast.error("Adicione pelo menos uma linha.");
      return;
    }
    if (!vendedorId) {
      toast.error("Escolha o vendedor.");
      return;
    }
    setSaving(true);
    try {
      await doAtualizar({
        data: {
          id: q.data.id,
          cliente_id: clienteId || null,
          metodo_pagamento: metodo,
          descricao: descricao.trim() || null,
          vendedor_id: vendedorId,
          itens: validas.map((l) => ({
            catalogo_id: l.catalogo_id,
            descricao: l.descricao.trim(),
            quantidade: Number(l.quantidade),
            preco_unitario: Number(l.preco_unitario),
          })),
        },
      });
      toast.success("Registo atualizado");
      setEditando(false);
      await qc.invalidateQueries({ queryKey: ["registo", num] });
      await qc.invalidateQueries({ queryKey: ["registos-hoje"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFaturado() {
    if (!q.data) return;
    try {
      await doMarcarFaturado({ data: { id: q.data.id, faturado: !q.data.faturado } });
      await qc.invalidateQueries({ queryKey: ["registo", num] });
      await qc.invalidateQueries({ queryKey: ["registos-hoje"] });
      toast.success(q.data.faturado ? "Marcado por faturar" : "Marcado como faturado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function confirmarAnular() {
    if (!q.data) return;
    if (!motivo.trim()) {
      toast.error("Indique o motivo da anulação.");
      return;
    }
    try {
      await doAnular({ data: { id: q.data.id, motivo: motivo.trim() } });
      toast.success("Registo anulado");
      setAnularOpen(false);
      setMotivo("");
      await qc.invalidateQueries({ queryKey: ["registo", num] });
      await qc.invalidateQueries({ queryKey: ["registos-hoje"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function reativar() {
    if (!q.data) return;
    try {
      await doReativar({ data: { id: q.data.id } });
      toast.success("Registo reativado");
      await qc.invalidateQueries({ queryKey: ["registo", num] });
      await qc.invalidateQueries({ queryKey: ["registos-hoje"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

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

  const r = q.data;

  if (editando) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div>
          <button
            onClick={() => setEditando(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Cancelar edição
          </button>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Editar registo #{r.numero}</h1>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <Label>Vendedor</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger className="mt-1">
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
          <div>
            <Label>Cliente (opcional)</Label>
            <Select
              value={clienteId || "__none"}
              onValueChange={(v) => setClienteId(v === "__none" ? "" : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Cliente ocasional</SelectItem>
                {(clientes.data ?? []).map((c) => {
                  const row = c as { id: string; nome: string | null; nif: string | null };
                  return (
                    <SelectItem key={row.id} value={row.id}>
                      {row.nome || row.nif || "Sem nome"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Método de pagamento</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as typeof metodo)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="multibanco">Multibanco</SelectItem>
                <SelectItem value="mbway">MB Way</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Linhas</div>
          {linhas.map((l) => (
            <div key={l.key} className="flex gap-2 items-start">
              <Select
                value={l.catalogo_id ?? "__manual"}
                onValueChange={(v) =>
                  v === "__manual"
                    ? atualizaLinha(l.key, { catalogo_id: null })
                    : escolheProduto(l.key, v)
                }
              >
                <SelectTrigger className="w-40 shrink-0">
                  <SelectValue placeholder="Catálogo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">Manual</SelectItem>
                  {(catalogo.data ?? []).map((c) => {
                    const row = c as { id: string; nome: string };
                    return (
                      <SelectItem key={row.id} value={row.id}>
                        {row.nome}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Input
                value={l.descricao}
                onChange={(e) => atualizaLinha(l.key, { descricao: e.target.value })}
                placeholder="Descrição"
                className="flex-1"
              />
              <Input
                type="number"
                value={l.quantidade}
                onChange={(e) => atualizaLinha(l.key, { quantidade: Number(e.target.value) })}
                className="w-20"
              />
              <Input
                type="number"
                value={l.preco_unitario}
                onChange={(e) => atualizaLinha(l.key, { preco_unitario: Number(e.target.value) })}
                className="w-24"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
          >
            Adicionar linha
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <span className="text-muted-foreground">Novo total</span>
          <span className="text-2xl font-bold">{formatEUR(totalEdicao)}</span>
        </div>

        <Button onClick={guardarEdicao} disabled={saving} className="w-full">
          {saving ? "A guardar…" : "Guardar alterações"}
        </Button>
      </div>
    );
  }

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
        <div className="flex gap-2">
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {r.anulado && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm print:hidden">
          <div className="font-medium text-destructive">Registo anulado</div>
          <div className="text-muted-foreground mt-1">
            Por {r.anulado_por_user?.nome ?? "—"} em{" "}
            {r.anulado_em ? new Date(r.anulado_em).toLocaleString("pt-PT") : "—"}
          </div>
          {r.anulado_motivo && <div className="mt-1">Motivo: {r.anulado_motivo}</div>}
          {isAdmin && (
            <Button size="sm" variant="outline" className="mt-3" onClick={reativar}>
              Reativar registo
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={toggleFaturado}
          disabled={r.anulado}
          className={
            "text-xs font-medium uppercase tracking-wider rounded px-2 py-1 border " +
            (r.faturado
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-muted text-muted-foreground border-transparent hover:border-border")
          }
        >
          {r.faturado ? `Faturado por ${r.faturado_por_user?.nome ?? "—"}` : "Faturar"}
        </button>

        {isAdmin && !r.anulado && (
          <>
            <Button size="sm" variant="outline" onClick={iniciarEdicao}>
              Editar
            </Button>
            <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive">
                  Anular
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Anular registo #{r.numero}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="destructive" onClick={confirmarAnular}>
                    Confirmar anulação
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
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
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Vendedor</div>
            <div>{r.vendedor?.nome ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pagamento</div>
            <div>{metodoLabel(r.metodo_pagamento)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Operador</div>
            <div>{r.operador?.nome ?? "—"}</div>
          </div>
        </div>

        {r.clientes && (r.clientes.nome || r.clientes.nif || r.clientes.telefone) && (
          <div className="py-3 border-b text-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Cliente</div>
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
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">{r.descricao}</div>
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
