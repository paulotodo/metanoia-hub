# Data Model: a11y-formularios

> Feature: Story 12.5 — Formularios Acessiveis (NFR-A3)
> Esta feature e puramente de camada de apresentacao (frontend).
> Nao ha novas entidades de banco de dados, migracao SQL, ou alteracao
> de schema Prisma. A "camada de dados" desta feature sao os contratos
> de props/interfaces dos componentes React.

---

## N/A — Single-layer (frontend only)

Esta feature nao altera modelo de dados persistido. A justificativa:

- **Escopo**: retrofit de acessibilidade ARIA em 17 formularios existentes + criacao
  de 2 novos artefatos (`FormField`, `form-utils.ts`).
- **Sem novas tabelas**: nenhuma entidade nova em PostgreSQL.
- **Sem migracao Prisma**: nenhum schema change.
- **Sem novos endpoints**: nenhum contrato de API alterado.
- **Sem Zod changes em `packages/types`**: a spec diz explicitamente "NAO altera
  validacao Zod em `packages/types`".

---

## Interface: FormField (contrato de props)

```typescript
// apps/web/src/components/forms/form-field.tsx

interface FormFieldBaseProps {
  /** Label visiveldo campo — obrigatorio para acessibilidade. */
  label: string;
  /** ID explicito; se omitido, gerado via useId(). */
  id?: string;
  /** Mensagem de erro inline. Quando presente: aria-invalid=true, role="alert". */
  error?: string;
  /** Descricao/hint adicional (ex: "Minimo 12 caracteres"). */
  description?: string;
  /** Marca o campo como obrigatorio (aria-required="true" no controle). */
  required?: boolean;
  /** Classe CSS adicional no wrapper. */
  className?: string;
  /** Controle filho (Input, select, textarea, PasswordInputWithToggle...) */
  children: React.ReactNode;
}

interface FormFieldFieldsetProps {
  /** Variante fieldset/legend para grupos radio/checkbox. */
  variant: 'fieldset';
  legend: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

type FormFieldProps = FormFieldBaseProps | FormFieldFieldsetProps;
```

**IDs derivados (variante default)**:
| Prop | ID DOM gerado | Usado em |
|------|--------------|----------|
| `id` ou `useId()` | `${baseId}` | `htmlFor` do label e `id` do controle filho |
| erro presente | `${baseId}-error` | `aria-describedby` do controle, `id` do `<p role="alert">` |
| description presente | `${baseId}-description` | `aria-describedby` do controle, `id` do `<p>` |

**aria-describedby composto**: `[description-id, error-id].filter(Boolean).join(' ')` —
omitido quando ambos ausentes.

---

## Interface: SubmitButton (contrato de props)

```typescript
// apps/web/src/lib/form-utils.ts

interface SubmitButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'> {
  /** Texto padrao (campo obrigatorio). */
  label: string;
  /** Texto exibido durante submissao (aria-busy=true). */
  pendingLabel: string;
  /** Controla aria-busy e disabled. */
  isPending: boolean;
}
```

---

## Interface: scrollToFirstError

```typescript
// apps/web/src/lib/form-utils.ts

/**
 * Localiza o primeiro [aria-invalid="true"] no documento,
 * faz scroll suave e move o foco para ele.
 * Chamado no onSubmit de cada formulario apos validacao falhar.
 */
function scrollToFirstError(): void;
```

---

## Convencoes de Borda

**N/A — Single-layer (frontend only)**. Nao ha fronteira backend/frontend nesta feature.
Os formularios enviam dados para APIs ja existentes; esta feature nao altera contratos de API.

| Camada | Case style | Observacao |
|--------|------------|------------|
| Props de componente React | camelCase | Convencao TypeScript/React |
| IDs DOM gerados | kebab-case via prefixo `useId()` | React 18 gera `:r0:`, `:r1:` etc. — concatenar sufixo `-error` |
| Chaves i18n `pt-BR.json` | kebab-case namespace dotted | ex: `form.error.required` |
| Atributos ARIA no DOM | kebab-case | `aria-invalid`, `aria-describedby` |

---

## Mapeamento formulario -> gaps ARIA (auditoria pre-implementacao)

| Formulario | Faltando (gap) | Acao |
|-----------|---------------|------|
| `login-form.tsx` | aria-required, aria-describedby->erro, aria-invalid, scrollToFirstError, aria-busy | Retrofitar com FormField |
| `register-form.tsx` | aria-required, scrollToFirstError, aria-busy | Ja tem aria-describedby/aria-invalid parcial; completar |
| `create-account-form.tsx` | audit completo necessario | Retrofitar com FormField |
| `Step1Profile.tsx` | aria-label no input file, role="alert" no upload error, aria-busy | Retrofit cirurgico |
| `Step2Community.tsx` | fieldset/legend para cidade+estado, aria-label no logo file, aria-busy | Retrofit cirurgico |
| `Step3Group.tsx` | fieldset/legend para radiogroup, aria-invalid, aria-describedby, aria-required, aria-busy | Refactor radiogroup |
| `Step4Invite.tsx` | aria-required, aria-describedby->erro, aria-invalid, "(opcional)", aria-busy | Retrofit com FormField |
| `recovery-form.tsx` | audit completo necessario | Retrofitar com FormField |
| `reset-password-form.tsx` | audit completo necessario | Retrofitar com FormField |
| `group-form.tsx` | aria-invalid dinamico, scrollToFirstError | Ja tem aria-describedby estatico; dinamizar |
| `invite-members-form.tsx` | remover aria-label redundante, aria-describedby->erro | Retrofit cirurgico |
| `create-group-form.tsx` | audit completo necessario | Retrofitar com FormField |
| `group-trails-client.tsx` | audit completo necessario | Retrofitar com FormField |
| `radar/cuidado/page.tsx` | audit completo necessario | Retrofitar com FormField |
| `reunioes/reflexao/page.tsx` | audit completo necessario | Retrofitar com FormField |
| `reflection-form-field.tsx` | prop required? + aria-required | Retrofit cirurgico |
| `contact-message-form.tsx` | aria-describedby, scrollToFirstError, label para select | Retrofit |
| `demo-request-form.tsx` | aria-describedby, scrollToFirstError, label para select | Retrofit |
