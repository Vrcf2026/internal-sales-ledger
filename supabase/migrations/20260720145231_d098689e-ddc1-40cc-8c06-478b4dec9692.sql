
ALTER TABLE public.catalogo
  ADD COLUMN IF NOT EXISTS preco2 numeric NOT NULL DEFAULT 0;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS linha_preco smallint NOT NULL DEFAULT 1;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_linha_preco_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_linha_preco_check CHECK (linha_preco IN (1,2));
