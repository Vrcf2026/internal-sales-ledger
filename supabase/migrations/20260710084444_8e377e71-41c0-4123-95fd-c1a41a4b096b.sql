ALTER TABLE public.utilizadores
  DROP CONSTRAINT IF EXISTS utilizadores_papel_check;

ALTER TABLE public.utilizadores
  ADD CONSTRAINT utilizadores_papel_check
  CHECK (papel IN ('admin', 'operador', 'vendedor'));

CREATE OR REPLACE FUNCTION public.verify_vendedor(p_id uuid, p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.utilizadores
    WHERE id = p_id
      AND ativo = true
      AND papel = 'vendedor'
      AND p_password ~ '^[0-9]{4}$'
      AND password_hash = crypt(p_password, password_hash)
  );
$function$;

REVOKE ALL ON FUNCTION public.verify_vendedor(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_vendedor(uuid, text) TO service_role;