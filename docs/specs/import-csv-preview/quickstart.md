# Quickstart — Cenários de Teste: import-csv-preview

Fluxos críticos (happy path + error cases) + **roundtrip E2E obrigatório**
(feature multi-camada FE↔BE).

---

## Cenário 1 — Upload CSV válido + preview (happy path)

1. Admin Tenant acessa `/app/admin/igreja/grupos/{groupId}/importar`.
2. Arrasta um `.csv` (UTF-8, 23 linhas válidas) para a `FileUploadZone`.
3. **Expected**: zona mostra nome + tamanho + ícone de sucesso; parse client-side
   conclui; `CSVPreviewTable` exibe 10 linhas com colunas (Nome, E-mail,
   Telefone, Papel) e resumo "23 linhas lidas — 20 válidas, 2 críticas, 1 aviso".
   Botão avançar habilitado se 0 críticas (aqui: desabilitado, 2 críticas).

---

## Cenário 2 — Arquivo > 5 MB rejeitado (error case)

1. Admin solta um `.csv` de 7 MB.
2. **Expected**: mensagem PT-BR clara sobre o limite de 5 MB; nenhum parse
   ocorre; botão avançar permanece desabilitado (FR-02).

---

## Cenário 3 — Extensão não suportada (error case)

1. Admin solta um `.pdf`.
2. **Expected**: mensagem indicando formatos aceitos (`.csv`, `.xlsx`); arquivo
   recusado (FR-03).

---

## Cenário 4 — Baixar template sem rede

1. Admin clica "Baixar template".
2. **Expected**: download imediato de CSV com header `nome,email,telefone,papel`
   + linhas de exemplo; **nenhuma requisição de rede** (verificar na aba Network)
   (FR-04, SC-007).

---

## Cenário 5 — Encoding ISO-8859-1 / Windows-1252 (Excel BR)

1. Admin sobe CSV ISO-8859-1 com nomes "Natália", "José", "João".
2. **Expected**: preview exibe acentos corretos (sem "Jo�o") sem intervenção
   (FR-05, SC-002).

---

## Cenário 6 — XLSX multi-aba

1. Admin sobe `.xlsx` com 3 abas.
2. **Expected**: lib `xlsx` carrega via dynamic import (chunk separado);
   apenas 1ª aba processada; aviso não-bloqueante exibido (FR-06/07).

---

## Cenário 7 — check-emails marca duplicatas (aviso)

1. CSV com `joao@igreja.org` que já existe no tenant.
2. **Expected**: após retorno do `check-emails`, a linha de João ganha status
   `aviso` "Participante já cadastrado neste grupo"; resumo atualizado;
   Admin pode prosseguir (avisos não bloqueiam) (FR-13/17).

---

## Cenário 8 — API check-emails indisponível (degradação graciosa)

1. Backend retorna 503 / timeout no `check-emails`.
2. **Expected**: preview exibido sem indicador de duplicatas + aviso discreto
   "Não foi possível verificar duplicatas"; status das linhas deriva só da
   validação local; Admin não fica bloqueado (FR-21).

---

## Cenário 9 — Batch > 500 e-mails

1. CSV com 1200 linhas válidas.
2. **Expected**: cliente divide em ≥3 batches de ≤500; cada request valida no
   servidor; resultados agregados; Admin não percebe o batching (FR-20, edge case).

---

## Cenário 10 — Roundtrip End-to-End (OBRIGATÓRIO)

> Expõe drift snake_case×camelCase / shape antes que acumule. Chamada **REAL**
> ao backend (não mock, não fixture).

1. Subir API + DB de teste (docker-compose.test.yml); semear 1 user com
   `email = existente@igreja.org` no tenant T (via factory com `tenantId`).
2. Autenticar como Admin Tenant de T (Keycloak de teste).
3. Frontend (ou teste Playwright/integration) faz **chamada real**:
   `GET /api/v1/users/check-emails?emails=existente@igreja.org,novo@igreja.org`.
4. Capturar o payload de resposta REAL.
5. `checkEmailsResponseSchema.parse(payload)` — **deve passar sem erro**.
6. **Expected**:
   - `data.results` contém `{ email: "existente@igreja.org", exists: true }`
     e `{ email: "novo@igreja.org", exists: false }`.
   - `meta.tenantScoped === true`.
   - O `parse` valida que as chaves do backend (camelCase) batem com o
     contrato — se o backend emitir snake_case ou chave divergente, o teste
     FALHA aqui (não silenciosamente num mock).
7. **Tenant-isolation**: semear `outro@tenantB.org` no tenant B; chamar
   check-emails como Admin de T com `?emails=outro@tenantB.org` →
   `exists: false` (RLS confina; FR-19).

---

## Validação local antes de `done`

```bash
pnpm prisma generate
pnpm turbo build
pnpm turbo lint -- --max-warnings 0
pnpm turbo test          # inclui snapshot Zod + jest-axe
```

E2E (CI roda em pull_request):
```bash
pnpm --filter web test:e2e   # import-csv-preview.e2e-spec.ts
```
