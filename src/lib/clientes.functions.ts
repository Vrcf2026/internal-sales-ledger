import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listClientes = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("../lib/guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("clientes" as never)
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const schema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().max(120).optional().nullable(),
  nif: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
});

export const upsertCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { requireSession } = await import("../lib/guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      nome: data.nome || null,
      nif: data.nif || null,
      telefone: data.telefone || null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("clientes" as never)
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: novo, error } = await supabaseAdmin
      .from("clientes" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return novo as { id: string };
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireSession } = await import("../lib/guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("clientes" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
