// Shared session guard used inside server-fn handlers.
// Load inside handler bodies only (this file is server-only via .server.ts).
import { useSession } from "@tanstack/react-start/server";
import { sessionConfig, type AppSession } from "./session.server";

export async function requireSession() {
  const session = await useSession<AppSession>(sessionConfig);
  if (!session.data?.userId) throw new Error("Sem sessão. Inicie sessão novamente.");
  return {
    userId: session.data.userId,
    nome: session.data.nome!,
    papel: session.data.papel!,
  };
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.papel !== "admin") throw new Error("Apenas administradores.");
  return s;
}
