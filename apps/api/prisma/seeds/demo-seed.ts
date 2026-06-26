import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Story 7-2 — Unified demo seed.
 *
 * Creates a single self-contained demo tenant flagged with `is_demo=true` so
 * a líder dropping into the platform sees the Pastoral Radar populated with
 * realistic distribution: 4 verde, 3 amarelo, 2 vermelho, 1 sem sinal.
 *
 * Idempotent: re-running upserts the same fixed UUID v7 IDs without
 * duplicating rows. Cleanup = `DELETE FROM tenants WHERE is_demo = true`
 * (cascades through all tenant-scoped rows).
 *
 * Usage: pnpm --filter @metanoia/api db:seed:demo
 */

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://metanoia:metanoia_dev_pass@localhost:5432/metanoia_dev';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- Fixed UUID v7 IDs (prefix 019899a0-7002 = Story 7-2) --------------------

export const DEMO_TENANT_ID = '019899a0-7002-7000-8000-000000000001';

const ADMIN_ID = '019899a0-7002-7000-8000-000000000002';
const LEADER_ID = '019899a0-7002-7000-8000-000000000003';

// --- Public exports for downstream provisioning (Story 7-4 Keycloak seed) ----

export type DemoRole = 'admin_tenant' | 'lider' | 'participante';

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: DemoRole;
}

const GROUP_ID = '019899a0-7002-1000-8000-000000000001';

type Status = 'verde' | 'amarelo' | 'vermelho' | 'novo';
type Trend = 'melhorando' | 'estavel' | 'declinio';

type ParticipantKey =
  | 'maria'
  | 'joao'
  | 'ana'
  | 'pedro'
  | 'beatriz'
  | 'lucas'
  | 'camila'
  | 'rafael'
  | 'juliana'
  | 'tiago';

interface Participant {
  key: ParticipantKey;
  id: string;
  name: string;
  email: string;
  status: Status;
  trend: Trend;
  // 6-week presence history, oldest first ('y' present, 'n' absent, 'p' partial)
  presence: Array<'y' | 'n' | 'p'>;
}

const PARTICIPANTS: Participant[] = [
  // 4 verde
  {
    key: 'maria',
    id: '019899a0-7002-3001-8000-000000000001',
    name: 'Maria Santos',
    email: 'maria.santos@demo.metanoia.app',
    status: 'verde',
    trend: 'estavel',
    presence: ['y', 'y', 'y', 'y', 'y', 'y'],
  },
  {
    key: 'joao',
    id: '019899a0-7002-3001-8000-000000000002',
    name: 'João Oliveira',
    email: 'joao.oliveira@demo.metanoia.app',
    status: 'verde',
    trend: 'melhorando',
    presence: ['n', 'p', 'y', 'y', 'y', 'y'],
  },
  {
    key: 'ana',
    id: '019899a0-7002-3001-8000-000000000003',
    name: 'Ana Costa',
    email: 'ana.costa@demo.metanoia.app',
    status: 'verde',
    trend: 'estavel',
    presence: ['y', 'y', 'p', 'y', 'y', 'y'],
  },
  {
    key: 'pedro',
    id: '019899a0-7002-3001-8000-000000000004',
    name: 'Pedro Lima',
    email: 'pedro.lima@demo.metanoia.app',
    status: 'verde',
    trend: 'estavel',
    presence: ['y', 'p', 'y', 'y', 'y', 'y'],
  },
  // 3 amarelo
  {
    key: 'beatriz',
    id: '019899a0-7002-3002-8000-000000000001',
    name: 'Beatriz Rocha',
    email: 'beatriz.rocha@demo.metanoia.app',
    status: 'amarelo',
    trend: 'declinio',
    presence: ['y', 'y', 'y', 'p', 'n', 'p'],
  },
  {
    key: 'lucas',
    id: '019899a0-7002-3002-8000-000000000002',
    name: 'Lucas Almeida',
    email: 'lucas.almeida@demo.metanoia.app',
    status: 'amarelo',
    trend: 'estavel',
    presence: ['p', 'y', 'p', 'p', 'y', 'p'],
  },
  {
    key: 'camila',
    id: '019899a0-7002-3002-8000-000000000003',
    name: 'Camila Ferreira',
    email: 'camila.ferreira@demo.metanoia.app',
    status: 'amarelo',
    trend: 'melhorando',
    presence: ['n', 'n', 'p', 'p', 'y', 'p'],
  },
  // 2 vermelho
  {
    key: 'rafael',
    id: '019899a0-7002-3003-8000-000000000001',
    name: 'Rafael Souza',
    email: 'rafael.souza@demo.metanoia.app',
    status: 'vermelho',
    trend: 'declinio',
    presence: ['y', 'p', 'n', 'n', 'n', 'n'],
  },
  {
    key: 'juliana',
    id: '019899a0-7002-3003-8000-000000000002',
    name: 'Juliana Martins',
    email: 'juliana.martins@demo.metanoia.app',
    status: 'vermelho',
    trend: 'declinio',
    presence: ['p', 'n', 'n', 'p', 'n', 'n'],
  },
  // 1 novo (no alert row, no presence history yet)
  {
    key: 'tiago',
    id: '019899a0-7002-3004-8000-000000000001',
    name: 'Tiago Carvalho',
    email: 'tiago.carvalho@demo.metanoia.app',
    status: 'novo',
    trend: 'estavel',
    presence: [],
  },
];

