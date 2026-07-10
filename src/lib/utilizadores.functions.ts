import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Lista de vendedores ativos (papel='vendedor') para escolher e autenticar em cada venda.
export const listVendedores = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("../lib/guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("utilizadores" as never)
    .select("id, nome")
    .eq("ativo", true)
    .eq("papel", "vendedor")
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listUtilizadores = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("../lib/guard.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("utilizadores" as never)
    .select("id, nome, papel, ativo, created_at")
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const confirmarVendedorAcesso = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        vendedor_id: z.string().uuid(),
        password: z.string().regex(/^\d{4}$/, "A password do vendedor deve ter 4 dígitos."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("../lib/guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: okVend, error: vErr } = await supabaseAdmin.rpc("verify_vendedor", {
      p_id: data.vendedor_id,
      p_password: data.password,
    } as never);
    if (vErr) throw new Error(vErr.message);
    if (!okVend) throw new Error("Vendedor ou password incorretos.");

    const { data: vendedor, error } = await supabaseAdmin
      .from("utilizadores" as never)
      .select("id, nome")
      .eq("id", data.vendedor_id)
      .eq("ativo", true)
      .eq("papel", "vendedor")
      .single();
    if (error) throw new Error(error.message);
    return vendedor as { id: string; nome: string };
  });

function validaPasswordVendedor(papel: string | undefined, password: string | undefined) {
  if (papel === "vendedor" && !/^\d{4}$/.test(password ?? "")) {
    throw new Error("A password do vendedor deve ter exatamente 4 dígitos.");
  }
}

export const criarUtilizador = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1).max(60),
        password: z.string().min(4).max(200),
        papel: z.enum(["admin", "operador", "vendedor"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    await requireAdmin();
    validaPasswordVendedor(data.papel, data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Insere sem hash e depois define password via set_password (usa pgcrypto)
    const { data: novo, error } = await supabaseAdmin
      .from("utilizadores" as never)
      .insert({ nome: data.nome, papel: data.papel, password_hash: "!" } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (novo as { id: string }).id;
    const { error: pErr } = await supabaseAdmin.rpc("set_password", {
      p_id: id,
      p_password: data.password,
    } as never);
    if (pErr) throw new Error(pErr.message);
    return { id };
  });

export const atualizarUtilizador = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        papel: z.enum(["admin", "operador", "vendedor"]).optional(),
        ativo: z.boolean().optional(),
        password: z.string().min(4).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.password) {
      const papelAlvo = data.papel ?? (await supabaseAdmin
        .from("utilizadores" as never)
        .select("papel")
        .eq("id", data.id)
        .single()).data?.papel;
      validaPasswordVendedor(String(papelAlvo), data.password);
    }
    const upd: Record<string, unknown> = {};
    if (data.papel !== undefined) upd.papel = data.papel;
    if (data.ativo !== undefined) upd.ativo = data.ativo;
    if (Object.keys(upd).length > 0) {
      const { error } = await supabaseAdmin
        .from("utilizadores" as never)
        .update(upd as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    if (data.password) {
      const { error } = await supabaseAdmin.rpc("set_password", {
        p_id: data.id,
        p_password: data.password,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
