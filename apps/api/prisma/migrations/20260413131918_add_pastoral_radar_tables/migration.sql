-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'membro',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pastoral_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "signal_type" TEXT NOT NULL,
    "signal_variant" TEXT,
    "context_phrase" TEXT,
    "observed_fact" TEXT,
    "system_limitation" TEXT,
    "presence_dots" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pastoral_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pastoral_actions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "performed_by" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "note" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pastoral_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pastoral_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "note_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pastoral_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenants_tenant_id_idx" ON "tenants"("tenant_id");

-- CreateIndex
CREATE INDEX "groups_tenant_id_idx" ON "groups"("tenant_id");

-- CreateIndex
CREATE INDEX "group_members_tenant_id_idx" ON "group_members"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "pastoral_alerts_tenant_id_active_idx" ON "pastoral_alerts"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "pastoral_alerts_participant_id_idx" ON "pastoral_alerts"("participant_id");

-- CreateIndex
CREATE INDEX "pastoral_actions_tenant_id_idx" ON "pastoral_actions"("tenant_id");

-- CreateIndex
CREATE INDEX "pastoral_actions_participant_id_idx" ON "pastoral_actions"("participant_id");

-- CreateIndex
CREATE INDEX "pastoral_notes_tenant_id_idx" ON "pastoral_notes"("tenant_id");

-- CreateIndex
CREATE INDEX "pastoral_notes_participant_id_note_type_idx" ON "pastoral_notes"("participant_id", "note_type");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastoral_alerts" ADD CONSTRAINT "pastoral_alerts_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastoral_alerts" ADD CONSTRAINT "pastoral_alerts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastoral_actions" ADD CONSTRAINT "pastoral_actions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastoral_actions" ADD CONSTRAINT "pastoral_actions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastoral_notes" ADD CONSTRAINT "pastoral_notes_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
