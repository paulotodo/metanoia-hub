-- DropForeignKey
ALTER TABLE "invites" DROP CONSTRAINT "invites_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "meeting_participants" DROP CONSTRAINT "meeting_participants_meeting_id_fkey";

-- DropForeignKey
ALTER TABLE "reflections" DROP CONSTRAINT "reflections_meeting_id_fkey";

-- AlterTable
ALTER TABLE "groups" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "meetings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "outreach_intents" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "meeting_participants_meeting_participant_uniq" RENAME TO "meeting_participants_meeting_id_participant_id_key";

-- RenameIndex
ALTER INDEX "meeting_participants_tenant_meeting_idx" RENAME TO "meeting_participants_tenant_id_meeting_id_idx";

-- RenameIndex
ALTER INDEX "meetings_tenant_group_scheduled_idx" RENAME TO "meetings_tenant_id_group_id_scheduled_for_idx";

-- RenameIndex
ALTER INDEX "outreach_intents_target_leader_idx" RENAME TO "outreach_intents_target_leader_id_idx";

-- RenameIndex
ALTER INDEX "outreach_intents_tenant_idx" RENAME TO "outreach_intents_tenant_id_idx";

-- RenameIndex
ALTER INDEX "outreach_intents_tenant_user_leader_week_uniq" RENAME TO "outreach_intents_tenant_id_created_by_user_id_target_leader_key";

-- RenameIndex
ALTER INDEX "reflections_tenant_meeting_idx" RENAME TO "reflections_tenant_id_meeting_id_idx";
