import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { sessionConfig, type AppSession } from "./session.server";

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1).max(60),
        password: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bloqueado } = await supabaseAdmin.rpc("esta_bloqueado", {
      p_nome: data.nome,
    } as never);
    if (bloqueado) {
      throw new Error("Demasiadas tentativas falhadas. Tente novamente dentro de 5 minutos.");
    }

    const { data: rows, error } = await supabaseAdmin.rpc("verify_password", {
      p_nome: data.nome,
      p_password: data.password,
    } as never);
    if (error) throw new Error(error.message);
    const user = Array.isArray(rows) ? rows[0] : null;
    if (!user) {
      await supabaseAdmin.rpc("registar_falha_login", { p_nome: data.nome } as never);
      throw new Error("Credenciais inválidas");
    }
    await supabaseAdmin.rpc("limpar_falhas_login", { p_nome: data.nome } as never);

    const u = user as {
      id: string;
      nome: string;
      papel: "admin" | "operador" | "vendedor";
      deve_trocar_password: boolean;
    };

    // Vendedores não têm acesso à aplicação — servem apenas para confirmar a
    // sua identidade com PIN de 4 dígitos em ações pontuais (venda, saída de
    // caixa, abertura/fecho). Um PIN de 4 dígitos é demasiado fraco para
    // proteger uma sessão completa com acesso ao registo de vendas.
    if (u.papel === "vendedor") {
      throw new Error("Este utilizador não pode iniciar sessão na aplicação.");
    }

    const session = await useSession<AppSession>(sessionConfig);
    await session.update({ userId: u.id, nome: u.nome, papel: u.papel });
    return {
      id: u.id,
      nome: u.nome,
      papel: u.papel,
      deveTrocarPassword: u.deve_trocar_password,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AppSession>(sessionConfig);
  await session.clear();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AppSession>(sessionConfig);
  if (!session.data?.userId) return null;
  return {
    id: session.data.userId,
    nome: session.data.nome!,
    papel: session.data.papel!,
  };
});

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const session = await useSession<AppSession>(sessionConfig);
    if (!session.data?.userId) throw new Error("Sem sessão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("set_password", {
      p_id: session.data.userId,
      p_password: data.password,
    } as never);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("utilizadores" as never)
      .update({ deve_trocar_password: false } as never)
      .eq("id", session.data.userId);
    return { ok: true };
  });
