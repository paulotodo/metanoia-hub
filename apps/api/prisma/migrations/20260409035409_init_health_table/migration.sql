-- CreateTable
CREATE TABLE "_health" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_health_pkey" PRIMARY KEY ("id")
);
