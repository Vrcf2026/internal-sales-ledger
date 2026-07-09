-- Força troca de password no primeiro login
ALTER TABLE public.utilizadores
  ADD COLUMN deve_trocar_password boolean NOT NULL DEFAULT false;

UPDATE public.utilizadores
  SET deve_trocar_password = true
  WHERE nome = 'admin';

CREATE OR REPLACE FUNCTION public.verify_password(p_nome text, p_password text)
RETURNS TABLE(id uuid, nome text, papel text, ativo boolean, deve_trocar_password boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.id, u.nome, u.papel, u.ativo, u.deve_trocar_password
  FROM public.utilizadores u
  WHERE u.nome = p_nome
    AND u.ativo = true
    AND u.password_hash = crypt(p_password, u.password_hash)
  LIMIT 1;
$$;

-- Registo de tentativas de login falhadas (rate limiting persistente,
-- sobrevive a reinícios do servidor, ao contrário de um Map em memória)
CREATE TABLE public.login_tentativas (
  nome text PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz
);
GRANT ALL ON public.login_tentativas TO service_role;
ALTER TABLE public.login_tentativas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.registar_falha_login(p_nome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_tentativas (nome, falhas, bloqueado_ate)
  VALUES (p_nome, 1, NULL)
  ON CONFLICT (nome) DO UPDATE
  SET falhas = login_tentativas.falhas + 1,
      bloqueado_ate = CASE
        WHEN login_tentativas.falhas + 1 >= 5
        THEN now() + interval '5 minutes'
        ELSE login_tentativas.bloqueado_ate
      END;
END;
$$;

CREATE OR REPLACE FUNCTION public.limpar_falhas_login(p_nome text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_tentativas WHERE nome = p_nome;
$$;

CREATE OR REPLACE FUNCTION public.esta_bloqueado(p_nome text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT bloqueado_ate > now() FROM public.login_tentativas WHERE nome = p_nome),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.registar_falha_login(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limpar_falhas_login(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.esta_bloqueado(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registar_falha_login(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.limpar_falhas_login(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.esta_bloqueado(text) TO service_role;
