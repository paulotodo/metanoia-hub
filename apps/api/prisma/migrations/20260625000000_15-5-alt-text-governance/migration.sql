-- Story 15.5: Governança alt-text — campo has_missing_alt_text no modelo Lesson
-- Apply em produção é responsabilidade MANUAL do operador (não automatizado pela pipeline)

ALTER TABLE "lessons"
  ADD COLUMN "has_missing_alt_text" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "lessons_tenant_id_has_missing_alt_text_idx"
  ON "lessons" ("tenant_id", "has_missing_alt_text");
