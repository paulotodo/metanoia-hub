# Cenário 04 — Champion descobre, apresenta e ativa (validação manual)

Checklist reproduzível para validar localmente o golden flow do Cenário 04 — funil público/SSR do site marketing (sem auth, sem RLS, sem TanStack Query, sem MSW).

> Tempo estimado: ~10 min após setup. Use sempre que tocar em `apps/web/app/(marketing)/**`, `apps/web/src/components/marketing/**` ou `apps/api/src/marketing/**`.

---

## Pré-requisitos

- Docker + Docker Compose
- Node 22+, pnpm 10.33+
- Repositório clonado e com dependências instaladas (`pnpm install`)

---

## Setup

### 1. Subir infra local

```bash
docker compose up -d
```

Verifica:
- ✅ Postgres em `localhost:5432`
- ✅ Redis em `localhost:6379`

> Keycloak e LiveKit **não** são necessários para o Cenário 04 (funil público sem auth).

### 2. Migrar BD (inclui tabelas marketing)

```bash
pnpm --filter @metanoia/api db:setup
```

✅ Migrations aplicadas sem erro. Deve ter criado as tabelas `demo_requests` e `contact_messages` (migration `20260416180000_add_marketing_funnel_tables`).

> **Nota multi-tenancy**: as tabelas `demo_requests` e `contact_messages` **não** têm `tenant_id` nem RLS — exceção explícita documentada no migration SQL (dados públicos de funil, não pertencem a nenhum tenant). Confirmar com `psql -c "\d demo_requests"` que não há coluna `tenant_id`.

### 3. Iniciar API

```bash
pnpm --filter @metanoia/api dev
```

✅ NestJS sobe em `http://localhost:3001`. Logs mostram `MarketingModule` + `MarketingRateLimitGuard` carregados.

### 4. Iniciar Web

```bash
pnpm --filter @metanoia/web dev
```

✅ Next sobe em `http://localhost:3000`. A landing `/` renderiza SSR (ver HTML via `curl -s http://localhost:3000/ | grep "Tecnologia que devolve"` — deve haver match).

---

## Golden flow

### 5. Landing `/`

- Abre `http://localhost:3000`.
- ✅ Hero renderiza com headline `Tecnologia que devolve o pastor ao rebanho`.
- ✅ 2 CTAs do hero: "Começar" (→ `/comecar`) e "Ler manifesto" (→ `/manifesto`).
- ✅ Blocos de features (3) e personas (3) visíveis.
- ✅ Nav superior com 7 links + CTA primário "Começar".
- ✅ Footer com 3 seções (Produto, Igreja, Contato) + copyright.

### 6. Manifesto `/manifesto`

- Clica em "Ler manifesto" no hero (ou nav → "Manifesto").
- ✅ Página renderiza SSR com tipografia generosa (680px max-width).
- ✅ Texto pastoral presente (não corporativo). Linha "Recusamos funil, KPI, conversão, churn, lead" é **meta-linguagem intencional** — não remover.
- ✅ CTA final → `/funcionalidades`.

### 7. Funcionalidades `/funcionalidades`

- Nav → "Funcionalidades".
- ✅ Grelha de blocos de features com texto pastoral + placeholders de screenshot (retângulos cinzentos).

### 8. Preços `/precos`

- Nav → "Preços".
- ✅ 3 `PricingCard` (free, pro, enterprise) com preço, features, CTA.
- ✅ FAQ accordion abaixo — expande/colapsa ao clicar.
- ✅ Clicar em "Começar" em qualquer plano → `/comecar`.

### 9. Apresentação `/apresentacao`

- Nav → "Apresentação".
- ✅ `DeckLight` com 8 slides renderizados SSR (scroll vertical).
- ✅ Botão "Baixar PDF" → tenta baixar `/apresentacao-metanoia.pdf` (placeholder — pode 404 até gerarmos o PDF; documentado em Session 5 como TODO editorial).
- ✅ Botão "Copiar link" copia `window.location.href` para o clipboard.

### 10. Começar `/comecar` (submit real)

- Nav → "Começar" (CTA primário).
- ✅ Form com 5 campos: `Nome`, `E-mail`, `Nome da igreja`, `Tamanho` (select com 4 opções), `Função` (opcional).
- Preencher:
  - Nome: `Pastor de Teste`
  - E-mail: `teste@igrejaqualquer.org`
  - Igreja: `Igreja de Teste`
  - Tamanho: `50 a 200 pessoas`
  - Função: (deixar vazio)
- Clicar "Quero ver ao vivo".
- ✅ Botão passa para "Enviando...", depois bloco verde aparece:
  - Heading: "Recebemos seu pedido."
  - Body: "Nossa equipa entra em contato em até 1 dia útil. Pode fechar esta aba com tranquilidade."
- ✅ DevTools network: `POST /api/v1/marketing/demo-requests` → `201`.
- ✅ Response body: `{ data: { demoRequestId, fullName, email, churchName, churchSize, role: null, createdAt } }`.

🐛 Se erro: verificar console NestJS (deve logar `demo request received` com `demoRequestId` e `email`).

### 11. Começar — validação Zod inline

- Recarregar `/comecar`.
- Submeter com email inválido: `naoehemail`.
- ✅ Inline error abaixo do campo e-mail: "E-mail inválido".
- ✅ **Não** faz POST ao backend (react-hook-form bloqueia antes do `onSubmit`).

