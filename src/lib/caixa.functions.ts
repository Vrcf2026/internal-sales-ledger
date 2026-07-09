import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Estado da caixa de hoje
export const getEstadoCaixa = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("./guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: caixa } = await supabaseAdmin
    .from("caixa_diario" as never)
    .select("*")
    .eq("data", hoje)
    .eq("estado", "aberto")
    .maybeSingle();

  if (!caixa) return { aberta: false, caixa: null, totais: null };

  const c = caixa as { id: string; saldo_inicial: number };
  const { data: registos } = await supabaseAdmin
    .from("registos" as never)
    .select("total, metodo_pagamento")
    .eq("caixa_diario_id", c.id)
    .eq("anulado", false);
  const { data: saidas } = await supabaseAdmin
    .from("saidas_caixa" as never)
    .select("valor, tipo")
    .eq("caixa_diario_id", c.id);

  const totais = {
    dinheiro: 0,
    multibanco: 0,
    mbway: 0,
    numRegistos: (registos ?? []).length,
    sangrias: 0,
    despesas: 0,
  };
  for (const r of (registos ?? []) as { total: number; metodo_pagamento: keyof typeof totais }[]) {
    totais[r.metodo_pagamento] += Number(r.total);
  }
  for (const s of (saidas ?? []) as { valor: number; tipo: "sangria" | "despesa" }[]) {
    if (s.tipo === "sangria") totais.sangrias += Number(s.valor);
    else totais.despesas += Number(s.valor);
  }
  const saldoEsperado =
    Number(c.saldo_inicial) + totais.dinheiro - totais.sangrias - totais.despesas;

  return { aberta: true, caixa, totais: { ...totais, saldoEsperado } };
});

export const abrirCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ saldo_inicial: z.number().min(0).max(999999) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    const s = await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: existente } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id")
      .eq("data", hoje)
      .eq("estado", "aberto")
      .maybeSingle();
    if (existente) throw new Error("Já existe uma caixa aberta para hoje.");
    const { data: nova, error } = await supabaseAdmin
      .from("caixa_diario" as never)
      .insert({
        data: hoje,
        saldo_inicial: data.saldo_inicial,
        utilizador_abertura_id: s.userId,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return nova;
  });

export const fecharCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ saldo_final: z.number().min(0).max(9999999) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    const s = await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id")
      .eq("data", hoje)
      .eq("estado", "aberto")
      .maybeSingle();
    if (!caixa) throw new Error("Não existe caixa aberta hoje.");
    const { error } = await supabaseAdmin
      .from("caixa_diario" as never)
      .update({
        estado: "fechado",
        saldo_final: data.saldo_final,
        utilizador_fecho_id: s.userId,
        fechado_em: new Date().toISOString(),
      } as never)
      .eq("id", (caixa as { id: string }).id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registarSaida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tipo: z.enum(["sangria", "despesa"]),
        descricao: z.string().trim().min(1).max(200),
        valor: z.number().positive().max(999999),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    const s = await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id")
      .eq("data", hoje)
      .eq("estado", "aberto")
      .maybeSingle();
    if (!caixa) throw new Error("Abra a caixa antes de registar saídas.");
    const { error } = await supabaseAdmin.from("saidas_caixa" as never).insert({
      caixa_diario_id: (caixa as { id: string }).id,
      utilizador_id: s.userId,
      tipo: data.tipo,
      descricao: data.descricao,
      valor: data.valor,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSaidasHoje = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("./guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: caixa } = await supabaseAdmin
    .from("caixa_diario" as never)
    .select("id")
    .eq("data", hoje)
    .eq("estado", "aberto")
    .maybeSingle();
  if (!caixa) return [];
  const { data } = await supabaseAdmin
    .from("saidas_caixa" as never)
    .select("*, utilizadores(nome)")
    .eq("caixa_diario_id", (caixa as { id: string }).id)
    .order("criado_em", { ascending: false });
  return data ?? [];
});
