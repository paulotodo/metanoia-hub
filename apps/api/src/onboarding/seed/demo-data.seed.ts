/**
 * Story 10-2 — Demo data seed per tenant.
 *
 * Seeds realistic demo data for a tenant's onboarding experience:
 * - Grupo Alpha (1 group)
 * - Marcos Silva (leader, no Keycloak account)
 * - 3 participants with distinct traffic-light states:
 *     Ana Costa  (verde  — 80% trail, integral presence, action concluída)
 *     Pedro Santos (amarelo — 40% trail, parcial presence, action pendente)
 *     Maria Oliveira (vermelho — 10% trail, ausente presence, action urgente)
 * - Trilha "Fundamentos da Fé" (2 modules, 4 lessons: video stub + rich text mix)
 * - 1 past meeting with presence records in PostgreSQL meeting_attendance/telemetry
 * - 3 pastoral actions, one per participant
 *
 * Idempotent: fixed UUID v7 IDs with prefix 01989b10-1002-7000-8000-
 * (distinct from Story 7-2 prefix 019899a0-7002-...).
 * Re-running upserts without duplicating rows.
 *
 * Isolation: seedDemoData(tenantId) runs OUTSIDE withTenantTx so the seed
 * can be called from the provisioning saga (pre-request-context).
 * Each upsert uses explicit tenantId.
 *
 * Usage (CLI): pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <UUID>
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ---------------------------------------------------------------------------
// Fixed UUID v7 IDs — prefix 01989b10-1002-7000-8000- (Story 10-2)
// Distinct from Story 7-2 (019899a0-7002-7000-8000-)
// ---------------------------------------------------------------------------

export const DEMO_GROUP_ID = '01989b10-1002-7000-8000-000000000001';
export const DEMO_LEADER_ID = '01989b10-1002-7000-8000-000000000002'; // Marcos Silva
export const DEMO_USER_ANA_ID = '01989b10-1002-7000-8000-000000000003';
export const DEMO_USER_PEDRO_ID = '01989b10-1002-7000-8000-000000000004';
export const DEMO_USER_MARIA_ID = '01989b10-1002-7000-8000-000000000005';

export const DEMO_TRAIL_ID = '01989b10-1002-7000-8000-000000000010';
export const DEMO_MODULE_1_ID = '01989b10-1002-7000-8000-000000000011';
export const DEMO_MODULE_2_ID = '01989b10-1002-7000-8000-000000000012';
export const DEMO_LESSON_1_ID = '01989b10-1002-7000-8000-000000000021'; // video stub
export const DEMO_LESSON_2_ID = '01989b10-1002-7000-8000-000000000022'; // rich text
export const DEMO_LESSON_3_ID = '01989b10-1002-7000-8000-000000000023'; // video stub
export const DEMO_LESSON_4_ID = '01989b10-1002-7000-8000-000000000024'; // rich text

export const DEMO_MEETING_ID = '01989b10-1002-7000-8000-000000000030';

// MeetingAttendance IDs
const DEMO_ATTENDANCE_LEADER_ID = '01989b10-1002-7000-8000-000000000031';
const DEMO_ATTENDANCE_ANA_ID = '01989b10-1002-7000-8000-000000000032';
const DEMO_ATTENDANCE_PEDRO_ID = '01989b10-1002-7000-8000-000000000033';

// MeetingTelemetry IDs
const DEMO_TELEMETRY_LEADER_ID = '01989b10-1002-7000-8000-000000000034';
const DEMO_TELEMETRY_ANA_ID = '01989b10-1002-7000-8000-000000000035';
const DEMO_TELEMETRY_PEDRO_ID = '01989b10-1002-7000-8000-000000000036';

// GroupMember IDs
const DEMO_MEMBER_LEADER_ID = '01989b10-1002-7000-8000-000000000051';
const DEMO_MEMBER_ANA_ID = '01989b10-1002-7000-8000-000000000052';
const DEMO_MEMBER_PEDRO_ID = '01989b10-1002-7000-8000-000000000053';
const DEMO_MEMBER_MARIA_ID = '01989b10-1002-7000-8000-000000000054';

// TrailProgress IDs
const DEMO_TRAIL_PROGRESS_ANA_ID = '01989b10-1002-7000-8000-000000000061';
const DEMO_TRAIL_PROGRESS_PEDRO_ID = '01989b10-1002-7000-8000-000000000062';
const DEMO_TRAIL_PROGRESS_MARIA_ID = '01989b10-1002-7000-8000-000000000063';

// ModuleProgress IDs
const DEMO_MOD1_PROGRESS_ANA_ID = '01989b10-1002-7000-8000-000000000071';
const DEMO_MOD1_PROGRESS_PEDRO_ID = '01989b10-1002-7000-8000-000000000072';
const DEMO_MOD1_PROGRESS_MARIA_ID = '01989b10-1002-7000-8000-000000000073';
const DEMO_MOD2_PROGRESS_ANA_ID = '01989b10-1002-7000-8000-000000000074';
const DEMO_MOD2_PROGRESS_PEDRO_ID = '01989b10-1002-7000-8000-000000000075';
const DEMO_MOD2_PROGRESS_MARIA_ID = '01989b10-1002-7000-8000-000000000076';

export const DEMO_ACTION_ANA_ID = '01989b10-1002-7000-8000-000000000041';
export const DEMO_ACTION_PEDRO_ID = '01989b10-1002-7000-8000-000000000042';
export const DEMO_ACTION_MARIA_ID = '01989b10-1002-7000-8000-000000000043';

// ---------------------------------------------------------------------------
// Core seed function — idempotent, no RLS (runs outside request context)
// ---------------------------------------------------------------------------

/**
 * Seeds demo data for the given tenantId.
 *
 * Insertion order (parent → child, Decision 5 of research.md):
 * User → Group → GroupMember → Trail → Module → Lesson →
 * TrailProgress → ModuleProgress → Meeting → MeetingAttendance →
 * MeetingTelemetry → PastoralAction
 *
 * Each upsert targets `where: { id: FIXED_UUID }` so re-running is safe.
 *
 * @param tenantId - UUID of the target tenant (passed explicitly, not via AsyncLocalStorage)
 * @param prismaOverride - optional PrismaClient (used in tests to avoid real DB)
 */
