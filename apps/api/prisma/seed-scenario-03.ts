import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Seed script for Cenário 03 ("Pastor abre vista agregada") demo data.
 *
 * Creates a fresh tenant (Igreja Caminho Novo) with 4 groups covering the
 * 4 pastoral statuses (healthy, attention, call, no-signal), one pastor
 * (admin_tenant) and 4 leaders. All IDs are fixed UUID v7 values so the
 * script is idempotent and the UI can be validated deterministically.
 *
 * Status derivation (see AdminPastoralService.deriveStatus):
 *   - no-signal: no meeting OR last meeting > 14 days ago
 *   - call:      alerts.urgent > 0 OR attendance < 50%
 *   - attention: alerts.attention > 0 OR attendance < 75%
 *   - healthy:   otherwise
 *
 * Usage: pnpm --filter @metanoia/api db:seed:scenario-03
 */

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://metanoia:metanoia_dev_pass@localhost:5432/metanoia_dev';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- IDs (UUID v7 with scenario-03 prefix 019801a0-...) ----------------------

const TENANT_ID = '019801a0-0001-7000-8000-000000000001';

const PASTOR_ID = '019801a0-0002-7000-8000-000000000001';

const LEADERS = {
  marcos: '019801a0-2001-7000-8000-000000000001',
  ana: '019801a0-2002-7000-8000-000000000002',
  carlos: '019801a0-2003-7000-8000-000000000003',
  juliana: '019801a0-2004-7000-8000-000000000004',
};

const PARTICIPANTS = {
  // Grupo Quarta 19h (healthy)
  bruno: '019801a0-3001-7000-8000-000000000001',
  carla: '019801a0-3001-7000-8000-000000000002',
  diana: '019801a0-3001-7000-8000-000000000003',
  // Jovens Quinta (attention)
  pedro: '019801a0-3002-7000-8000-000000000001',
  sofia: '019801a0-3002-7000-8000-000000000002',
  tiago: '019801a0-3002-7000-8000-000000000003',
  // Casais Sexta (call)
  elena: '019801a0-3003-7000-8000-000000000001',
  fabio: '019801a0-3003-7000-8000-000000000002',
  // Intercessão Sábado (no-signal)
  henrique: '019801a0-3004-7000-8000-000000000001',
  isabela: '019801a0-3004-7000-8000-000000000002',
  joao: '019801a0-3004-7000-8000-000000000003',
};

const GROUPS = {
  quarta: '019801a0-1000-7000-8000-000000000001',
  jovens: '019801a0-1000-7000-8000-000000000002',
  casais: '019801a0-1000-7000-8000-000000000003',
  intercessao: '019801a0-1000-7000-8000-000000000004',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * MS_PER_DAY);

