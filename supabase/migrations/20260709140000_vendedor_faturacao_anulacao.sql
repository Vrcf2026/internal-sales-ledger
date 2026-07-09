-- Vendedor da venda (pode ser diferente de quem está autenticado a registar)
ALTER TABLE public.registos
  ADD COLUMN vendedor_id uuid REFERENCES public.utilizadores(id);

-- Estado de faturação (workflow externo — não gera fatura, só assinala)
ALTER TABLE public.registos
  ADD COLUMN faturado boolean NOT NULL DEFAULT false,
  ADD COLUMN faturado_em timestamptz,
  ADD COLUMN faturado_por uuid REFERENCES public.utilizadores(id);

-- Anulação (só admin) — soft, mantém o registo mas exclui-o dos totais
ALTER TABLE public.registos
  ADD COLUMN anulado boolean NOT NULL DEFAULT false,
  ADD COLUMN anulado_em timestamptz,
  ADD COLUMN anulado_por uuid REFERENCES public.utilizadores(id),
  ADD COLUMN anulado_motivo text;

-- Alteração (só admin) — regista quem/quando editou pela última vez
ALTER TABLE public.registos
  ADD COLUMN editado_em timestamptz,
  ADD COLUMN editado_por uuid REFERENCES public.utilizadores(id);

CREATE INDEX registos_vendedor_idx ON public.registos(vendedor_id);
CREATE INDEX registos_anulado_idx ON public.registos(anulado);
CREATE INDEX registos_faturado_idx ON public.registos(faturado);