export async function seedDemoData(
  tenantId: string,
  prismaOverride?: PrismaClient,
): Promise<void> {
  const prisma =
    prismaOverride ??
    (() => {
      const connectionString =
        process.env.DATABASE_APP_URL ??
        process.env.DATABASE_URL ??
        'postgresql://metanoia:metanoia_dev_pass@localhost:5432/metanoia_dev';
      const adapter = new PrismaPg({ connectionString });
      return new PrismaClient({ adapter });
    })();

  // Past meeting date (7 days ago)
  const meetingDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const meetingEnd = new Date(meetingDate.getTime() + 90 * 60 * 1000); // +90 min

  // --- 1. Users (4: leader + 3 participants) --------------------------------
  await prisma.user.upsert({
    where: { id: DEMO_LEADER_ID },
    create: {
      id: DEMO_LEADER_ID,
      email: `marcos.silva.demo.${tenantId}@demo.metanoia.internal`,
      name: 'Marcos Silva',
      status: 'active',
      tenantId,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.user.upsert({
    where: { id: DEMO_USER_ANA_ID },
    create: {
      id: DEMO_USER_ANA_ID,
      email: `ana.costa.demo.${tenantId}@demo.metanoia.internal`,
      name: 'Ana Costa',
      status: 'active',
      tenantId,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.user.upsert({
    where: { id: DEMO_USER_PEDRO_ID },
    create: {
      id: DEMO_USER_PEDRO_ID,
      email: `pedro.santos.demo.${tenantId}@demo.metanoia.internal`,
      name: 'Pedro Santos',
      status: 'active',
      tenantId,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.user.upsert({
    where: { id: DEMO_USER_MARIA_ID },
    create: {
      id: DEMO_USER_MARIA_ID,
      email: `maria.oliveira.demo.${tenantId}@demo.metanoia.internal`,
      name: 'Maria Oliveira',
      status: 'active',
      tenantId,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 2. Group -------------------------------------------------------------
  await prisma.group.upsert({
    where: { id: DEMO_GROUP_ID },
    create: {
      id: DEMO_GROUP_ID,
      tenantId,
      name: 'Grupo Alpha',
      dayOfWeek: 'quarta',
      time: '19:30',
      recurrence: 'weekly',
      notes: 'Grupo de demonstração — dados fictícios para explorar o sistema.',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 3. GroupMembers ------------------------------------------------------
  await prisma.groupMember.upsert({
    where: { id: DEMO_MEMBER_LEADER_ID },
    create: {
      id: DEMO_MEMBER_LEADER_ID,
      tenantId,
      groupId: DEMO_GROUP_ID,
      userId: DEMO_LEADER_ID,
      role: 'lider',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.groupMember.upsert({
    where: { id: DEMO_MEMBER_ANA_ID },
    create: {
      id: DEMO_MEMBER_ANA_ID,
      tenantId,
      groupId: DEMO_GROUP_ID,
      userId: DEMO_USER_ANA_ID,
      role: 'membro',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.groupMember.upsert({
    where: { id: DEMO_MEMBER_PEDRO_ID },
    create: {
      id: DEMO_MEMBER_PEDRO_ID,
      tenantId,
      groupId: DEMO_GROUP_ID,
      userId: DEMO_USER_PEDRO_ID,
      role: 'membro',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.groupMember.upsert({
    where: { id: DEMO_MEMBER_MARIA_ID },
    create: {
      id: DEMO_MEMBER_MARIA_ID,
      tenantId,
      groupId: DEMO_GROUP_ID,
      userId: DEMO_USER_MARIA_ID,
      role: 'membro',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 4. Trail "Fundamentos da Fé" ----------------------------------------
  await prisma.trail.upsert({
    where: { id: DEMO_TRAIL_ID },
    create: {
      id: DEMO_TRAIL_ID,
      tenantId,
      name: 'Fundamentos da Fé',
      description:
        'Uma trilha introdutória cobrindo os fundamentos essenciais da caminhada cristã.',
      status: 'published',
      accessMode: 'free',
      version: 1,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedBy: DEMO_LEADER_ID,
      catalogVisible: true,
      createdBy: DEMO_LEADER_ID,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 5. Modules (2) -------------------------------------------------------
  await prisma.module.upsert({
    where: { id: DEMO_MODULE_1_ID },
    create: {
      id: DEMO_MODULE_1_ID,
      tenantId,
      trailId: DEMO_TRAIL_ID,
      name: 'Módulo 1 — Identidade em Cristo',
      order: 1,
      lessonAccessMode: 'free',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.module.upsert({
    where: { id: DEMO_MODULE_2_ID },
    create: {
      id: DEMO_MODULE_2_ID,
      tenantId,
      trailId: DEMO_TRAIL_ID,
      name: 'Módulo 2 — Vida de Oração',
      order: 2,
      lessonAccessMode: 'free',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 6. Lessons (4: 2 per module — video stub + rich_text mix) -----------
  await prisma.lesson.upsert({
    where: { id: DEMO_LESSON_1_ID },
    create: {
      id: DEMO_LESSON_1_ID,
      tenantId,
      moduleId: DEMO_MODULE_1_ID,
      name: 'Quem sou eu em Cristo?',
      contentType: 'video',
      contentUrl: 'https://example.com/demo/video-1-stub',
      order: 1,
      estimatedDurationMinutes: 12,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.lesson.upsert({
    where: { id: DEMO_LESSON_2_ID },
    create: {
      id: DEMO_LESSON_2_ID,
      tenantId,
      moduleId: DEMO_MODULE_1_ID,
      name: 'Leitura: Promessas de Identidade',
      contentType: 'rich_text',
      contentBody:
        '<p>Você é filho(a) de Deus. Esta lição apresenta versículos e reflexões sobre identidade bíblica.</p>',
      order: 2,
      estimatedDurationMinutes: 8,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.lesson.upsert({
    where: { id: DEMO_LESSON_3_ID },
    create: {
      id: DEMO_LESSON_3_ID,
      tenantId,
      moduleId: DEMO_MODULE_2_ID,
      name: 'Introdução à Oração',
      contentType: 'video',
      contentUrl: 'https://example.com/demo/video-2-stub',
      order: 1,
      estimatedDurationMinutes: 15,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  await prisma.lesson.upsert({
    where: { id: DEMO_LESSON_4_ID },
    create: {
      id: DEMO_LESSON_4_ID,
      tenantId,
      moduleId: DEMO_MODULE_2_ID,
      name: 'Leitura: Tipos de Oração',
      contentType: 'rich_text',
      contentBody:
        '<p>Esta lição explora diferentes formas de oração: intercessão, adoração, gratidão e petição.</p>',
      order: 2,
      estimatedDurationMinutes: 6,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 7. TrailProgress (per participant) -----------------------------------
  // Ana: verde — 80% trail (module 1 completo=100%, module 2=60%)
  await prisma.trailProgress.upsert({
    where: { id: DEMO_TRAIL_PROGRESS_ANA_ID },
    create: {
      id: DEMO_TRAIL_PROGRESS_ANA_ID,
      tenantId,
      userId: DEMO_USER_ANA_ID,
      trailId: DEMO_TRAIL_ID,
      progressPercent: 80,
      completedModules: 1,
      totalModules: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 80, completedModules: 1 },
  });

  // Pedro: amarelo — 40% trail (module 1=40%, module 2=0%)
  await prisma.trailProgress.upsert({
    where: { id: DEMO_TRAIL_PROGRESS_PEDRO_ID },
    create: {
      id: DEMO_TRAIL_PROGRESS_PEDRO_ID,
      tenantId,
      userId: DEMO_USER_PEDRO_ID,
      trailId: DEMO_TRAIL_ID,
      progressPercent: 40,
      completedModules: 0,
      totalModules: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 40, completedModules: 0 },
  });

  // Maria: vermelho — 10% trail (module 1=10%, module 2=0%)
  await prisma.trailProgress.upsert({
    where: { id: DEMO_TRAIL_PROGRESS_MARIA_ID },
    create: {
      id: DEMO_TRAIL_PROGRESS_MARIA_ID,
      tenantId,
      userId: DEMO_USER_MARIA_ID,
      trailId: DEMO_TRAIL_ID,
      progressPercent: 10,
      completedModules: 0,
      totalModules: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 10, completedModules: 0 },
  });

  // --- 8. ModuleProgress (2 modules × 3 participants) ----------------------
  // Ana — module 1: 100% (completed), module 2: 60%
  await prisma.moduleProgress.upsert({
    where: { id: DEMO_MOD1_PROGRESS_ANA_ID },
    create: {
      id: DEMO_MOD1_PROGRESS_ANA_ID,
      tenantId,
      userId: DEMO_USER_ANA_ID,
      moduleId: DEMO_MODULE_1_ID,
      progressPercent: 100,
      completedLessons: 2,
      totalLessons: 2,
      completedAt: new Date('2026-05-15T10:00:00.000Z'),
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 100 },
  });

  await prisma.moduleProgress.upsert({
    where: { id: DEMO_MOD2_PROGRESS_ANA_ID },
    create: {
      id: DEMO_MOD2_PROGRESS_ANA_ID,
      tenantId,
      userId: DEMO_USER_ANA_ID,
      moduleId: DEMO_MODULE_2_ID,
      progressPercent: 60,
      completedLessons: 1,
      totalLessons: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 60 },
  });

  // Pedro — module 1: 40%, module 2: 0%
  await prisma.moduleProgress.upsert({
    where: { id: DEMO_MOD1_PROGRESS_PEDRO_ID },
    create: {
      id: DEMO_MOD1_PROGRESS_PEDRO_ID,
      tenantId,
      userId: DEMO_USER_PEDRO_ID,
      moduleId: DEMO_MODULE_1_ID,
      progressPercent: 40,
      completedLessons: 0,
      totalLessons: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 40 },
  });

  await prisma.moduleProgress.upsert({
    where: { id: DEMO_MOD2_PROGRESS_PEDRO_ID },
    create: {
      id: DEMO_MOD2_PROGRESS_PEDRO_ID,
      tenantId,
      userId: DEMO_USER_PEDRO_ID,
      moduleId: DEMO_MODULE_2_ID,
      progressPercent: 0,
      completedLessons: 0,
      totalLessons: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 0 },
  });

  // Maria — module 1: 10%, module 2: 0%
  await prisma.moduleProgress.upsert({
    where: { id: DEMO_MOD1_PROGRESS_MARIA_ID },
    create: {
      id: DEMO_MOD1_PROGRESS_MARIA_ID,
      tenantId,
      userId: DEMO_USER_MARIA_ID,
      moduleId: DEMO_MODULE_1_ID,
      progressPercent: 10,
      completedLessons: 0,
      totalLessons: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 10 },
  });

  await prisma.moduleProgress.upsert({
    where: { id: DEMO_MOD2_PROGRESS_MARIA_ID },
    create: {
      id: DEMO_MOD2_PROGRESS_MARIA_ID,
      tenantId,
      userId: DEMO_USER_MARIA_ID,
      moduleId: DEMO_MODULE_2_ID,
      progressPercent: 0,
      completedLessons: 0,
      totalLessons: 2,
      isDemoData: true,
    },
    update: { isDemoData: true, progressPercent: 0 },
  });

  // --- 9. Meeting (1 past meeting, 7 days ago) ------------------------------
  await prisma.meeting.upsert({
    where: { id: DEMO_MEETING_ID },
    create: {
      id: DEMO_MEETING_ID,
      tenantId,
      groupId: DEMO_GROUP_ID,
      title: 'Encontro Semanal — Grupo Alpha',
      scheduledFor: meetingDate,
      durationMinutes: 90,
      status: 'ended',
      topic: 'Identidade em Cristo — continuação do Módulo 1',
      startedAt: meetingDate,
      endedAt: meetingEnd,
      createdBy: DEMO_LEADER_ID,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 10. MeetingAttendance (3 of 4: leader=integral, Ana=integral, Pedro=parcial, Maria=ausente) ---
  // Leader attended
  await prisma.meetingAttendance.upsert({
    where: { id: DEMO_ATTENDANCE_LEADER_ID },
    create: {
      id: DEMO_ATTENDANCE_LEADER_ID,
      tenantId,
      meetingId: DEMO_MEETING_ID,
      userId: DEMO_LEADER_ID,
      joinTime: meetingDate,
      leaveTime: meetingEnd,
      totalDurationSeconds: 90 * 60,
      presenceType: 'integral',
      reconnections: 0,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // Ana — integral presence
  await prisma.meetingAttendance.upsert({
    where: { id: DEMO_ATTENDANCE_ANA_ID },
    create: {
      id: DEMO_ATTENDANCE_ANA_ID,
      tenantId,
      meetingId: DEMO_MEETING_ID,
      userId: DEMO_USER_ANA_ID,
      joinTime: meetingDate,
      leaveTime: meetingEnd,
      totalDurationSeconds: 90 * 60,
      presenceType: 'integral',
      reconnections: 0,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // Pedro — parcial presence (joined late, left early)
  const pedroJoin = new Date(meetingDate.getTime() + 35 * 60 * 1000);
  const pedroLeave = new Date(meetingEnd.getTime() - 15 * 60 * 1000);
  await prisma.meetingAttendance.upsert({
    where: { id: DEMO_ATTENDANCE_PEDRO_ID },
    create: {
      id: DEMO_ATTENDANCE_PEDRO_ID,
      tenantId,
      meetingId: DEMO_MEETING_ID,
      userId: DEMO_USER_PEDRO_ID,
      joinTime: pedroJoin,
      leaveTime: pedroLeave,
      totalDurationSeconds: Math.round(
        (pedroLeave.getTime() - pedroJoin.getTime()) / 1000,
      ),
      presenceType: 'parcial',
      reconnections: 1,
      isDemoData: true,
    },
    update: { isDemoData: true },
  });
  // Maria — ausente: no attendance record (absence is the absence of a record)

  // --- 11. MeetingTelemetry (PostgreSQL — NOT Redis) ------------------------
  // Leader telemetry
  await prisma.meetingTelemetry.upsert({
    where: { id: DEMO_TELEMETRY_LEADER_ID },
    create: {
      id: DEMO_TELEMETRY_LEADER_ID,
      tenantId,
      meetingId: DEMO_MEETING_ID,
      userId: DEMO_LEADER_ID,
      cameraOnSeconds: 80 * 60,
      roomDurationSeconds: 90 * 60,
      focusScore: '0.95',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // Ana telemetry — engaged (verde)
  await prisma.meetingTelemetry.upsert({
    where: { id: DEMO_TELEMETRY_ANA_ID },
    create: {
      id: DEMO_TELEMETRY_ANA_ID,
      tenantId,
      meetingId: DEMO_MEETING_ID,
      userId: DEMO_USER_ANA_ID,
      cameraOnSeconds: 85 * 60,
      roomDurationSeconds: 90 * 60,
      focusScore: '0.88',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // Pedro telemetry — partial engagement (amarelo)
  await prisma.meetingTelemetry.upsert({
    where: { id: DEMO_TELEMETRY_PEDRO_ID },
    create: {
      id: DEMO_TELEMETRY_PEDRO_ID,
      tenantId,
      meetingId: DEMO_MEETING_ID,
      userId: DEMO_USER_PEDRO_ID,
      cameraOnSeconds: 20 * 60,
      roomDurationSeconds: 40 * 60,
      focusScore: '0.52',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // --- 12. PastoralActions (3 — one per participant) -----------------------
  // Ana — concluída (positive reinforcement)
  await prisma.pastoralAction.upsert({
    where: { id: DEMO_ACTION_ANA_ID },
    create: {
      id: DEMO_ACTION_ANA_ID,
      tenantId,
      participantId: DEMO_USER_ANA_ID,
      groupId: DEMO_GROUP_ID,
      performedBy: DEMO_LEADER_ID,
      actionType: 'mensagem',
      signalType: 'care-ok',
      note: 'Ana está progredindo muito bem. Enviamos uma mensagem de encorajamento.',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // Pedro — pendente (attention needed)
  await prisma.pastoralAction.upsert({
    where: { id: DEMO_ACTION_PEDRO_ID },
    create: {
      id: DEMO_ACTION_PEDRO_ID,
      tenantId,
      participantId: DEMO_USER_PEDRO_ID,
      groupId: DEMO_GROUP_ID,
      performedBy: DEMO_LEADER_ID,
      actionType: 'ligacao',
      signalType: 'care-attention',
      note: 'Pedro chegou tarde no último encontro. Agendar conversa pastoral.',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });

  // Maria — urgente (needs immediate care)
  await prisma.pastoralAction.upsert({
    where: { id: DEMO_ACTION_MARIA_ID },
    create: {
      id: DEMO_ACTION_MARIA_ID,
      tenantId,
      participantId: DEMO_USER_MARIA_ID,
      groupId: DEMO_GROUP_ID,
      performedBy: DEMO_LEADER_ID,
      actionType: 'visita',
      signalType: 'care-urgent',
      note: 'Maria está ausente há 2 encontros e com progresso muito baixo na trilha. Visita pastoral urgente.',
      isDemoData: true,
    },
    update: { isDemoData: true },
  });
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tenantIdArg = process.argv
    .slice(2)
    .find((a) => a.startsWith('--tenant-id='))
    ?.split('=')[1];

  const positional = process.argv.find(
    (a, i) => i > 1 && !a.startsWith('--') && !a.startsWith('-'),
  );

  const tenantId = tenantIdArg ?? positional;

  if (!tenantId) {
    console.error(
      'Usage: pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id=<UUID>',
    );
    process.exit(1);
  }

  console.log(`Seeding demo data for tenant ${tenantId}…`);
  await seedDemoData(tenantId);
  console.log('Done.');
}

// Only run the CLI entrypoint when this file is invoked directly
// (e.g. `tsx src/onboarding/seed/demo-data.seed.ts --tenant-id=<UUID>`).
// It MUST NOT run when imported by DemoDataService at app boot — otherwise
// `node dist/main.js` would hit the no-arg branch, print usage and exit(1),
// crashing the API (caught only in E2E, where the full app boots).
if (process.argv[1]?.includes('demo-data.seed')) {
  void main();
}
