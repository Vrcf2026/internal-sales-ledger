import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hojePT } from "./date-pt";

// Estado da caixa de hoje
export const getEstadoCaixa = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("./guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hoje = hojePT();
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
  const { data: pagamentos } = await supabaseAdmin
    .from("pagamentos" as never)
    .select("valor, metodo_pagamento")
    .eq("caixa_diario_id", c.id);

  const totais = {
    dinheiro: 0,
    multibanco: 0,
    mbway: 0,
    credito: 0,
    liquidacoes: 0,
    numRegistos: (registos ?? []).length,
    sangrias: 0,
    despesas: 0,
  };
  for (const r of (registos ?? []) as {
    total: number;
    metodo_pagamento: "dinheiro" | "multibanco" | "mbway" | "credito";
  }[]) {
    if (r.metodo_pagamento === "credito") totais.credito += Number(r.total);
    else totais[r.metodo_pagamento] += Number(r.total);
  }
  for (const p of (pagamentos ?? []) as {
    valor: number;
    metodo_pagamento: "dinheiro" | "multibanco" | "mbway";
  }[]) {
    totais[p.metodo_pagamento] += Number(p.valor);
    totais.liquidacoes += Number(p.valor);
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
    z
      .object({
        saldo_inicial: z.number().min(0).max(999999),
        vendedor_id: z.string().uuid(),
        vendedor_password: z
          .string()
          .regex(/^\d{4}$/, "A password do vendedor deve ter 4 dígitos."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    const s = await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: okVend, error: vErr } = await supabaseAdmin.rpc("verify_vendedor", {
      p_id: data.vendedor_id,
      p_password: data.vendedor_password,
    } as never);
    if (vErr) throw new Error(vErr.message);
    if (!okVend) throw new Error("Vendedor ou password incorretos.");

    const hoje = hojePT();
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
    z
      .object({
        saldo_final: z.number().min(0).max(9999999),
        vendedor_id: z.string().uuid(),
        vendedor_password: z
          .string()
          .regex(/^\d{4}$/, "A password do vendedor deve ter 4 dígitos."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    const s = await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: okVend, error: vErr } = await supabaseAdmin.rpc("verify_vendedor", {
      p_id: data.vendedor_id,
      p_password: data.vendedor_password,
    } as never);
    if (vErr) throw new Error(vErr.message);
    if (!okVend) throw new Error("Vendedor ou password incorretos.");

    const hoje = hojePT();
    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id, num_fechos, reaberta")
      .eq("data", hoje)
      .eq("estado", "aberto")
      .maybeSingle();
    if (!caixa) throw new Error("Não existe caixa aberta hoje.");
    const c = caixa as { id: string; num_fechos: number; reaberta: boolean };
    // Operador só pode fazer 1 fecho por dia. Fechos adicionais (rectificações) exigem admin.
    if ((c.num_fechos ?? 0) >= 1 && s.papel !== "admin") {
      throw new Error("Este dia já foi fechado. Apenas o administrador pode rectificar o fecho.");
    }
    const { error } = await supabaseAdmin
      .from("caixa_diario" as never)
      .update({
        estado: "fechado",
        saldo_final: data.saldo_final,
        utilizador_fecho_id: s.userId,
        fechado_em: new Date().toISOString(),
        num_fechos: (c.num_fechos ?? 0) + 1,
      } as never)
      .eq("id", c.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCaixas = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        de: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        ate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("caixa_diario" as never)
      .select(
        "id, data, estado, saldo_inicial, saldo_final, aberto_em, fechado_em, num_fechos, reaberta, reaberta_em, reaberta_motivo, " +
          "abertura:utilizadores!utilizador_abertura_id(nome), fecho:utilizadores!utilizador_fecho_id(nome), reabertura:utilizadores!reaberta_por(nome)",
      )
      .order("data", { ascending: false })
      .limit(120);
    if (data.de) q = q.gte("data", data.de);
    if (data.ate) q = q.lte("data", data.ate);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCaixaDetalhe = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: caixa, error } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select(
        "*, abertura:utilizadores!utilizador_abertura_id(nome), fecho:utilizadores!utilizador_fecho_id(nome), reabertura:utilizadores!reaberta_por(nome)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!caixa) throw new Error("Caixa não encontrada.");
    const c = caixa as { id: string; saldo_inicial: number };
    const { data: registos } = await supabaseAdmin
      .from("registos" as never)
      .select(
        "id, numero, total, metodo_pagamento, anulado, created_at, vendedor:utilizadores!vendedor_id(nome), clientes(nome)",
      )
      .eq("caixa_diario_id", c.id)
      .order("numero", { ascending: true });
    const { data: saidas } = await supabaseAdmin
      .from("saidas_caixa" as never)
      .select("*, utilizadores(nome)")
      .eq("caixa_diario_id", c.id)
      .order("criado_em", { ascending: true });
    const { data: pagamentos } = await supabaseAdmin
      .from("pagamentos" as never)
      .select("valor, metodo_pagamento, created_at, descricao")
      .eq("caixa_diario_id", c.id);

    const totais = {
      dinheiro: 0,
      multibanco: 0,
      mbway: 0,
      credito: 0,
      liquidacoes: 0,
      sangrias: 0,
      despesas: 0,
      numRegistos: 0,
    };
    for (const r of (registos ?? []) as {
      total: number;
      metodo_pagamento: "dinheiro" | "multibanco" | "mbway" | "credito";
      anulado: boolean;
    }[]) {
      if (r.anulado) continue;
      totais.numRegistos += 1;
      if (r.metodo_pagamento === "credito") totais.credito += Number(r.total);
      else totais[r.metodo_pagamento] += Number(r.total);
    }
    for (const p of (pagamentos ?? []) as {
      valor: number;
      metodo_pagamento: "dinheiro" | "multibanco" | "mbway";
    }[]) {
      totais[p.metodo_pagamento] += Number(p.valor);
      totais.liquidacoes += Number(p.valor);
    }
    for (const s of (saidas ?? []) as { valor: number; tipo: "sangria" | "despesa" }[]) {
      if (s.tipo === "sangria") totais.sangrias += Number(s.valor);
      else totais.despesas += Number(s.valor);
    }
    const saldoEsperado =
      Number(c.saldo_inicial) + totais.dinheiro - totais.sangrias - totais.despesas;
    return {
      caixa,
      totais: { ...totais, saldoEsperado },
      registos: registos ?? [],
      saidas: saidas ?? [],
    };
  });

export const reabrirCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        motivo: z.string().trim().min(3).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./guard.server");
    const s = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: caixa, error: gErr } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id, data, estado")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!caixa) throw new Error("Caixa não encontrada.");
    const c = caixa as { id: string; data: string; estado: string };
    if (c.estado === "aberto") throw new Error("Esta caixa já está aberta.");
    // Não pode existir outra caixa aberta na mesma data
    const { data: outra } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id")
      .eq("data", c.data)
      .eq("estado", "aberto")
      .maybeSingle();
    if (outra) throw new Error("Já existe outra caixa aberta nesta data.");
    const { error } = await supabaseAdmin
      .from("caixa_diario" as never)
      .update({
        estado: "aberto",
        reaberta: true,
        reaberta_em: new Date().toISOString(),
        reaberta_por: s.userId,
        reaberta_motivo: data.motivo,
      } as never)
      .eq("id", c.id);
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
        vendedor_id: z.string().uuid(),
        vendedor_password: z
          .string()
          .regex(/^\d{4}$/, "A password do vendedor deve ter 4 dígitos."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    const s = await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: okVend, error: vErr } = await supabaseAdmin.rpc("verify_vendedor", {
      p_id: data.vendedor_id,
      p_password: data.vendedor_password,
    } as never);
    if (vErr) throw new Error(vErr.message);
    if (!okVend) throw new Error("Vendedor ou password incorretos.");

    const hoje = hojePT();
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
  const hoje = hojePT();
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
