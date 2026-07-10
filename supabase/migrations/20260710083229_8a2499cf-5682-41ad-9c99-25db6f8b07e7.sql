
CREATE OR REPLACE FUNCTION public.verify_vendedor(p_id uuid, p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.utilizadores
    WHERE id = p_id
      AND ativo = true
      AND password_hash = crypt(p_password, password_hash)
  );
$$;
