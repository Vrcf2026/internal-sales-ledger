-- A tabela pagamentos ficou sem RLS ativo (todas as outras tabelas têm).
-- Sem isto, fica fora do padrão de segurança em profundidade usado no
-- resto do esquema (só o service_role tem GRANT, mas o RLS é a segunda
-- camada que impede qualquer acesso via API pública mesmo que a chave
-- anon/publishable alguma vez seja exposta).
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
