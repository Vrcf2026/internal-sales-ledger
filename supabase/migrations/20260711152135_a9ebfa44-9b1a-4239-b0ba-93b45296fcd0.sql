CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registo_id uuid NOT NULL REFERENCES public.registos(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id),
  caixa_diario_id uuid NOT NULL REFERENCES public.caixa_diario(id),
  utilizador_id uuid NOT NULL REFERENCES public.utilizadores(id),
  vendedor_id uuid REFERENCES public.utilizadores(id),
  valor numeric NOT NULL CHECK (valor > 0),
  metodo_pagamento text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pagamentos TO service_role;

CREATE INDEX pagamentos_registo_idx ON public.pagamentos(registo_id);
CREATE INDEX pagamentos_cliente_idx ON public.pagamentos(cliente_id);
CREATE INDEX pagamentos_caixa_idx ON public.pagamentos(caixa_diario_id);