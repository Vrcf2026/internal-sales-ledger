import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  catalogo_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(1).max(200),
  quantidade: z.number().positive().max(99999),
  preco_unitario: z.number().min(0).max(999999),
});

const criarSchema = z.object({
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
          .insert({ nome: cn.nome || null, nif: cn.nif || null, telefone: cn.telefone || null } as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        clienteId = (c as { id: string }).id;
      }
    }

    const total = data.itens.reduce(
      (acc, it) => acc + it.quantidade * it.preco_unitario,
      0,
    );

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("registos" as never)
      .insert({
        caixa_diario_id: (caixa as { id: string }).id,
        utilizador_id: s.userId,
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

export const listRegistosHoje = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("../lib/guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("registos" as never)
    .select("id, numero, total, metodo_pagamento, created_at, utilizadores(nome), clientes(nome)")
    .eq("data", hoje)
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getRegisto = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ numero: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { requireSession } = await import("../lib/guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg, error } = await supabaseAdmin
      .from("registos" as never)
      .select(
        "*, utilizadores(nome), clientes(nome, nif, telefone), registo_itens(descricao, quantidade, preco_unitario, subtotal)",
      )
      .eq("numero", data.numero)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reg) throw new Error("Registo não encontrado");
    return reg;
  });
