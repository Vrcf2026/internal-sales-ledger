CREATE OR REPLACE FUNCTION public.verify_vendedor(p_id uuid, p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT p_password ~ '^[0-9]{4}$'
    AND EXISTS (
      SELECT 1
      FROM public.utilizadores
      WHERE id = p_id
        AND ativo = true
        AND papel = 'vendedor'
        AND password_hash = crypt(p_password, password_hash)
    );
$function$;