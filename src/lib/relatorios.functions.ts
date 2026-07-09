import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type MetodoPag = "dinheiro" | "multibanco" | "mbway";

export const relatorioIntervalo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("../lib/guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: registos } = await supabaseAdmin
      .from("registos" as never)
      .select("total, metodo_pagamento, data")
      .gte("data", data.de)
      .lte("data", data.ate)
      .eq("anulado", false);
    const { data: caixas } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id, data, saldo_inicial, saldo_final")
      .gte("data", data.de)
      .lte("data", data.ate)
      .order("data", { ascending: true });
    const caixaIds = (caixas ?? []).map((c) => (c as { id: string }).id);
    const { data: saidas } = caixaIds.length
      ? await supabaseAdmin
          .from("saidas_caixa" as never)
          .select("valor, tipo, caixa_diario_id")
          .in("caixa_diario_id", caixaIds)
      : { data: [] };

    const totais = { dinheiro: 0, multibanco: 0, mbway: 0, numRegistos: 0, total: 0 };
    for (const r of (registos ?? []) as { total: number; metodo_pagamento: MetodoPag }[]) {
      totais[r.metodo_pagamento] += Number(r.total);
      totais.total += Number(r.total);
      totais.numRegistos += 1;
    }
    let totalSangrias = 0;
    let totalDespesas = 0;
    for (const s of (saidas ?? []) as { valor: number; tipo: "sangria" | "despesa" }[]) {
      if (s.tipo === "sangria") totalSangrias += Number(s.valor);
      else totalDespesas += Number(s.valor);
    }

    return { totais, totalSangrias, totalDespesas, caixas: caixas ?? [] };
  });
