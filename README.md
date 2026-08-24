# Horizon Management

Monorepo com API Node.js, frontend Next.js, PostgreSQL (Docker) e autenticação JWT.

## Estrutura

```
apps/
  api/     # Express + Prisma + JWT
  web/     # Next.js dashboard
packages/
  shared/  # Tipos compartilhados
docker-compose.yml
```

## Pré-requisitos

- Node.js 20+
- Docker Desktop

## Setup

```bash
# 1. Dependências
npm install

# 2. Copiar envs (já existe .env de desenvolvimento na API)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Postgres + migrate + seed do admin
npm run db:setup

# 4. Desenvolvimento (API :3333 + Web :3000)
npm run dev
```

## Acesso inicial

- URL: http://localhost:3000/login
- Email: `admin@horizon.local`
- Senha: `HorizonAdmin123!` (ou o valor de `SEED_ADMIN_PASSWORD`)

Só o admin cria novos usuários em **Usuários**.

## Scripts úteis

| Script | Descrição |
|--------|-----------|
| `npm run db:up` | Sobe Postgres no Docker |
| `npm run db:down` | Para o Postgres |
| `npm run db:migrate` | Roda migrations Prisma (dev) |
| `npm run db:deploy` | Aplica migrations (produção) |
| `npm run db:seed` | Recria/atualiza admin |
| `npm run dev` | Shared + API + Web |
| `npm run build` | Build de produção |

## Deploy (Render + Supabase)

A API usa duas URLs de banco:

| Variável | Uso | Supabase |
|----------|-----|----------|
| `DATABASE_URL` | Runtime da API (pooler) | Connection pooling, porta **6543**, com `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Migrations Prisma | Direct connection, porta **5432** |

No **Render** (serviço da API):

- **Build command:** `npm install && npm run prisma:deploy -w @horizon/api && npm run build -w @horizon/api`
- **Start command:** `npm run start -w @horizon/api`
- **Root directory:** repositório (monorepo)

Variáveis obrigatórias no Render: `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`, etc.

Se o deploy travar no `prisma migrate deploy`, confira se `DIRECT_URL` aponta para a porta **5432** (não o pooler 6543).

## Funcionalidades

- **Dashboard:** totais, follow-ups atrasados/hoje, ganhos no mês
- **Prospects:** lista + detalhe, responsável, próximo contato, email/WhatsApp, atividades
- **Funil:** kanban com drag-and-drop de status
- **E-mail templates:** vault público/privado com copiar
- **Auth:** JWT access + refresh httpOnly cookie; só admin cria usuários
- **Anti-duplicata:** telefone (normalizado) e link do Maps
