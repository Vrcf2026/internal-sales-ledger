
REVOKE ALL ON FUNCTION public.verify_vendedor(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_vendedor(uuid, text) TO service_role;
