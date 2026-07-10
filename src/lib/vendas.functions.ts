import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  catalogo_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(1).max(200),
  quantidade: z.number().positive().max(99999),
  preco_unitario: z.number().min(0).max(999999),
});

const criarSchema = z.object({
  vendedor_id: z.string().uuid(),
  vendedor_password: z.string().regex(/^\d{4}$/, "A password do vendedor deve ter 4 dígitos."),
  cliente_id: z.string().uuid().nullable().optional(),
  cliente_novo: z
    .object({
      nome: z.string().trim().max(120).optional().nullable(),
      nif: z.string().trim().max(20).optional().nullable(),
      telefone: z.string().trim().max(30).optional().nullable(),
    })
    .optional()
    .nullable(),
  metodo_pagamento: z.enum(["dinheiro", "multibanco", "mbway"]),
  descricao: z.string().trim().max(200).optional().nullable(),
  itens: z.array(itemSchema).min(1).max(200),
});

export const criarRegisto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireSession } = await import("../lib/guard.server");
    const s = await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica a password do vendedor escolhido
    const { data: okVend, error: vErr } = await supabaseAdmin.rpc("verify_vendedor", {
      p_id: data.vendedor_id,
      p_password: data.vendedor_password,
    } as never);
    if (vErr) throw new Error(vErr.message);
    if (!okVend) throw new Error("Password do vendedor incorreta.");

    const hoje = new Date().toISOString().slice(0, 10);
    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id")
      .eq("data", hoje)
      .eq("estado", "aberto")
      .maybeSingle();
    if (!caixa) throw new Error("Abra a caixa antes de registar vendas.");

    let clienteId = data.cliente_id ?? null;
    if (!clienteId && data.cliente_novo) {
      const cn = data.cliente_novo;
      if (cn.nome || cn.nif || cn.telefone) {
        const { data: c, error } = await supabaseAdmin
          .from("clientes" as never)
          .insert({
            nome: cn.nome || null,
            nif: cn.nif || null,
            telefone: cn.telefone || null,
          } as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        clienteId = (c as { id: string }).id;
      }
    }

    const total = data.itens.reduce((acc, it) => acc + it.quantidade * it.preco_unitario, 0);

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("registos" as never)
      .insert({
        caixa_diario_id: (caixa as { id: string }).id,
        utilizador_id: s.userId,
        vendedor_id: data.vendedor_id,
        cliente_id: clienteId,
        metodo_pagamento: data.metodo_pagamento,
        descricao: data.descricao || null,
        total: Number(total.toFixed(2)),
      } as never)
      .select("id, numero")
      .single();
    if (regErr) throw new Error(regErr.message);
    const r = reg as { id: string; numero: number };

    const linhas = data.itens.map((it) => ({
      registo_id: r.id,
      catalogo_id: it.catalogo_id || null,
      descricao: it.descricao,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
    }));
    const { error: linErr } = await supabaseAdmin
      .from("registo_itens" as never)
      .insert(linhas as never);
    if (linErr) throw new Error(linErr.message);

    return { id: r.id, numero: r.numero };
  });

const REGISTO_SELECT =
  "*, operador:utilizadores!utilizador_id(nome), vendedor:utilizadores!vendedor_id(nome), " +
  "faturado_por_user:utilizadores!faturado_por(nome), anulado_por_user:utilizadores!anulado_por(nome), " +
  "editado_por_user:utilizadores!editado_por(nome), " +
  "clientes(nome, nif, telefone), registo_itens(descricao, quantidade, preco_unitario, subtotal)";

export const listRegistosHoje = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("../lib/guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("registos" as never)
    .select(
      "id, numero, total, metodo_pagamento, created_at, faturado, anulado, " +
        "operador:utilizadores!utilizador_id(nome), vendedor:utilizadores!vendedor_id(nome), clientes(nome)",
    )
    .eq("data", hoje)
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export type RegistoDetalhe = {
  id: string;
  numero: number;
  data: string;
  total: number;
  metodo_pagamento: "dinheiro" | "multibanco" | "mbway";
  descricao: string | null;
  created_at: string;
  faturado: boolean;
  faturado_em: string | null;
  faturado_por_user: { nome: string } | null;
  anulado: boolean;
  anulado_em: string | null;
  anulado_por_user: { nome: string } | null;
  anulado_motivo: string | null;
  editado_em: string | null;
  editado_por_user: { nome: string } | null;
  operador: { nome: string } | null;
  vendedor: { nome: string } | null;
  clientes: { nome: string | null; nif: string | null; telefone: string | null } | null;
  registo_itens: {
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }[];
};

export const getRegisto = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ numero: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<RegistoDetalhe> => {
    const { requireSession } = await import("../lib/guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg, error } = await supabaseAdmin
      .from("registos" as never)
      .select(REGISTO_SELECT)
      .eq("numero", data.numero)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reg) throw new Error("Registo não encontrado");
    return reg as unknown as RegistoDetalhe;
  });

export const marcarFaturado = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), faturado: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    const s = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("registos" as never)
      .update({
        faturado: data.faturado,
        faturado_em: data.faturado ? new Date().toISOString() : null,
        faturado_por: data.faturado ? s.userId : null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const anularRegisto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().trim().min(1).max(300) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    const s = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("registos" as never)
      .update({
        anulado: true,
        anulado_em: new Date().toISOString(),
        anulado_por: s.userId,
        anulado_motivo: data.motivo,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reativarRegisto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("registos" as never)
      .update({
        anulado: false,
        anulado_em: null,
        anulado_por: null,
        anulado_motivo: null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const editarSchema = z.object({
  id: z.string().uuid(),
  cliente_id: z.string().uuid().nullable().optional(),
  metodo_pagamento: z.enum(["dinheiro", "multibanco", "mbway"]),
  descricao: z.string().trim().max(200).optional().nullable(),
  vendedor_id: z.string().uuid(),
  itens: z.array(itemSchema).min(1).max(200),
});

export const atualizarRegisto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => editarSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("../lib/guard.server");
    const s = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const total = data.itens.reduce((acc, it) => acc + it.quantidade * it.preco_unitario, 0);

    const { error: updErr } = await supabaseAdmin
      .from("registos" as never)
      .update({
        cliente_id: data.cliente_id ?? null,
        metodo_pagamento: data.metodo_pagamento,
        descricao: data.descricao || null,
        vendedor_id: data.vendedor_id,
        total: Number(total.toFixed(2)),
        editado_em: new Date().toISOString(),
        editado_por: s.userId,
      } as never)
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    const { error: delErr } = await supabaseAdmin
      .from("registo_itens" as never)
      .delete()
      .eq("registo_id", data.id);
    if (delErr) throw new Error(delErr.message);

    const linhas = data.itens.map((it) => ({
      registo_id: data.id,
      catalogo_id: it.catalogo_id || null,
      descricao: it.descricao,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
    }));
    const { error: insErr } = await supabaseAdmin
      .from("registo_itens" as never)
      .insert(linhas as never);
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });
