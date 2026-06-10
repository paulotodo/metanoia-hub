# ADR-002: Recuperação de senha via tokens Redis próprios (não realm action Keycloak)

**Data:** 2026-06-10
**Status:** Aceito
**Story:** 2-9 (recuperação de senha via email)
**Decisão por:** Paulo (product owner)

## Contexto

A Story 2-9 especificava recuperação de senha via o realm action nativo
`FORGOT_PASSWORD` do Keycloak (e-mail disparado pelo próprio Keycloak). A
implementação entregue pelo Cenário 07 WDS (PRs #72-#75) divergiu: usa
**tokens próprios em Redis** (UUID, TTL 900s = 15min) + fila **BullMQ** para o
e-mail, com endpoints próprios (`POST /auth/forgot-password`,
`POST /auth/reset-password`, `GET /auth/reset-password/:token/validate`). O
reset final ainda chama a Keycloak Admin API (`resetUserPassword`).

## Decisão

**Aceitar a implementação com tokens Redis próprios** e não reimplementar via
realm action do Keycloak.

## Justificativa

- A implementação é **funcionalmente completa**: anti-enumeration (resposta
  genérica + timing-safe delay), rate-limit Redis (3/h), validação OWASP, token
  15min, auto-login pós-reset, redirect por papel, mensagens pastorais para
  token expirado/usado, testes de acessibilidade.
- Dá **controle total** sobre UX, copy pastoral, rate-limit e tom do e-mail —
  difícil de customizar no fluxo nativo do Keycloak.
- Reimplementar descartaria código testado e funcional sem ganho de produto.
- O reset de senha em si permanece delegado ao Keycloak (fonte de verdade das
  credenciais), preservando a 3ª camada de segurança.

## Consequências

- **Pendência rastreada**: o worker `recovery-email.worker.ts` é placeholder
  (só loga). O transporte real de e-mail é escopo do **Epic 14 / Story 14-3
  (notificações por e-mail via Resend)**. Até lá, o link de recuperação não é
  efetivamente entregue por e-mail em produção.
- O fluxo não herda automaticamente políticas configuradas no realm action do
  Keycloak; quaisquer regras devem ser replicadas nos nossos endpoints.

## Alternativa rejeitada

Realm action `FORGOT_PASSWORD` nativo do Keycloak — mais fiel à story original,
porém descartaria a implementação funcional e dependeria de integração Keycloak
Admin real (hoje mockada no MVP) para customização de e-mail.
