import { createFileRoute, redirect } from "@tanstack/react-router";
import { me } from "@/lib/auth.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { deleteCatalogo, listCatalogo, upsertCatalogo } from "@/lib/catalogo.functions";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/catalogo")({
  beforeLoad: async () => {
    const user = await me();
    if (!user || user.papel !== "admin") throw redirect({ to: "/" });
  },
  component: CatalogoPage,
});

type Item = {
  id?: string;
  nome: string;
  tipo: "produto" | "servico";
  preco: number;
  unidade: string;
  ativo: boolean;
};

function CatalogoPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["catalogo-all"], queryFn: () => listCatalogo({ data: {} }) });
  const upsert = useServerFn(upsertCatalogo);
  const del = useServerFn(deleteCatalogo);

  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<Item>({
    nome: "",
    tipo: "produto",
    preco: 0,
    unidade: "unidade",
    ativo: true,
  });

  function abrirNovo() {
    setItem({ nome: "", tipo: "produto", preco: 0, unidade: "unidade", ativo: true });
    setOpen(true);
  }

  function abrirEditar(row: Item) {
    setItem({ ...row });
    setOpen(true);
  }

  async function guardar() {
    try {
      await upsert({ data: item });
      toast.success("Guardado");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["catalogo-all"] });
      await qc.invalidateQueries({ queryKey: ["catalogo", true] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function desativar(id: string) {
    if (!confirm("Desativar este item?")) return;
    try {
      await del({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["catalogo-all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground">Produtos e serviços disponíveis.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>Novo item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{item.id ? "Editar item" : "Novo item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={item.nome}
                  onChange={(e) => setItem({ ...item, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={item.tipo}
                    onValueChange={(v) => setItem({ ...item, tipo: v as Item["tipo"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="produto">Produto</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Unidade</Label>
                  <Input
                    value={item.unidade}
                    onChange={(e) => setItem({ ...item, unidade: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Preço (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.preco}
                  onChange={(e) => setItem({ ...item, preco: Number(e.target.value) })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.ativo}
                  onChange={(e) => setItem({ ...item, ativo: e.target.checked })}
                />
                Ativo
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={guardar}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="hidden md:grid grid-cols-[1fr_100px_100px_120px_140px] gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
          <div>Nome</div>
          <div>Tipo</div>
          <div className="text-right">Preço</div>
          <div>Unidade</div>
          <div className="text-right">Ações</div>
        </div>
        <div className="divide-y">
          {(q.data ?? []).map((row) => {
            const r = row as Item & { id: string };
            return (
              <div
                key={r.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px_120px_140px] gap-2 px-4 py-2 items-center text-sm"
              >
                <div>
                  <span className={r.ativo ? "" : "text-muted-foreground line-through"}>
                    {r.nome}
                  </span>
                </div>
                <div className="text-muted-foreground uppercase text-xs tracking-wider">
                  {r.tipo}
                </div>
                <div className="text-right font-medium">{formatEUR(r.preco)}</div>
                <div className="text-muted-foreground">{r.unidade}</div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(r)}>
                    Editar
                  </Button>
                  {r.ativo && (
                    <Button size="sm" variant="ghost" onClick={() => desativar(r.id)}>
                      Desativar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {(q.data ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sem itens ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