export const DEMO_USERS: DemoUser[] = [
  { id: ADMIN_ID, email: 'admin@demo.metanoia.app', name: 'Pastora Sofia Mendes', role: 'admin_tenant' },
  { id: LEADER_ID, email: 'lider@demo.metanoia.app', name: 'Líder Mateus Ribeiro', role: 'lider' },
  ...PARTICIPANTS.map<DemoUser>((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    role: 'participante',
  })),
];

const STATUS_TO_SIGNAL: Record<Exclude<Status, 'novo'>, string> = {
  verde: 'care-ok',
  amarelo: 'care-attention',
  vermelho: 'care-urgent',
};

const STATUS_TO_VARIANT: Record<Exclude<Status, 'novo'>, string> = {
  verde: 'consistent-presence',
  amarelo: 'partial-presence',
  vermelho: 'sustained-absence',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * MS_PER_DAY);

async function main() {
  console.log('Seeding unified demo data (Story 7-2)...');

  // 1. Tenant flagged is_demo=true
  await prisma.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    update: { isDemo: true, name: 'Igreja Demonstração', plan: 'free' },
    create: {
      id: DEMO_TENANT_ID,
      tenantId: DEMO_TENANT_ID,
      name: 'Igreja Demonstração',
      slug: 'igreja-demonstracao',
      plan: 'free',
      status: 'active',
      adminEmail: 'admin@demo.metanoia.app',
      isDemo: true,
    },
  });

  // 2. Users — admin_tenant + lider + 10 participants
  const users = [
    { id: ADMIN_ID, name: 'Pastora Sofia Mendes', email: 'admin@demo.metanoia.app' },
    { id: LEADER_ID, name: 'Líder Mateus Ribeiro', email: 'lider@demo.metanoia.app' },
    ...PARTICIPANTS.map((p) => ({ id: p.id, name: p.name, email: p.email })),
  ];

  // Keyed by `id` (not `email`) so a re-run never reassigns a pre-existing
  // user from another tenant onto DEMO_TENANT_ID via email collision.
  // Users.tenantId stays null (matches the registered-user pattern). Tenant
  // membership lives in `user_tenants`. Setting tenantId here would hide the
  // user from the unauthenticated login lookup (RLS on `users` requires
  // tenant_id = current_setting OR IS NULL).
  // Demo users skip the first-access onboarding screen — they are pre-seeded
  // with onboarding_completed_at set so the redirect guard doesn't intercept
  // them. This also protects the E2E happy-path (Story 7-4) which logs in as
  // the demo admin and expects to land directly on an /app/ route.
  const DEMO_ONBOARDING_AT = new Date('2026-01-01T00:00:00.000Z');

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, status: 'active', tenantId: null, onboardingCompletedAt: DEMO_ONBOARDING_AT },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        status: 'active',
        tenantId: null,
        onboardingCompletedAt: DEMO_ONBOARDING_AT,
      },
    });
  }

  // 3. UserTenant — admin + leader bind their roles to the demo tenant
  const userTenants = [
    {
      id: '019899a0-7002-8000-8000-000000000001',
      userId: ADMIN_ID,
      role: 'admin_tenant',
    },
    {
      id: '019899a0-7002-8000-8000-000000000002',
      userId: LEADER_ID,
      role: 'lider',
    },
  ];

  for (const ut of userTenants) {
    await prisma.userTenant.upsert({
      where: { userId_tenantId: { userId: ut.userId, tenantId: DEMO_TENANT_ID } },
      update: { role: ut.role },
      create: {
        id: ut.id,
        userId: ut.userId,
        tenantId: DEMO_TENANT_ID,
        role: ut.role,
      },
    });
  }

  // 3b. Consents — pre-accept LGPD/ToS for every demo user so login flow
  // skips the /consent gate (matches the "this account has been around"
  // expectation of demo data; otherwise login redirects to a consent page
  // that does not yet exist).
  for (const u of users) {
    await prisma.consent.upsert({
      where: { id: `019899a0-7002-9000-8000-${u.id.slice(-12)}` },
      update: {},
      create: {
        id: `019899a0-7002-9000-8000-${u.id.slice(-12)}`,
        userId: u.id,
        tenantId: null,
        documentType: 'terms_of_service',
        version: '1.0.0',
        ipAddress: '127.0.0.1',
        userAgent: 'demo-seed',
      },
    });
  }

  // 4. Group "Grupo Esperança" — quintas 19h30
  await prisma.group.upsert({
    where: { id: GROUP_ID },
    update: {},
    create: {
      id: GROUP_ID,
      tenantId: DEMO_TENANT_ID,
      name: 'Grupo Esperança',
      dayOfWeek: 'thu',
      time: '19:30',
      notes: 'Sala de Convivência',
    },
  });

  // 5. Group memberships — leader + all 10 participants
  const memberships = [
    { id: '019899a0-7002-4000-8000-000000000001', userId: LEADER_ID, role: 'lider', tenureDays: 365 },
    ...PARTICIPANTS.map((p, idx) => ({
      id: `019899a0-7002-4000-8000-${String(idx + 2).padStart(12, '0')}`,
      userId: p.id,
      role: 'membro',
      tenureDays: undefined as number | undefined,
    })),
  ];

  for (const m of memberships) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: GROUP_ID, userId: m.userId } },
      update: { role: m.role },
      create: {
        id: m.id,
        tenantId: DEMO_TENANT_ID,
        groupId: GROUP_ID,
        userId: m.userId,
        role: m.role,
        ...(m.tenureDays ? { createdAt: daysAgo(m.tenureDays) } : {}),
      },
    });
  }

  // 6. Three historical meetings (last 3 thursdays — 21d, 14d, 7d ago)
  // attendance trends downward to give the radar realistic signals.
  const meetings = [
    { id: '019899a0-7002-5000-8000-000000000001', recordPrefix: '019899a0-7002-5100-8000-', daysBack: 21, attendanceCount: 9 },
    { id: '019899a0-7002-5000-8000-000000000002', recordPrefix: '019899a0-7002-5200-8000-', daysBack: 14, attendanceCount: 7 },
    { id: '019899a0-7002-5000-8000-000000000003', recordPrefix: '019899a0-7002-5300-8000-', daysBack: 7, attendanceCount: 5 },
  ];

  for (const m of meetings) {
    const scheduled = daysAgo(m.daysBack);
    const startedAt = new Date(scheduled.getTime() + 5 * 60 * 1000);
    const endedAt = new Date(scheduled.getTime() + 90 * 60 * 1000);
    // Refresh timestamps on every run so the demo always shows
    // "last 3 weeks" relative to current date, never frozen on first seed.
    await prisma.meeting.upsert({
      where: { id: m.id },
      update: { scheduledFor: scheduled, startedAt, endedAt },
      create: {
        id: m.id,
        tenantId: DEMO_TENANT_ID,
        groupId: GROUP_ID,
        scheduledFor: scheduled,
        status: 'ended',
        topic: 'Estudo bíblico semanal',
        startedAt,
        endedAt,
      },
    });

    const recordId = (slot: number) =>
      `${m.recordPrefix}${String(slot).padStart(12, '0')}`;

    const records: Array<{
      id: string;
      participantId: string;
      userId: string;
      name: string;
      response: 'yes' | 'no';
      joined: boolean;
    }> = [
      {
        id: recordId(0),
        participantId: LEADER_ID,
        userId: LEADER_ID,
        name: 'Líder Mateus Ribeiro',
        response: 'yes',
        joined: true,
      },
    ];

    // Sort by status (verde → amarelo → vermelho) so attendanceCount maps
    // verdes first (always present) and vermelhos drop off — gives a coherent
    // "presença caindo" curve across the 3 meetings.
    const ordered = [...PARTICIPANTS]
      .filter((p) => p.status !== 'novo')
      .sort((a, b) => orderStatus(a.status) - orderStatus(b.status));

    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      const willAttend = i < m.attendanceCount;
      records.push({
        id: recordId(i + 1),
        participantId: p.id,
        userId: p.id,
        name: p.name,
        response: willAttend ? 'yes' : 'no',
        joined: willAttend,
      });
    }

    for (const r of records) {
      const joinedAt = r.joined ? new Date(scheduled.getTime() + 6 * 60 * 1000) : null;
      const leftAt = r.joined ? new Date(scheduled.getTime() + 88 * 60 * 1000) : null;
      await prisma.meetingParticipantRecord.upsert({
        where: {
          meetingId_participantId: { meetingId: m.id, participantId: r.participantId },
        },
        update: { joinedAt, leftAt, response: r.response },
        create: {
          id: r.id,
          tenantId: DEMO_TENANT_ID,
          meetingId: m.id,
          userId: r.userId,
          participantId: r.participantId,
          name: r.name,
          response: r.response,
          joinedAt,
          leftAt,
        },
      });
    }
  }

  // 7. PastoralAlerts — one row per non-novo participant
  for (let i = 0; i < PARTICIPANTS.length; i++) {
    const p = PARTICIPANTS[i];
    if (p.status === 'novo') continue;

    const signalType = STATUS_TO_SIGNAL[p.status];
    const signalVariant = STATUS_TO_VARIANT[p.status];
    const id = `019899a0-7002-6000-8000-${String(i + 1).padStart(12, '0')}`;

    await prisma.pastoralAlert.upsert({
      where: { id },
      update: { active: true, presenceDots: p.presence },
      create: {
        id,
        tenantId: DEMO_TENANT_ID,
        participantId: p.id,
        groupId: GROUP_ID,
        signalType,
        signalVariant,
        contextPhrase: contextPhraseFor(p),
        observedFact: observedFactFor(p),
        systemLimitation: 'Sinal baseado apenas em presença em reunião.',
        presenceDots: p.presence,
        active: true,
      },
    });
  }

  // 8. Two pastoral actions (one for each vermelho — leader já agiu)
  const rafael = participantByKey('rafael');
  const beatriz = participantByKey('beatriz');
  const actions = [
    {
      id: '019899a0-7002-6500-8000-000000000001',
      participantId: rafael.id,
      actionType: 'message',
      signalType: 'care-urgent',
      note: 'Mandei mensagem perguntando como ele está. Sem resposta ainda.',
      daysBack: 3,
    },
    {
      id: '019899a0-7002-6500-8000-000000000002',
      participantId: beatriz.id,
      actionType: 'prayer',
      signalType: 'care-attention',
      note: 'Orei pela Beatriz no grupo de quinta.',
      daysBack: 5,
    },
  ];

  for (const a of actions) {
    const recordedAt = daysAgo(a.daysBack);
    // Refresh recordedAt on re-run to keep the action timestamp coherent
    // with the (also-refreshed) meeting window.
    await prisma.pastoralAction.upsert({
      where: { id: a.id },
      update: { recordedAt },
      create: {
        id: a.id,
        tenantId: DEMO_TENANT_ID,
        participantId: a.participantId,
        groupId: GROUP_ID,
        performedBy: LEADER_ID,
        actionType: a.actionType,
        signalType: a.signalType,
        note: a.note,
        recordedAt,
      },
    });
  }

  // 9. Sample pastoral note (relational memory)
  const juliana = participantByKey('juliana');
  const noteOccurredAt = daysAgo(10);
  await prisma.pastoralNote.upsert({
    where: { id: '019899a0-7002-6600-8000-000000000001' },
    update: { occurredAt: noteOccurredAt },
    create: {
      id: '019899a0-7002-6600-8000-000000000001',
      tenantId: DEMO_TENANT_ID,
      participantId: juliana.id,
      authorId: LEADER_ID,
      noteType: 'conversation',
      content: 'Conversamos sobre o momento difícil no trabalho. Pediu oração.',
      occurredAt: noteOccurredAt,
      metadata: { surfacedBy: 'demo-seed' },
    },
  });

  // -----------------------------------------------------------------------
  // Story 15.5 — Demo lessons with missing alt-text for accessibility audit
  // Fixed UUIDs (v7 format): idempotent via upsert by id
  // -----------------------------------------------------------------------
  const DEMO_TRAIL_ID = '019899a0-7002-7155-8000-000000000001';
  const DEMO_MODULE_ID = '019899a0-7002-7155-8000-000000000002';
  const DEMO_LESSON_ALT1_ID = '019899a0-7002-7155-8000-000000000003';
  const DEMO_LESSON_ALT2_ID = '019899a0-7002-7155-8000-000000000004';

  await prisma.trail.upsert({
    where: { id: DEMO_TRAIL_ID },
    update: {},
    create: {
      id: DEMO_TRAIL_ID,
      tenantId: DEMO_TENANT_ID,
      name: 'Trilha Demo — Acessibilidade',
      description: 'Trilha criada pelo seed para demonstrar a auditoria de alt-text.',
      status: 'published',
      accessMode: 'free',
      createdBy: ADMIN_ID,
      isDemoData: true,
    },
  });

  await prisma.module.upsert({
    where: { id: DEMO_MODULE_ID },
    update: {},
    create: {
      id: DEMO_MODULE_ID,
      tenantId: DEMO_TENANT_ID,
      trailId: DEMO_TRAIL_ID,
      name: 'Módulo Demo',
      order: 1,
      lessonAccessMode: 'free',
      isDemoData: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: DEMO_LESSON_ALT1_ID },
    update: { hasMissingAltText: true },
    create: {
      id: DEMO_LESSON_ALT1_ID,
      tenantId: DEMO_TENANT_ID,
      moduleId: DEMO_MODULE_ID,
      name: 'Aula com imagem sem alt-text (1)',
      contentType: 'rich_text',
      contentBody: '<p>Texto da aula.</p><img src="https://cdn.example.com/foto-equipe.jpg" width="800"><p>Fim.</p>',
      hasMissingAltText: true,
      order: 1,
      isDemoData: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: DEMO_LESSON_ALT2_ID },
    update: { hasMissingAltText: true },
    create: {
      id: DEMO_LESSON_ALT2_ID,
      tenantId: DEMO_TENANT_ID,
      moduleId: DEMO_MODULE_ID,
      name: 'Aula com imagem sem alt-text (2)',
      contentType: 'rich_text',
      contentBody: '<p>Outro conteúdo.</p><img src="https://cdn.example.com/grafico.png" alt=""><p>Consulte o gráfico.</p>',
      hasMissingAltText: true,
      order: 2,
      isDemoData: true,
    },
  });

  console.log('Demo seed concluído:');
  console.log(`  - tenant ${DEMO_TENANT_ID} (is_demo=true)`);
  console.log(`  - usuários: 1 admin + 1 líder + ${PARTICIPANTS.length} participantes`);
  console.log(`  - grupo: 1 ("Grupo Esperança")`);
  console.log(`  - reuniões: ${meetings.length} (${meetings.map((m) => `${m.daysBack}d`).join(', ')})`);
  console.log(`  - alertas: ${PARTICIPANTS.filter((p) => p.status !== 'novo').length}`);
  console.log(`  - ações pastorais: ${actions.length}`);
  console.log(`  - aulas demo alt-text: 2 (hasMissingAltText=true)`);
}

