-- BUG CRÍTICO: a coluna metodo_pagamento só aceitava dinheiro/multibanco/mbway,
-- mas o código já suporta 'credito' (vendas a crédito + conta-corrente).
-- Sem isto, qualquer venda a crédito falha a inserção na base de dados.
ALTER TABLE public.registos
  DROP CONSTRAINT IF EXISTS registos_metodo_pagamento_check;

ALTER TABLE public.registos
  ADD CONSTRAINT registos_metodo_pagamento_check
  CHECK (metodo_pagamento IN ('dinheiro', 'multibanco', 'mbway', 'credito'));

-- A tabela pagamentos (liquidações de crédito) só deve aceitar métodos reais de recebimento
ALTER TABLE public.pagamentos
  ADD CONSTRAINT pagamentos_metodo_pagamento_check
  CHECK (metodo_pagamento IN ('dinheiro', 'multibanco', 'mbway'));
