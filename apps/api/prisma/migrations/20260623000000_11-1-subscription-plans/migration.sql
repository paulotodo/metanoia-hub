-- Story 11-1: Planos de Assinatura & Limites Dinâmicos
-- SubscriptionPlan global table + tenants.plan_limits_override column
-- FR-INFRA-02, FR-INFRA-06, CT-5

-- Tabela global de planos (sem RLS por tenant — configuração de produto; apenas SUPER_ADMIN escreve)
CREATE TABLE subscription_plans (
  id            UUID         PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  tier          VARCHAR(20)  NOT NULL UNIQUE,
  limits        JSONB        NOT NULL,
  features      JSONB        NOT NULL DEFAULT '{}',
  metadata      JSONB        NOT NULL DEFAULT '{}',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Coluna de override por-tenant (nullable; coberta pela RLS existente de tenants)
ALTER TABLE tenants
  ADD COLUMN plan_limits_override JSONB;

-- CT-5: índice para write-through Redis ao PATCH de plano (itera tenants por tier)
-- Permite WHERE plan = $1 eficiente ao invalidar cache após edição de SubscriptionPlan
CREATE INDEX idx_tenants_plan ON tenants(plan);

-- updated_at é gerenciado pela camada de aplicação (Prisma @updatedAt),
-- padrão real do projeto — não há trigger de DB. O DEFAULT NOW() cobre o INSERT.
