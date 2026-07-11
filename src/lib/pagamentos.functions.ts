import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const METODOS = ["dinheiro", "multibanco", "mbway"] as const;

export const registarPagamento = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        registo_id: z.string().uuid(),
        valor: z.number().positive().max(999999),
        metodo_pagamento: z.enum(METODOS),
        descricao: z.string().trim().max(200).optional().nullable(),
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

    const hoje = new Date().toISOString().slice(0, 10);
    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario" as never)
      .select("id")
      .eq("data", hoje)
      .eq("estado", "aberto")
      .maybeSingle();
    if (!caixa) throw new Error("Abra a caixa antes de registar pagamentos.");

    const { data: reg, error: rErr } = await supabaseAdmin
      .from("registos" as never)
      .select("id, cliente_id, total, anulado, metodo_pagamento")
      .eq("id", data.registo_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!reg) throw new Error("Registo não encontrado.");
    const r = reg as {
      id: string;
      cliente_id: string | null;
      total: number;
      anulado: boolean;
      metodo_pagamento: string;
    };
    if (r.anulado) throw new Error("Registo anulado.");
    if (r.metodo_pagamento !== "credito")
      throw new Error("Só é possível liquidar vendas a crédito.");

    // saldo em dívida
    const { data: pagos } = await supabaseAdmin
      .from("pagamentos" as never)
      .select("valor")
      .eq("registo_id", r.id);
    const jaPago = (pagos ?? []).reduce(
      (a, p) => a + Number((p as { valor: number }).valor),
      0,
    );
    const emDivida = Number(r.total) - jaPago;
    if (emDivida <= 0) throw new Error("Esta venda já está totalmente liquidada.");
    if (data.valor > emDivida + 0.001)
      throw new Error(`O valor excede o saldo em dívida (${emDivida.toFixed(2)} €).`);

    const { error: insErr } = await supabaseAdmin.from("pagamentos" as never).insert({
      registo_id: r.id,
      cliente_id: r.cliente_id,
      caixa_diario_id: (caixa as { id: string }).id,
      utilizador_id: s.userId,
      vendedor_id: data.vendedor_id,
      valor: Number(data.valor.toFixed(2)),
      metodo_pagamento: data.metodo_pagamento,
      descricao: data.descricao || null,
    } as never);
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

export type ContaCorrenteRegisto = {
  id: string;
  numero: number;
  data: string;
  total: number;
  pago: number;
  saldo: number;
  descricao: string | null;
  cliente: { id: string; nome: string | null; nif: string | null; telefone: string | null } | null;
};

export const listContaCorrente = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("./guard.server");
  await requireSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: regs, error } = await supabaseAdmin
    .from("registos" as never)
    .select(
      "id, numero, data, total, descricao, cliente_id, clientes(id, nome, nif, telefone), pagamentos(valor)",
    )
    .eq("metodo_pagamento", "credito")
    .eq("anulado", false)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);

  const rows: ContaCorrenteRegisto[] = ((regs ?? []) as unknown as Array<{
    id: string;
    numero: number;
    data: string;
    total: number;
    descricao: string | null;
    clientes: { id: string; nome: string | null; nif: string | null; telefone: string | null } | null;
    pagamentos: { valor: number }[] | null;
  }>).map((r) => {
    const pago = (r.pagamentos ?? []).reduce((a, p) => a + Number(p.valor), 0);
    return {
      id: r.id,
      numero: r.numero,
      data: r.data,
      total: Number(r.total),
      pago: Number(pago.toFixed(2)),
      saldo: Number((Number(r.total) - pago).toFixed(2)),
      descricao: r.descricao,
      cliente: r.clientes,
    };
  });

  return rows;
});

export const listPagamentosRegisto = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ registo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireSession } = await import("./guard.server");
    await requireSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("pagamentos" as never)
      .select("*, vendedor:utilizadores!vendedor_id(nome), operador:utilizadores!utilizador_id(nome)")
      .eq("registo_id", data.registo_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
