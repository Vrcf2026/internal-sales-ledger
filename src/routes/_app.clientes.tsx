import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { deleteCliente, listClientes, upsertCliente } from "@/lib/clientes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
});

type Cliente = {
  id?: string;
  nome: string;
  nif: string;
  telefone: string;
  linha_preco: 1 | 2;
};

function ClientesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });
  const upsert = useServerFn(upsertCliente);
  const del = useServerFn(deleteCliente);
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<Cliente>({ nome: "", nif: "", telefone: "", linha_preco: 1 });

  function novo() {
    setC({ nome: "", nif: "", telefone: "", linha_preco: 1 });
    setOpen(true);
  }
  function editar(row: Cliente & { id: string }) {
    setC({
      id: row.id,
      nome: row.nome ?? "",
      nif: row.nif ?? "",
      telefone: row.telefone ?? "",
      linha_preco: (row.linha_preco === 2 ? 2 : 1) as 1 | 2,
    });
    setOpen(true);
  }
  async function guardar() {
    try {
      await upsert({ data: c });
      toast.success("Guardado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function eliminar(id: string) {
    if (!confirm("Eliminar cliente?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Diretório opcional de clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={novo}>Novo cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{c.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>NIF</Label>
                <Input value={c.nif} onChange={(e) => setC({ ...c, nif: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={c.telefone}
                  onChange={(e) => setC({ ...c, telefone: e.target.value })}
                />
              </div>
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
        <div className="hidden md:grid grid-cols-[1fr_140px_160px_120px] gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
          <div>Nome</div>
          <div>NIF</div>
          <div>Telefone</div>
          <div className="text-right">Ações</div>
        </div>
        <div className="divide-y">
          {(q.data ?? []).map((row) => {
            const r = row as {
              id: string;
              nome: string | null;
              nif: string | null;
              telefone: string | null;
            };
            return (
              <div
                key={r.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_120px] gap-2 px-4 py-2 items-center text-sm"
              >
                <div>{r.nome || <span className="text-muted-foreground">—</span>}</div>
                <div className="text-muted-foreground">{r.nif || "—"}</div>
                <div className="text-muted-foreground">{r.telefone || "—"}</div>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      editar({
                        id: r.id,
                        nome: r.nome ?? "",
                        nif: r.nif ?? "",
                        telefone: r.telefone ?? "",
                      })
                    }
                  >
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminar(r.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            );
          })}
          {(q.data ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sem clientes.</div>
          )}
        </div>
      </div>
    </div>
  );
}