async function main() {
  console.log('Seeding Cenário 03 demo data...');

  // 1. Tenant
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      tenantId: TENANT_ID,
      name: 'Igreja Caminho Novo',
    },
  });

  // 2. Users (pastor + 4 leaders + 11 participants)
  const users: { id: string; name: string; email: string }[] = [
    { id: PASTOR_ID, name: 'Pastor Daniel Costa', email: 'pastor@caminhonovo.org' },
    { id: LEADERS.marcos, name: 'Marcos Silva', email: 'marcos.lider@caminhonovo.org' },
    { id: LEADERS.ana, name: 'Ana Costa', email: 'ana.lider@caminhonovo.org' },
    { id: LEADERS.carlos, name: 'Carlos Ferreira', email: 'carlos.lider@caminhonovo.org' },
    { id: LEADERS.juliana, name: 'Juliana Lima', email: 'juliana.lider@caminhonovo.org' },
    { id: PARTICIPANTS.bruno, name: 'Bruno Almeida', email: 'bruno@caminhonovo.org' },
    { id: PARTICIPANTS.carla, name: 'Carla Mendes', email: 'carla@caminhonovo.org' },
    { id: PARTICIPANTS.diana, name: 'Diana Rocha', email: 'diana@caminhonovo.org' },
    { id: PARTICIPANTS.pedro, name: 'Pedro Souza', email: 'pedro@caminhonovo.org' },
    { id: PARTICIPANTS.sofia, name: 'Sofia Pereira', email: 'sofia@caminhonovo.org' },
    { id: PARTICIPANTS.tiago, name: 'Tiago Nunes', email: 'tiago@caminhonovo.org' },
    { id: PARTICIPANTS.elena, name: 'Elena Ribeiro', email: 'elena@caminhonovo.org' },
    { id: PARTICIPANTS.fabio, name: 'Fábio Gomes', email: 'fabio@caminhonovo.org' },
    { id: PARTICIPANTS.henrique, name: 'Henrique Dias', email: 'henrique@caminhonovo.org' },
    { id: PARTICIPANTS.isabela, name: 'Isabela Martins', email: 'isabela@caminhonovo.org' },
    { id: PARTICIPANTS.joao, name: 'João Barros', email: 'joao@caminhonovo.org' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        status: 'active',
        tenantId: TENANT_ID,
      },
    });
  }

  // 3. UserTenant (pastor + leaders have roles)
  const userTenants = [
    { id: '019801a0-8000-7000-8000-000000000001', userId: PASTOR_ID, role: 'admin_tenant' },
    { id: '019801a0-8000-7000-8000-000000000002', userId: LEADERS.marcos, role: 'lider' },
    { id: '019801a0-8000-7000-8000-000000000003', userId: LEADERS.ana, role: 'lider' },
    { id: '019801a0-8000-7000-8000-000000000004', userId: LEADERS.carlos, role: 'lider' },
    { id: '019801a0-8000-7000-8000-000000000005', userId: LEADERS.juliana, role: 'lider' },
  ];

  for (const ut of userTenants) {
    await prisma.userTenant.upsert({
      where: { userId_tenantId: { userId: ut.userId, tenantId: TENANT_ID } },
      update: {},
      create: {
        id: ut.id,
        userId: ut.userId,
        tenantId: TENANT_ID,
        role: ut.role,
      },
    });
  }

  // 4. Groups
  const leaderTenureDays = 365; // used for leader GroupMember.createdAt
  const groups = [
    {
      id: GROUPS.quarta,
      name: 'Grupo Quarta 19h',
      dayOfWeek: 'wed',
      time: '19:30',
      notes: 'Sala Principal',
    },
    {
      id: GROUPS.jovens,
      name: 'Jovens Quinta',
      dayOfWeek: 'thu',
      time: '20:00',
      notes: 'Sala Juventude',
    },
    {
      id: GROUPS.casais,
      name: 'Casais Sexta',
      dayOfWeek: 'fri',
      time: '20:30',
      notes: 'Sala Anexa',
    },
    {
      id: GROUPS.intercessao,
      name: 'Intercessão Sábado',
      dayOfWeek: 'sat',
      time: '07:00',
      notes: 'Templo Principal',
    },
  ];

  for (const g of groups) {
    await prisma.group.upsert({
      where: { id: g.id },
      update: {},
      create: {
        id: g.id,
        tenantId: TENANT_ID,
        name: g.name,
        dayOfWeek: g.dayOfWeek,
        time: g.time,
        notes: g.notes,
      },
    });
  }

  // 5. Group memberships (4 leaders + 11 participants)
  const memberships: {
    id: string;
    groupId: string;
    userId: string;
    role: string;
    createdAt?: Date;
  }[] = [
    // Grupo Quarta 19h (healthy)
    {
      id: '019801a0-4001-7000-8000-000000000001',
      groupId: GROUPS.quarta,
      userId: LEADERS.marcos,
      role: 'lider',
      createdAt: daysAgo(leaderTenureDays),
    },
    {
      id: '019801a0-4001-7000-8000-000000000002',
      groupId: GROUPS.quarta,
      userId: PARTICIPANTS.bruno,
      role: 'membro',
    },
    {
      id: '019801a0-4001-7000-8000-000000000003',
      groupId: GROUPS.quarta,
      userId: PARTICIPANTS.carla,
      role: 'membro',
    },
    {
      id: '019801a0-4001-7000-8000-000000000004',
      groupId: GROUPS.quarta,
      userId: PARTICIPANTS.diana,
      role: 'membro',
    },
    // Jovens Quinta (attention)
    {
      id: '019801a0-4002-7000-8000-000000000001',
      groupId: GROUPS.jovens,
      userId: LEADERS.ana,
      role: 'lider',
      createdAt: daysAgo(180),
    },
    {
      id: '019801a0-4002-7000-8000-000000000002',
      groupId: GROUPS.jovens,
      userId: PARTICIPANTS.pedro,
      role: 'membro',
    },
    {
      id: '019801a0-4002-7000-8000-000000000003',
      groupId: GROUPS.jovens,
      userId: PARTICIPANTS.sofia,
      role: 'membro',
    },
    {
      id: '019801a0-4002-7000-8000-000000000004',
      groupId: GROUPS.jovens,
      userId: PARTICIPANTS.tiago,
      role: 'membro',
    },
    // Casais Sexta (call)
    {
      id: '019801a0-4003-7000-8000-000000000001',
      groupId: GROUPS.casais,
      userId: LEADERS.carlos,
      role: 'lider',
      createdAt: daysAgo(500),
    },
    {
      id: '019801a0-4003-7000-8000-000000000002',
      groupId: GROUPS.casais,
      userId: PARTICIPANTS.elena,
      role: 'membro',
    },
    {
      id: '019801a0-4003-7000-8000-000000000003',
      groupId: GROUPS.casais,
      userId: PARTICIPANTS.fabio,
      role: 'membro',
    },
    // Intercessão Sábado (no-signal)
    {
      id: '019801a0-4004-7000-8000-000000000001',
      groupId: GROUPS.intercessao,
      userId: LEADERS.juliana,
      role: 'lider',
      createdAt: daysAgo(730),
    },
    {
      id: '019801a0-4004-7000-8000-000000000002',
      groupId: GROUPS.intercessao,
      userId: PARTICIPANTS.henrique,
      role: 'membro',
    },
    {
      id: '019801a0-4004-7000-8000-000000000003',
      groupId: GROUPS.intercessao,
      userId: PARTICIPANTS.isabela,
      role: 'membro',
    },
    {
      id: '019801a0-4004-7000-8000-000000000004',
      groupId: GROUPS.intercessao,
      userId: PARTICIPANTS.joao,
      role: 'membro',
    },
  ];

  for (const m of memberships) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: m.groupId, userId: m.userId } },
      update: {},
      create: {
        id: m.id,
        tenantId: TENANT_ID,
        groupId: m.groupId,
        userId: m.userId,
        role: m.role,
        ...(m.createdAt ? { createdAt: m.createdAt } : {}),
      },
    });
  }

  // 6. Meetings (ended status) + participant records
  // Helper to create a meeting with 4 participant records (leader + 3 members)
  type MeetingSpec = {
    id: string;
    groupId: string;
    scheduledFor: Date;
    participants: {
      id: string;
      userId: string;
      participantId: string;
      name: string;
      response: string;
      joinedAt: Date | null;
    }[];
  };

  const meetings: MeetingSpec[] = [
    // Grupo Quarta 19h — 3 days ago, 4/4 attendance → healthy
    {
      id: '019801a0-5001-7000-8000-000000000001',
      groupId: GROUPS.quarta,
      scheduledFor: daysAgo(3),
      participants: [
        {
          id: '019801a0-5501-7000-8000-000000000001',
          userId: LEADERS.marcos,
          participantId: LEADERS.marcos,
          name: 'Marcos Silva',
          response: 'yes',
          joinedAt: daysAgo(3),
        },
        {
          id: '019801a0-5501-7000-8000-000000000002',
          userId: PARTICIPANTS.bruno,
          participantId: PARTICIPANTS.bruno,
          name: 'Bruno Almeida',
          response: 'yes',
          joinedAt: daysAgo(3),
        },
        {
          id: '019801a0-5501-7000-8000-000000000003',
          userId: PARTICIPANTS.carla,
          participantId: PARTICIPANTS.carla,
          name: 'Carla Mendes',
          response: 'yes',
          joinedAt: daysAgo(3),
        },
        {
          id: '019801a0-5501-7000-8000-000000000004',
          userId: PARTICIPANTS.diana,
          participantId: PARTICIPANTS.diana,
          name: 'Diana Rocha',
          response: 'yes',
          joinedAt: daysAgo(3),
        },
      ],
    },
    // Jovens Quinta — 4 days ago, 2/4 attendance (50%) → attention
    {
      id: '019801a0-5002-7000-8000-000000000001',
      groupId: GROUPS.jovens,
      scheduledFor: daysAgo(4),
      participants: [
        {
          id: '019801a0-5502-7000-8000-000000000001',
          userId: LEADERS.ana,
          participantId: LEADERS.ana,
          name: 'Ana Costa',
          response: 'yes',
          joinedAt: daysAgo(4),
        },
        {
          id: '019801a0-5502-7000-8000-000000000002',
          userId: PARTICIPANTS.pedro,
          participantId: PARTICIPANTS.pedro,
          name: 'Pedro Souza',
          response: 'yes',
          joinedAt: daysAgo(4),
        },
        {
          id: '019801a0-5502-7000-8000-000000000003',
          userId: PARTICIPANTS.sofia,
          participantId: PARTICIPANTS.sofia,
          name: 'Sofia Pereira',
          response: 'no',
          joinedAt: null,
        },
        {
          id: '019801a0-5502-7000-8000-000000000004',
          userId: PARTICIPANTS.tiago,
          participantId: PARTICIPANTS.tiago,
          name: 'Tiago Nunes',
          response: 'no',
          joinedAt: null,
        },
      ],
    },
    // Casais Sexta — 5 days ago, 2/3 attendance (67%), BUT 2 care-urgent alerts → call
    {
      id: '019801a0-5003-7000-8000-000000000001',
      groupId: GROUPS.casais,
      scheduledFor: daysAgo(5),
      participants: [
        {
          id: '019801a0-5503-7000-8000-000000000001',
          userId: LEADERS.carlos,
          participantId: LEADERS.carlos,
          name: 'Carlos Ferreira',
          response: 'yes',
          joinedAt: daysAgo(5),
        },
        {
          id: '019801a0-5503-7000-8000-000000000002',
          userId: PARTICIPANTS.elena,
          participantId: PARTICIPANTS.elena,
          name: 'Elena Ribeiro',
          response: 'yes',
          joinedAt: daysAgo(5),
        },
        {
          id: '019801a0-5503-7000-8000-000000000003',
          userId: PARTICIPANTS.fabio,
          participantId: PARTICIPANTS.fabio,
          name: 'Fábio Gomes',
          response: 'no',
          joinedAt: null,
        },
      ],
    },
    // Intercessão Sábado — 30 days ago (> 14 threshold) → no-signal
    {
      id: '019801a0-5004-7000-8000-000000000001',
      groupId: GROUPS.intercessao,
      scheduledFor: daysAgo(30),
      participants: [
        {
          id: '019801a0-5504-7000-8000-000000000001',
          userId: LEADERS.juliana,
          participantId: LEADERS.juliana,
          name: 'Juliana Lima',
          response: 'yes',
          joinedAt: daysAgo(30),
        },
        {
          id: '019801a0-5504-7000-8000-000000000002',
          userId: PARTICIPANTS.henrique,
          participantId: PARTICIPANTS.henrique,
          name: 'Henrique Dias',
          response: 'yes',
          joinedAt: daysAgo(30),
        },
      ],
    },
  ];

  for (const m of meetings) {
    await prisma.meeting.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        tenantId: TENANT_ID,
        groupId: m.groupId,
        scheduledFor: m.scheduledFor,
        status: 'ended',
        topic: 'Encontro semanal',
        startedAt: m.scheduledFor,
        endedAt: new Date(m.scheduledFor.getTime() + 90 * 60 * 1000),
      },
    });

    for (const p of m.participants) {
      await prisma.meetingParticipantRecord.upsert({
        where: {
          meetingId_participantId: {
            meetingId: m.id,
            participantId: p.participantId,
          },
        },
        update: {},
        create: {
          id: p.id,
          tenantId: TENANT_ID,
          meetingId: m.id,
          userId: p.userId,
          participantId: p.participantId,
          name: p.name,
          response: p.response,
          joinedAt: p.joinedAt,
        },
      });
    }
  }

  // 7. Reflections (on the healthy meeting — gives the timeline a reflectionText)
  await prisma.reflection.upsert({
    where: { id: '019801a0-6001-7000-8000-000000000001' },
    update: {},
    create: {
      id: '019801a0-6001-7000-8000-000000000001',
      tenantId: TENANT_ID,
      meetingId: '019801a0-5001-7000-8000-000000000001',
      leaderId: LEADERS.marcos,
      text: 'Tempo doce de oração. Deus falou sobre perseverança.',
      recordedAt: daysAgo(3),
    },
  });

  // 8. PastoralAlerts — 2 care-urgent on Casais Sexta → pushes status to "call"
  const alerts = [
    {
      id: '019801a0-7003-7000-8000-000000000001',
      participantId: PARTICIPANTS.elena,
      groupId: GROUPS.casais,
      signalType: 'care-urgent',
      signalVariant: 'absence',
      contextPhrase: 'Saiu mais cedo nas últimas 2 reuniões',
    },
    {
      id: '019801a0-7003-7000-8000-000000000002',
      participantId: PARTICIPANTS.fabio,
      groupId: GROUPS.casais,
      signalType: 'care-urgent',
      signalVariant: 'decline',
      contextPhrase: 'Participação em queda',
    },
  ];

  for (const a of alerts) {
    await prisma.pastoralAlert.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        tenantId: TENANT_ID,
        participantId: a.participantId,
        groupId: a.groupId,
        signalType: a.signalType,
        signalVariant: a.signalVariant,
        contextPhrase: a.contextPhrase,
        presenceDots: ['present', 'absent', 'absent', 'present', 'absent'],
        active: true,
      },
    });
  }

  // 9. PastoralActions — activity feed for leaders (recentActivity in leader view)
  const actions = [
    {
      id: '019801a0-7100-7000-8000-000000000001',
      participantId: PARTICIPANTS.bruno,
      groupId: GROUPS.quarta,
      performedBy: LEADERS.marcos,
      actionType: 'message',
      signalType: 'care-ok',
      note: 'Agradeci o testemunho do Bruno.',
      recordedAt: daysAgo(2),
    },
    {
      id: '019801a0-7100-7000-8000-000000000002',
      participantId: PARTICIPANTS.elena,
      groupId: GROUPS.casais,
      performedBy: LEADERS.carlos,
      actionType: 'call',
      signalType: 'care-urgent',
      note: 'Liguei à Elena, marcámos café.',
      recordedAt: daysAgo(1),
    },
    {
      id: '019801a0-7100-7000-8000-000000000003',
      participantId: PARTICIPANTS.pedro,
      groupId: GROUPS.jovens,
      performedBy: LEADERS.ana,
      actionType: 'visit',
      signalType: 'care-attention',
      note: 'Visitei o Pedro em casa.',
      recordedAt: daysAgo(6),
    },
  ];

  for (const a of actions) {
    await prisma.pastoralAction.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        tenantId: TENANT_ID,
        participantId: a.participantId,
        groupId: a.groupId,
        performedBy: a.performedBy,
        actionType: a.actionType,
        signalType: a.signalType,
        note: a.note,
        recordedAt: a.recordedAt,
      },
    });
  }

  // 10. PastoralNotes — one "conversation" per leader gives them a lastConversation
  const notes = [
    {
      id: '019801a0-7200-7000-8000-000000000001',
      participantId: LEADERS.marcos,
      content: 'Conversa com o Marcos sobre o discipulado do Bruno.',
      occurredAt: daysAgo(10),
    },
    {
      id: '019801a0-7200-7000-8000-000000000002',
      participantId: LEADERS.ana,
      content: 'Ana relatou dificuldade na frequência do grupo.',
      occurredAt: daysAgo(14),
    },
    {
      id: '019801a0-7200-7000-8000-000000000003',
      participantId: LEADERS.carlos,
      content: 'Carlos precisa de apoio pastoral com o casal Elena/Fábio.',
      occurredAt: daysAgo(7),
    },
    {
      id: '019801a0-7200-7000-8000-000000000004',
      participantId: LEADERS.juliana,
      content: 'Juliana avaliou pausar o grupo de intercessão.',
      occurredAt: daysAgo(21),
    },
  ];

  for (const n of notes) {
    await prisma.pastoralNote.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        tenantId: TENANT_ID,
        participantId: n.participantId,
        authorId: PASTOR_ID,
        noteType: 'conversation',
        content: n.content,
        occurredAt: n.occurredAt,
      },
    });
  }

  console.log(
    `Seed completed for tenant ${TENANT_ID}: 1 tenant, 16 users, 4 groups, ` +
      `15 memberships, 4 meetings, 1 reflection, 2 alerts, 3 actions, 4 notes.`,
  );
  console.log('Expected statuses:');
  console.log('  Grupo Quarta 19h     → healthy');
  console.log('  Jovens Quinta        → attention');
  console.log('  Casais Sexta         → call');
  console.log('  Intercessão Sábado   → no-signal');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Seed failed:', e);
    prisma.$disconnect();
    process.exit(1);
  });
