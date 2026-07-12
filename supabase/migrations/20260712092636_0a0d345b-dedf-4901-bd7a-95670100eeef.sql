
ALTER TABLE public.caixa_diario
  ADD COLUMN IF NOT EXISTS reaberta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reaberta_em timestamptz,
  ADD COLUMN IF NOT EXISTS reaberta_por uuid REFERENCES public.utilizadores(id),
  ADD COLUMN IF NOT EXISTS reaberta_motivo text,
  ADD COLUMN IF NOT EXISTS num_fechos integer NOT NULL DEFAULT 0;