### 12. Contato `/contato` (submit real)

- Nav → footer "Contato" ou URL direto.
- ✅ Form com 3 campos: `Nome`, `E-mail`, `Mensagem` (textarea).
- Preencher + submeter.
- ✅ Bloco verde: "Mensagem recebida. Respondemos por e-mail em até 2 dias úteis."
- ✅ Network: `POST /api/v1/marketing/contact-messages` → `201`.

### 13. Rate-limit (6ª requisição no mesmo IP)

- Usar `curl` para disparar 6 POSTs seguidos:

```bash
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3001/api/v1/marketing/contact-messages \
    -H 'Content-Type: application/json' \
    -d '{"fullName":"Teste","email":"rl@test.com","message":"Teste de rate limit."}'
done
```

- ✅ Primeiras 5 → `201`.
- ✅ 6ª → `429` com body `{ "statusCode": 429, "error": "TooManyRequests", "message": "Muitas requisições. Aguarde alguns instantes e tente de novo.", "details": { "retryAfterSec": 60 } }`.
- Aguardar ~60s → próximo POST volta a passar.

### 14. Persistência em Prisma

- Abrir Prisma Studio: `pnpm --filter @metanoia/api exec prisma studio`.
- ✅ Tabela `demo_requests` tem a linha do passo 10 (`email = teste@igrejaqualquer.org`).
- ✅ Tabela `contact_messages` tem a linha do passo 12.
- ✅ Ambas as tabelas têm colunas `ip_address`, `user_agent`, `created_at`.
- ✅ **Nenhuma** das tabelas tem coluna `tenant_id` (confirma exceção multi-tenant).

### 15. OG tags per-page

- `curl -s http://localhost:3000/manifesto | grep 'property="og:'`.
- ✅ `og:title` contém "Manifesto — porque o metanoia existe".
- ✅ `og:description` contém texto do manifesto.
- Repetir para `/precos`, `/comecar`, `/contato`, `/apresentacao` — cada rota retorna seu próprio `og:title`/`og:description`.

---

## Sanity checks adicionais

### Guard de tom pastoral

```bash
rg -i "engagement|funnel|\bKPI\b|\bROI\b|\blead\b|conversão|churn" \
   apps/web/messages/pt-BR.json \
   apps/web/app/\(marketing\)/ \
   apps/web/src/components/marketing/
```

✅ Esperado: **2 matches**, ambos **meta-linguagem intencional**:
- `apps/web/messages/pt-BR.json:333` — `"Nada de funil, KPI ou conversão. Aqui falamos de cuidado..."`
- `apps/web/app/(marketing)/manifesto/page.tsx:52` — `"Recusamos funil, KPI, conversão, churn, lead..."`

🐛 Qualquer match NOVO além destes dois → bloquear PR até reescrever em linguagem pastoral.

### Integration tests backend

```bash
pnpm --filter @metanoia/api exec vitest run test/marketing
```

✅ Todos os testes de `test/marketing/marketing.integration-spec.ts` verdes (4 testes). Requer `DATABASE_APP_URL` populada + docker up.

### Unit tests backend marketing

```bash
pnpm --filter @metanoia/api exec vitest run src/marketing
```

✅ 7/7 testes verdes (`marketing.service.spec` 3 + `rate-limit.guard.spec` 4).

### Lighthouse

```bash
# com `pnpm --filter @metanoia/web dev` a correr
npx lighthouse http://localhost:3000/ --only-categories=performance,seo --view
npx lighthouse http://localhost:3000/manifesto --only-categories=performance,seo --view
```

✅ Alvo: Performance ≥ 90, SEO ≥ 95 em ambas as rotas. Se falhar, investigar fonts, images, bundle size.

---

## O que fica para Release 1b

- **Motion self-serve** (animações, transições cuidadas entre pages, micro-interações) — fora do escopo do MVP.
- **PDF real de apresentação** — hoje é placeholder 404. Gerar a partir do `DeckLight` ou via export do Keynote/PDF-kit.
- **CMS para blog** — hoje usa MDX estático em `apps/web/content/blog/`. Migrar para Sanity/Contentful só se o ritmo editorial justificar.
- **Capturas de tela reais em `/funcionalidades`** — hoje são retângulos cinzentos com label.
- **OG images dedicadas por rota** (atualmente só herda a imagem do layout, se houver).
- **Playwright E2E automatizado** — hoje toda a validação é manual neste checklist. Adicionar infra Playwright quando o ritmo de mudanças no funil justificar automação.

---

## Como reportar um bug encontrado neste flow

1. Capturar passo + comportamento esperado vs. observado.
2. Anexar:
   - Screenshot da UI no momento do bug.
   - Print do DevTools → Network → request relevante.
   - Print do console NestJS dos últimos 10 segundos.
3. Abrir issue com label `cenario-04` + `bug` + linkar para a linha desta checklist que falhou.

---

## Quando rodar esta checklist

- ✅ Antes de abrir PR que mexa em `apps/web/app/(marketing)/**`, `apps/web/src/components/marketing/**` ou `apps/api/src/marketing/**`.
- ✅ Antes de cada release que inclua mudanças nas páginas públicas.
- ✅ Após qualquer migração nova em `demo_requests` / `contact_messages`.
