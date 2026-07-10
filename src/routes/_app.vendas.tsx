import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { me } from "@/lib/auth.functions";
import { listVendedores } from "@/lib/utilizadores.functions";
import { getEstadoCaixa } from "@/lib/caixa.functions";
import { listCatalogo } from "@/lib/catalogo.functions";
import { listClientes } from "@/lib/clientes.functions";
import { criarRegisto, listRegistosHoje, marcarFaturado } from "@/lib/vendas.functions";
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
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/vendas")({
  component: VendasPage,
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

function VendasPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const emDetalhe = pathname !== "/vendas";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const estado = useQuery({ queryKey: ["estado-caixa"], queryFn: () => getEstadoCaixa() });
  const catalogo = useQuery({
    queryKey: ["catalogo", true],
    queryFn: () => listCatalogo({ data: { apenasAtivos: true } }),
  });
  const vendedores = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });
  const clientes = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });
  const registos = useQuery({
    queryKey: ["registos-hoje"],
    queryFn: () => listRegistosHoje(),
  });
  const doCriar = useServerFn(criarRegisto);
  const doMarcarFaturado = useServerFn(marcarFaturado);

  async function toggleFaturado(id: string, faturado: boolean) {
    try {
      await doMarcarFaturado({ data: { id, faturado } });
      await qc.invalidateQueries({ queryKey: ["registos-hoje"] });
      toast.success(faturado ? "Marcado como faturado" : "Marcado por faturar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [metodo, setMetodo] = useState<"dinheiro" | "multibanco" | "mbway">("dinheiro");
  const [vendedorId, setVendedorId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNovo, setClienteNovo] = useState({ nome: "", nif: "", telefone: "" });
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  // Diálogo de confirmação com password do vendedor
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwVendedorId, setPwVendedorId] = useState<string>("");
  const [pwVendedor, setPwVendedor] = useState<string>("");

  useEffect(() => {
    if (!vendedorId && (vendedores.data ?? []).length === 1) {
      setVendedorId((vendedores.data![0] as { id: string }).id);
    }
  }, [vendedores.data, vendedorId]);

  const total = useMemo(
    () => linhas.reduce((a, l) => a + l.quantidade * l.preco_unitario, 0),
    [linhas],
  );

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

  function abrirConfirmacao() {
    if (!estado.data?.aberta) {
      toast.error("Abra a caixa antes de registar vendas.");
      return;
    }
    const validas = linhas.filter((l) => l.descricao.trim() && l.quantidade > 0);
    if (validas.length === 0) {
      toast.error("Adicione pelo menos uma linha.");
      return;
    }
    if ((vendedores.data ?? []).length === 0) {
      toast.error("Não existem vendedores. Crie um em Utilizadores.");
      return;
    }
    setPwVendedorId(vendedorId || "");
    setPwVendedor("");
    setConfirmOpen(true);
  }

  async function confirmarEGuardar() {
    if (!pwVendedorId) {
      toast.error("Escolha o vendedor.");
      return;
    }
    if (!pwVendedor) {
      toast.error("Introduza a password do vendedor.");
      return;
    }
    const validas = linhas.filter((l) => l.descricao.trim() && l.quantidade > 0);
    setSaving(true);
    try {
      const res = await doCriar({
        data: {
          vendedor_id: pwVendedorId,
          vendedor_password: pwVendedor,
          cliente_id: clienteId || null,
          cliente_novo:
            !clienteId && showNovoCliente
              ? {
                  nome: clienteNovo.nome.trim() || null,
                  nif: clienteNovo.nif.trim() || null,
                  telefone: clienteNovo.telefone.trim() || null,
                }
              : null,
          metodo_pagamento: metodo,
          descricao: descricao.trim() || null,
          itens: validas.map((l) => ({
            catalogo_id: l.catalogo_id,
            descricao: l.descricao.trim(),
            quantidade: Number(l.quantidade),
            preco_unitario: Number(l.preco_unitario),
          })),
        },
      });
      toast.success(`Registo #${res.numero} guardado`);
      setLinhas([novaLinha()]);
      setClienteId("");
      setClienteNovo({ nome: "", nif: "", telefone: "" });
      setShowNovoCliente(false);
      setDescricao("");
      setVendedorId(pwVendedorId);
      setConfirmOpen(false);
      setPwVendedor("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["registos-hoje"] }),
        qc.invalidateQueries({ queryKey: ["estado-caixa"] }),
        qc.invalidateQueries({ queryKey: ["clientes"] }),
      ]);
      navigate({ to: "/vendas/$numero", params: { numero: String(res.numero) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }


  if (emDetalhe) {
    return <Outlet />;
  }

  if (!estado.data?.aberta) {
    return (
      <div className="max-w-md rounded-lg border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Caixa fechada</h1>
        <p className="text-sm text-muted-foreground mt-2">
          É preciso abrir a caixa antes de registar vendas.
        </p>
        <Button asChild className="mt-4">
          <Link to="/caixa">Ir para caixa</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova venda</h1>
          <p className="text-sm text-muted-foreground">
            Adicione linhas do catálogo ou manualmente.
          </p>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_120px_40px] gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
            <div>Descrição</div>
            <div className="text-right">Qtd</div>
            <div className="text-right">Preço</div>
            <div className="text-right">Subtotal</div>
            <div />
          </div>
          <div className="divide-y">
            {linhas.map((l) => (
              <div
                key={l.key}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_120px_40px] gap-2 p-3 items-center"
              >
                <div className="space-y-1">
                  <Select
                    value={l.catalogo_id ?? ""}
                    onValueChange={(v) => escolheProduto(l.key, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Escolher do catálogo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(catalogo.data ?? []).map((c) => {
                        const row = c as {
                          id: string;
                          nome: string;
                          preco: number;
                          unidade: string;
                        };
                        return (
                          <SelectItem key={row.id} value={row.id}>
                            {row.nome} — {formatEUR(row.preco)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    value={l.descricao}
                    onChange={(e) => atualizaLinha(l.key, { descricao: e.target.value })}
                    placeholder="Descrição"
                  />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.quantidade}
                  onChange={(e) => atualizaLinha(l.key, { quantidade: Number(e.target.value) })}
                  className="text-right"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.preco_unitario}
                  onChange={(e) => atualizaLinha(l.key, { preco_unitario: Number(e.target.value) })}
                  className="text-right"
                />
                <div className="text-right font-medium">
                  {formatEUR(l.quantidade * l.preco_unitario)}
                </div>
                <button
                  onClick={() =>
                    setLinhas((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))
                  }
                  className="text-muted-foreground hover:text-destructive p-2"
                  aria-label="Remover linha"
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
            >
              + Adicionar linha
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Observações (opcional)
          </div>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
      </div>

      <aside className="space-y-4">
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
              onValueChange={(v) => {
                setClienteId(v === "__none" ? "" : v);
                setShowNovoCliente(false);
              }}
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
          {!clienteId && (
            <button
              type="button"
              onClick={() => setShowNovoCliente((s) => !s)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showNovoCliente ? "− Cancelar novo cliente" : "+ Adicionar novo cliente"}
            </button>
          )}
          {!clienteId && showNovoCliente && (
            <div className="space-y-2 pt-2 border-t">
              <Input
                placeholder="Nome"
                value={clienteNovo.nome}
                onChange={(e) => setClienteNovo((c) => ({ ...c, nome: e.target.value }))}
              />
              <Input
                placeholder="NIF"
                value={clienteNovo.nif}
                onChange={(e) => setClienteNovo((c) => ({ ...c, nif: e.target.value }))}
              />
              <Input
                placeholder="Telefone"
                value={clienteNovo.telefone}
                onChange={(e) => setClienteNovo((c) => ({ ...c, telefone: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <Label>Método de pagamento</Label>
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

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="text-3xl font-bold">{formatEUR(total)}</span>
          </div>
          <Button
            className="w-full mt-4"
            size="lg"
            onClick={guardar}
            disabled={saving || total <= 0}
          >
            {saving ? "A guardar…" : "Guardar registo"}
          </Button>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
            Últimos de hoje
          </div>
          <div className="divide-y max-h-64 overflow-auto">
            {(registos.data ?? []).slice(0, 20).map((r) => {
              const row = r as {
                id: string;
                numero: number;
                total: number;
                metodo_pagamento: string;
                faturado: boolean;
                anulado: boolean;
                vendedor: { nome: string } | null;
              };
              return (
                <div
                  key={row.id}
                  className={
                    "flex items-center gap-2 px-4 py-2 text-sm " + (row.anulado ? "opacity-50" : "")
                  }
                >
                  <Link
                    to="/vendas/$numero"
                    params={{ numero: String(row.numero) }}
                    className="flex-1 flex items-center justify-between hover:opacity-70 min-w-0"
                  >
                    <span className="font-mono text-muted-foreground shrink-0">#{row.numero}</span>
                    <span className="text-xs text-muted-foreground truncate px-2">
                      {row.vendedor?.nome ?? metodoLabel(row.metodo_pagamento)}
                    </span>
                    <span className={"font-medium shrink-0 " + (row.anulado ? "line-through" : "")}>
                      {formatEUR(row.total)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    disabled={row.anulado}
                    onClick={() => toggleFaturado(row.id, !row.faturado)}
                    title={row.faturado ? "Marcar por faturar" : "Marcar como faturado"}
                    className={
                      "shrink-0 text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 border " +
                      (row.faturado
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground border-transparent hover:border-border")
                    }
                  >
                    {row.faturado ? "Faturado" : "Faturar"}
                  </button>
                </div>
              );
            })}
            {(registos.data ?? []).length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Sem registos hoje.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
