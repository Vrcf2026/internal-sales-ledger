import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listCatalogo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ apenasAtivos: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { requireSession } = await import("../lib/guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("catalogo" as never)
      .select("*")
      .order("nome", { ascending: true });
    if (data.apenasAtivos) q = q.eq("ativo", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(120),
  tipo: z.enum(["produto", "servico"]),
  preco: z.number().min(0).max(999999),
  unidade: z.string().trim().max(20).default("unidade"),
  ativo: z.boolean().default(true),
});

export const upsertCatalogo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("catalogo" as never)
        .update({
          nome: data.nome,
          tipo: data.tipo,
          preco: data.preco,
          unidade: data.unidade,
          ativo: data.ativo,
        } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("catalogo" as never).insert({
        nome: data.nome,
        tipo: data.tipo,
        preco: data.preco,
        unidade: data.unidade,
        ativo: data.ativo,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCatalogo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Soft-delete: desativar (não apagar para preservar histórico)
    const { error } = await supabaseAdmin
      .from("catalogo" as never)
      .update({ ativo: false } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
