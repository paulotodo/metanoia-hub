# Cenário 07 — Líder recupera acesso (manual + DevTools)

## Pré-requisitos

```bash
docker compose up -d          # Keycloak + Postgres + Redis
pnpm dev                      # frontend (3000) + backend (3001)
```

✅ Keycloak admin console acessível em `http://localhost:8080`
✅ Redis CLI disponível (`redis-cli ping` → PONG)

## Setup — usuário de teste

1. Criar conta via `/register` (ou usar seed existente)
2. Confirmar que login funciona via `/login`
3. Fazer logout (limpar sessionStorage)

---

## Golden Flow — Recuperação completa (≤3 min)

1. Abrir `/login`
2. ✅ Verificar link "Esqueci minha senha" abaixo do campo de senha
3. Clicar no link → redireciona para `/recuperar-senha`
4. ✅ Verificar título "Recuperar acesso" e campo de e-mail com autofocus
5. Digitar e-mail do usuário de teste → clicar "Enviar link"
6. ✅ Verificar transição para estado "Link enviado" com mensagem anti-enumeração
7. ✅ Verificar botão "Reenviar" desabilitado com countdown (60s)
8. Abrir logs do backend (terminal NestJS) → procurar `recovery email sent (placeholder)`
9. ✅ Verificar que o log contém `resetLink: http://localhost:3000/nova-senha/{token}`
10. Copiar o token do log → navegar para `/nova-senha/{token}`
11. ✅ Verificar título "Criar senha nova" e e-mail mascarado (ex: `m***@i***.com`)
12. Digitar nova senha (≥8 chars) → verificar checkmark verde no hint
13. Digitar confirmação idêntica → verificar checkmark verde
14. Clicar "Salvar e entrar"
15. ✅ Verificar redirect automático para `/app/gestao/radar` (se role=leader)
16. ✅ Verificar `sessionStorage.accessToken` presente (DevTools → Application → Session Storage)

---

## Edge Cases

### 🐛 E-mail inexistente (anti-enumeração)

1. Em `/recuperar-senha`, digitar e-mail que **não existe**
2. ✅ Verificar que a resposta é **idêntica** ao caso de e-mail existente ("Link enviado")
3. DevTools → Network → `POST forgot-password` → ✅ Status 200, mesmo body

### 🐛 Token expirado

1. Gerar um token via `/recuperar-senha`
2. No Redis CLI: `DEL recovery:{token}` (simula expiração dos 15 min)
3. Navegar para `/nova-senha/{token}`
4. ✅ Verificar estado "Esse link já venceu" com link para login

### 🐛 Token já usado

1. Completar o golden flow (reset com sucesso)
2. Navegar novamente para `/nova-senha/{mesmo-token}`
3. ✅ Verificar estado "Esse link já venceu" (token deletado do Redis após uso)

### 🐛 Rate limiting (3 requests/hora)

1. Em `/recuperar-senha`, submeter o mesmo e-mail 4 vezes
2. DevTools → Network → verificar que todas retornam 200
3. Redis CLI: `GET rate:recovery:{email}` → ✅ valor = 4
4. Backend logs → ✅ 4ª tentativa mostra `recovery rate limit exceeded`

### 🐛 Senhas não coincidem

1. Em `/nova-senha/{token}`, digitar senha e confirmação **diferentes**
2. ✅ Verificar mensagem "As senhas não coincidem" em vermelho

### 🐛 Senha muito curta

1. Em `/nova-senha/{token}`, digitar senha com <8 caracteres
2. Clicar "Salvar e entrar"
3. ✅ Verificar mensagem "A senha precisa ter pelo menos 8 caracteres"

### 🐛 Validação de e-mail no recovery form

1. Em `/recuperar-senha`, digitar "not-an-email"
2. Clicar "Enviar link"
3. ✅ Verificar mensagem "E-mail inválido"

---

## Resend cooldown

1. Submeter e-mail válido em `/recuperar-senha`
2. ✅ Verificar botão "Reenviar em 60s" → conta regressiva visual
3. Esperar countdown chegar a 0
4. ✅ Verificar botão muda para "Reenviar link" (habilitado)

---

## Acessibilidade

- [ ] `aria-invalid` nos campos com erro
- [ ] `aria-describedby` ligando campo a mensagem de erro
- [ ] `role="alert"` em todas as mensagens de erro
- [ ] Labels com `htmlFor` em todos os campos
- [ ] Toggle de visibilidade com `aria-label` ("Mostrar senha" / "Esconder senha")

---

## Bug report template

Se encontrar um problema:

1. Screenshot da tela
2. DevTools → Network → print do request/response relevante
3. Terminal NestJS → logs relevantes
4. Redis CLI → `GET recovery:{token}` e `GET rate:recovery:{email}`