function participantByKey(key: ParticipantKey): Participant {
  const found = PARTICIPANTS.find((p) => p.key === key);
  if (!found) {
    throw new Error(`Participant not found in demo seed roster: ${key}`);
  }
  return found;
}

function orderStatus(s: Status): number {
  if (s === 'verde') return 0;
  if (s === 'amarelo') return 1;
  if (s === 'vermelho') return 2;
  return 3;
}

function contextPhraseFor(p: Participant): string {
  if (p.status === 'verde' && p.trend === 'melhorando') return 'Voltou a participar com regularidade.';
  if (p.status === 'verde') return 'Presença consistente nas últimas semanas.';
  if (p.status === 'amarelo' && p.trend === 'declinio') return 'Frequência caindo gradualmente.';
  if (p.status === 'amarelo' && p.trend === 'melhorando') return 'Voltando a aparecer após período distante.';
  if (p.status === 'amarelo') return 'Presença oscilando.';
  if (p.status === 'vermelho') return 'Sem presença há mais de uma semana.';
  return '';
}

function observedFactFor(p: Participant): string {
  const total = p.presence.length;
  if (total === 0) return 'Sem histórico de reuniões ainda.';
  const presentCount = p.presence.filter((d) => d === 'y').length;
  const partialCount = p.presence.filter((d) => d === 'p').length;
  return `${presentCount} presenças integrais, ${partialCount} parciais nas últimas ${total} reuniões.`;
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Demo seed failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
