// Server-only session config for TanStack useSession (iron-session-style encrypted cookie).
export type AppSession = {
  userId?: string;
  nome?: string;
  papel?: "admin" | "operador" | "vendedor";
};

export const sessionConfig = {
  password: process.env.SESSION_SECRET!,
  name: "cv_sess",
  maxAge: 60 * 60 * 12, // 12h
  cookie: {
    httpOnly: true,
    sameSite: "none" as const,
    secure: true,
    path: "/",
  },
};
