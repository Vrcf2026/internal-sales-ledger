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
    const { data: rows, error } = await supabaseAdmin.rpc as unknown as never;
    void rows;
    void error;
    // Verify with pgcrypto via a raw select
    const { data: user, error: qErr } = await supabaseAdmin
      .from("utilizadores" as never)
      .select("id, nome, papel, ativo, password_hash")
      .eq("nome", data.nome)
      .maybeSingle();
    if (qErr) throw new Error("Erro ao consultar utilizador");
    if (!user) throw new Error("Credenciais inválidas");
    const u = user as {
      id: string;
      nome: string;
      papel: "admin" | "operador";
      ativo: boolean;
      password_hash: string;
    };
    if (!u.ativo) throw new Error("Utilizador desativado");
    // Verify password using pgcrypto
    const { data: check, error: cErr } = await supabaseAdmin.rpc("verify_password" as never, {
      p_nome: data.nome,
      p_password: data.password,
    } as never);
    // Fallback: if verify_password RPC doesn't exist, do it via a select
    let ok = false;
    if (!cErr && check === true) ok = true;
    else {
      const { data: verify } = await supabaseAdmin
        .from("utilizadores" as never)
        .select("id")
        .eq("nome", data.nome)
        .filter("password_hash", "eq", u.password_hash)
        .maybeSingle();
      // pgcrypto: crypt(p, hash) = hash. We need SQL. Use a safer path:
      void verify;
      const { supabaseAdmin: admin2 } = await import("@/integrations/supabase/client.server");
      const res = await admin2
        .schema("public")
        .rpc("verify_password" as never, {
          p_nome: data.nome,
          p_password: data.password,
        } as never);
      if (!res.error && res.data === true) ok = true;
    }
    if (!ok) throw new Error("Credenciais inválidas");

    const session = await useSession<AppSession>(sessionConfig);
    await session.update({ userId: u.id, nome: u.nome, papel: u.papel });
    return { id: u.id, nome: u.nome, papel: u.papel };
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
  .inputValidator((d: unknown) =>
    z.object({ password: z.string().min(4).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const session = await useSession<AppSession>(sessionConfig);
    if (!session.data?.userId) throw new Error("Sem sessão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("set_password" as never, {
      p_id: session.data.userId,
      p_password: data.password,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
