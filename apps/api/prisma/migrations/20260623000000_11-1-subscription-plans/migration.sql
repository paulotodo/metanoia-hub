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

-- Trigger updated_at (padrão do projeto)
CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
