
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Utilizadores
CREATE TABLE public.utilizadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  papel text NOT NULL DEFAULT 'operador' CHECK (papel IN ('admin','operador')),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
GRANT ALL ON public.utilizadores TO service_role;
ALTER TABLE public.utilizadores ENABLE ROW LEVEL SECURITY;

-- Catálogo
CREATE TABLE public.catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('produto','servico')),
  preco numeric(10,2) NOT NULL DEFAULT 0,
  unidade text DEFAULT 'unidade',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
GRANT ALL ON public.catalogo TO service_role;
ALTER TABLE public.catalogo ENABLE ROW LEVEL SECURITY;

-- Clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  nif text,
  telefone text
);
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Caixa diário
CREATE TABLE public.caixa_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT current_date,
  saldo_inicial numeric(10,2) NOT NULL DEFAULT 0,
  saldo_final numeric(10,2),
  utilizador_abertura_id uuid REFERENCES public.utilizadores(id) NOT NULL,
  utilizador_fecho_id uuid REFERENCES public.utilizadores(id),
  aberto_em timestamptz DEFAULT now(),
  fechado_em timestamptz,
  estado text DEFAULT 'aberto' CHECK (estado IN ('aberto','fechado'))
);
CREATE UNIQUE INDEX caixa_diario_um_aberto_por_dia ON public.caixa_diario(data) WHERE estado = 'aberto';
CREATE INDEX caixa_diario_data_idx ON public.caixa_diario(data);
GRANT ALL ON public.caixa_diario TO service_role;
ALTER TABLE public.caixa_diario ENABLE ROW LEVEL SECURITY;

-- Saídas
CREATE TABLE public.saidas_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_diario_id uuid REFERENCES public.caixa_diario(id) NOT NULL,
  utilizador_id uuid REFERENCES public.utilizadores(id) NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sangria','despesa')),
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  criado_em timestamptz DEFAULT now()
);
CREATE INDEX saidas_caixa_caixa_idx ON public.saidas_caixa(caixa_diario_id);
GRANT ALL ON public.saidas_caixa TO service_role;
ALTER TABLE public.saidas_caixa ENABLE ROW LEVEL SECURITY;

-- Registos
CREATE SEQUENCE public.registos_numero_seq START 1;
CREATE TABLE public.registos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE DEFAULT nextval('public.registos_numero_seq'),
  data date NOT NULL DEFAULT current_date,
  descricao text,
  caixa_diario_id uuid REFERENCES public.caixa_diario(id) NOT NULL,
  utilizador_id uuid REFERENCES public.utilizadores(id) NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id),
  metodo_pagamento text NOT NULL CHECK (metodo_pagamento IN ('dinheiro','multibanco','mbway')),
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX registos_caixa_idx ON public.registos(caixa_diario_id);
CREATE INDEX registos_data_idx ON public.registos(data);
GRANT ALL ON public.registos TO service_role;
GRANT USAGE ON SEQUENCE public.registos_numero_seq TO service_role;
ALTER TABLE public.registos ENABLE ROW LEVEL SECURITY;

-- Linhas
CREATE TABLE public.registo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registo_id uuid REFERENCES public.registos(id) ON DELETE CASCADE,
  catalogo_id uuid REFERENCES public.catalogo(id),
  descricao text NOT NULL,
  quantidade numeric(10,2) NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED
);
CREATE INDEX registo_itens_registo_idx ON public.registo_itens(registo_id);
GRANT ALL ON public.registo_itens TO service_role;
ALTER TABLE public.registo_itens ENABLE ROW LEVEL SECURITY;

-- Seed admin (nome: admin, password: admin123)
INSERT INTO public.utilizadores (nome, password_hash, papel)
VALUES ('admin', crypt('admin123', gen_salt('bf', 10)), 'admin');
