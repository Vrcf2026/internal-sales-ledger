
CREATE OR REPLACE FUNCTION public.verify_password(p_nome text, p_password text)
RETURNS TABLE(id uuid, nome text, papel text, ativo boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.id, u.nome, u.papel, u.ativo
  FROM public.utilizadores u
  WHERE u.nome = p_nome
    AND u.ativo = true
    AND u.password_hash = crypt(p_password, u.password_hash)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_password(p_id uuid, p_password text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE public.utilizadores
  SET password_hash = crypt(p_password, gen_salt('bf', 10))
  WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.verify_password(text, text) FROM public;
REVOKE ALL ON FUNCTION public.set_password(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_password(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_password(uuid, text) TO service_role;
