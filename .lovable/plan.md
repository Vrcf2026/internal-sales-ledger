## Aplicação de Controlo Interno de Vendas

App interna (não fiscal) para gerir vendas, caixa diário e catálogo. Autenticação própria via tabela `utilizadores` (sem Supabase Auth). Terminologia: "registo" e "talão de controlo" — nunca "fatura" ou "recibo".

### Stack e infra
- TanStack Start + React + TS (já configurado no projeto)
- Lovable Cloud (Supabase) — a ativar
- Autenticação custom: password hash com bcrypt via server function, sessão em cookie httpOnly assinado
- Todas as operações passam por server functions (RLS desligado nestas tabelas, acesso apenas via service role no servidor após validar sessão)

### Base de dados
Criar as 7 tabelas exatamente com o SQL fornecido pelo utilizador. Adicionar:
- Índices em `caixa_diario(data, estado)`, `registos(caixa_diario_id)`, `saidas_caixa(caixa_diario_id)`, `registo_itens(registo_id)`
- GRANTs apenas a `service_role` (acesso é sempre servidor-side)
- Utilizador admin inicial via migração seed (nome: `admin`, password pedida no primeiro login / definida por env; documento na UI)

### Autenticação
- `POST` server fn `login({ nome, password })` → verifica hash bcrypt, cria cookie `sess` (JWT HS256 assinado com `SESSION_SECRET` gerado)
- `logout` limpa cookie
- Middleware `requireSession` e `requireAdmin` para server functions
- Hook `useSession` no cliente lê session via server fn `me()`

### Rotas (TanStack file-based)
```
/auth                → login
/_app/                → layout protegido (redireciona para /auth se sem sessão)
  /                  → dashboard (estado da caixa do dia, atalhos)
  /caixa             → abrir/fechar caixa, ver saídas, sangrias/despesas
  /vendas            → nova venda + lista de registos do dia
  /vendas/$numero    → talão de controlo (impressão)
  /catalogo          → CRUD produtos/serviços (admin)
  /clientes          → CRUD clientes
  /utilizadores      → CRUD utilizadores (admin)
  /relatorios        → fecho de caixa + relatório por intervalo
```

### Funcionalidades chave
1. **Login**: nome + password → sessão
2. **Caixa diário**: abrir com saldo inicial (única aberta por dia). Fecho calcula: `saldo_inicial + Σ vendas dinheiro − Σ sangrias − Σ despesas`. Regista `utilizador_fecho_id`.
3. **Catálogo (admin)**: CRUD produtos/serviços
4. **Registos**: número sequencial (default da sequência SQL), linhas do catálogo ou manuais, cliente opcional (criar inline), método pagamento. Só permitido com caixa aberta do dia. Total = Σ subtotais.
5. **Talão de controlo**: view imprimível com número, data, linhas, total, método, operador, com marca "Documento interno — sem valor fiscal".
6. **Saídas de caixa**: sangria/despesa na caixa aberta.
7. **Relatórios**: fecho diário (por caixa) + intervalo de datas (totais por método, nº registos, saídas).

### Design
Interface limpa, densa mas legível — pensado para uso rápido em balcão. Paleta neutra com um acento verde (confirmação de venda). Tipografia sans (Inter). Sem placeholders genéricos.

### Segurança
- Todas as escritas/leituras via server functions com verificação de sessão + papel
- Password hash bcrypt (12 rounds)
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção
- `SESSION_SECRET` gerado automaticamente

### Passos de implementação
1. Ativar Lovable Cloud
2. Migração: criar todas as tabelas + índices + GRANTs + seed admin (password default `admin123`, avisar na UI para trocar)
3. Gerar `SESSION_SECRET`
4. Server: helpers `session.server.ts`, `password.server.ts`; server fns para auth, caixa, catálogo, clientes, utilizadores, vendas, relatórios
5. UI: layout `_app`, rota `/auth`, todas as páginas listadas
6. Componente talão de controlo imprimível
7. Header com nome do operador, estado da caixa, logout

Após aprovação, avanço com a implementação completa.