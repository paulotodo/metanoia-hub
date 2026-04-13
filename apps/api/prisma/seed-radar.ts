import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Seed script for Pastoral Radar demo data.
 * Mirrors the mock fixtures from apps/web/__mocks__/radar/ exactly.
 *
 * Usage: npx tsx prisma/seed-radar.ts
 */

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://metanoia:metanoia_dev_pass@localhost:5432/metanoia_dev';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- IDs (UUID v7 format, matching mock data) ---

const TENANT_ID = '019756a0-0001-7000-8000-000000000001';

const GROUP_JOVENS = '019756a1-0001-7000-8000-000000000001';
const GROUP_CASAIS = '019756a1-0002-7000-8000-000000000002';

const LEADER_ID = '019756a0-9000-7000-8000-000000000001';

const PARTICIPANTS = {
  pedro: '019756a1-1001-7000-8000-000000000001',
  ana: '019756a1-1002-7000-8000-000000000002',
  carlos: '019756a1-1003-7000-8000-000000000003',
  mariana: '019756a1-2001-7000-8000-000000000004',
  rafael: '019756a1-2002-7000-8000-000000000005',
  juliana: '019756a1-2003-7000-8000-000000000006',
  lucas: '019756a1-3001-7000-8000-000000000007',
  beatriz: '019756a1-3002-7000-8000-000000000008',
  thiago: '019756a1-3003-7000-8000-000000000009',
  camila: '019756a1-3004-7000-8000-000000000010',
};

async function main() {
  console.log('Seeding pastoral radar demo data...');

  // 1. Tenant
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      tenantId: TENANT_ID,
      name: 'Igreja Vida Nova',
    },
  });

  // 2. Users (leader + 10 participants)
  const users = [
    { id: LEADER_ID, name: 'Marcos Silva', email: 'marcos@vidanova.org' },
    { id: PARTICIPANTS.pedro, name: 'Pedro Almeida', email: 'pedro@vidanova.org' },
    { id: PARTICIPANTS.ana, name: 'Ana Costa', email: 'ana@vidanova.org' },
    { id: PARTICIPANTS.carlos, name: 'Carlos Ferreira', email: 'carlos@vidanova.org' },
    { id: PARTICIPANTS.mariana, name: 'Mariana Santos', email: 'mariana@vidanova.org' },
    { id: PARTICIPANTS.rafael, name: 'Rafael Oliveira', email: 'rafael@vidanova.org' },
    { id: PARTICIPANTS.juliana, name: 'Juliana Lima', email: 'juliana@vidanova.org' },
    { id: PARTICIPANTS.lucas, name: 'Lucas Mendes', email: 'lucas@vidanova.org' },
    { id: PARTICIPANTS.beatriz, name: 'Beatriz Souza', email: 'beatriz@vidanova.org' },
    { id: PARTICIPANTS.thiago, name: 'Thiago Rocha', email: 'thiago@vidanova.org' },
    { id: PARTICIPANTS.camila, name: 'Camila Araújo', email: 'camila@vidanova.org' },
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

  // 3. Groups
  const groups = [
    { id: GROUP_JOVENS, name: 'Jovens Adultos' },
    { id: GROUP_CASAIS, name: 'Casais' },
  ];

  for (const g of groups) {
    await prisma.group.upsert({
      where: { id: g.id },
      update: {},
      create: {
        id: g.id,
        tenantId: TENANT_ID,
        name: g.name,
      },
    });
  }

  // 4. Group Members
  const memberships: { id: string; userId: string; groupId: string; role: string }[] = [
    { id: '019756a1-4001-7000-8000-000000000001', userId: LEADER_ID, groupId: GROUP_JOVENS, role: 'lider' },
    { id: '019756a1-4002-7000-8000-000000000002', userId: PARTICIPANTS.pedro, groupId: GROUP_JOVENS, role: 'membro' },
    { id: '019756a1-4003-7000-8000-000000000003', userId: PARTICIPANTS.ana, groupId: GROUP_JOVENS, role: 'membro' },
    { id: '019756a1-4004-7000-8000-000000000004', userId: PARTICIPANTS.carlos, groupId: GROUP_CASAIS, role: 'membro' },
    { id: '019756a1-4005-7000-8000-000000000005', userId: PARTICIPANTS.mariana, groupId: GROUP_JOVENS, role: 'membro' },
    { id: '019756a1-4006-7000-8000-000000000006', userId: PARTICIPANTS.rafael, groupId: GROUP_CASAIS, role: 'membro' },
    { id: '019756a1-4007-7000-8000-000000000007', userId: PARTICIPANTS.juliana, groupId: GROUP_JOVENS, role: 'membro' },
    { id: '019756a1-4008-7000-8000-000000000008', userId: PARTICIPANTS.lucas, groupId: GROUP_JOVENS, role: 'membro' },
    { id: '019756a1-4009-7000-8000-000000000009', userId: PARTICIPANTS.beatriz, groupId: GROUP_CASAIS, role: 'membro' },
    { id: '019756a1-400a-7000-8000-00000000000a', userId: PARTICIPANTS.thiago, groupId: GROUP_CASAIS, role: 'membro' },
    { id: '019756a1-400b-7000-8000-00000000000b', userId: PARTICIPANTS.camila, groupId: GROUP_JOVENS, role: 'membro' },
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
      },
    });
  }

  // 5. Pastoral Alerts (matching mock signalType, contextPhrase, presenceDots)
  const alerts = [
    // care-urgent (3)
    {
      id: '019756a1-5001-7000-8000-000000000001',
      participantId: PARTICIPANTS.pedro,
      groupId: GROUP_JOVENS,
      signalType: 'care-urgent',
      signalVariant: 'absence',
      contextPhrase: 'Faz 3 semanas que não aparece',
      observedFact: 'Faz 3 semanas que o Pedro não aparece no grupo.',
      systemLimitation: 'O radar vê presença e ausência — não sabe o motivo. Pode ser viagem, doença ou algo que precisa de conversa.',
      presenceDots: ['present', 'present', 'absent', 'absent', 'absent'],
    },
    {
      id: '019756a1-5002-7000-8000-000000000002',
      participantId: PARTICIPANTS.ana,
      groupId: GROUP_JOVENS,
      signalType: 'care-urgent',
      signalVariant: 'early-exit',
      contextPhrase: 'Saiu cedo nas últimas 2 reuniões',
      observedFact: 'A Ana saiu cedo nas últimas 2 reuniões.',
      systemLimitation: 'O radar vê que ela saiu antes do final — não sabe se foi por compromisso, desconforto ou outro motivo.',
      presenceDots: ['present', 'present', 'present', 'present', 'absent'],
    },
    {
      id: '019756a1-5003-7000-8000-000000000003',
      participantId: PARTICIPANTS.carlos,
      groupId: GROUP_CASAIS,
      signalType: 'care-urgent',
      signalVariant: 'decline',
      contextPhrase: 'Participação em queda nas últimas 4 semanas',
      observedFact: 'A participação do Carlos está em queda nas últimas 4 semanas.',
      systemLimitation: 'O radar vê o padrão de queda — não sabe se é temporário ou se precisa de atenção.',
      presenceDots: ['present', 'present', 'absent', 'absent', 'absent'],
    },
    // care-attention (3)
    {
      id: '019756a1-5004-7000-8000-000000000004',
      participantId: PARTICIPANTS.mariana,
      groupId: GROUP_JOVENS,
      signalType: 'care-attention',
      signalVariant: 'absence',
      contextPhrase: 'Faltou na última reunião',
      observedFact: 'A Mariana faltou na última reunião.',
      systemLimitation: 'O radar vê que ela faltou — pode ser algo pontual.',
      presenceDots: ['present', 'present', 'present', 'absent', 'no-meeting'],
    },
    {
      id: '019756a1-5005-7000-8000-000000000005',
      participantId: PARTICIPANTS.rafael,
      groupId: GROUP_CASAIS,
      signalType: 'care-attention',
      signalVariant: 'fallback',
      contextPhrase: 'Não confirmou presença esta semana',
      observedFact: 'O Rafael não confirmou presença esta semana.',
      systemLimitation: 'O radar vê a falta de confirmação — pode ser esquecimento.',
      presenceDots: ['present', 'absent', 'present', 'present', 'present'],
    },
    {
      id: '019756a1-5006-7000-8000-000000000006',
      participantId: PARTICIPANTS.juliana,
      groupId: GROUP_JOVENS,
      signalType: 'care-attention',
      signalVariant: null,
      contextPhrase: null,
      observedFact: null,
      systemLimitation: null,
      presenceDots: ['present', 'present', 'absent', 'present', 'present'],
    },
    // care-ok (4)
    {
      id: '019756a1-5007-7000-8000-000000000007',
      participantId: PARTICIPANTS.lucas,
      groupId: GROUP_JOVENS,
      signalType: 'care-ok',
      signalVariant: null,
      contextPhrase: null,
      observedFact: null,
      systemLimitation: null,
      presenceDots: ['present', 'present', 'present', 'present', 'present'],
    },
    {
      id: '019756a1-5008-7000-8000-000000000008',
      participantId: PARTICIPANTS.beatriz,
      groupId: GROUP_CASAIS,
      signalType: 'care-ok',
      signalVariant: null,
      contextPhrase: null,
      observedFact: null,
      systemLimitation: null,
      presenceDots: ['present', 'present', 'present', 'present', 'absent'],
    },
    {
      id: '019756a1-5009-7000-8000-000000000009',
      participantId: PARTICIPANTS.thiago,
      groupId: GROUP_CASAIS,
      signalType: 'care-ok',
      signalVariant: null,
      contextPhrase: null,
      observedFact: null,
      systemLimitation: null,
      presenceDots: ['present', 'present', 'present', 'present', 'present'],
    },
    {
      id: '019756a1-500a-7000-8000-00000000000a',
      participantId: PARTICIPANTS.camila,
      groupId: GROUP_JOVENS,
      signalType: 'care-ok',
      signalVariant: null,
      contextPhrase: null,
      observedFact: null,
      systemLimitation: null,
      presenceDots: ['present', 'absent', 'present', 'present', 'present'],
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
        observedFact: a.observedFact,
        systemLimitation: a.systemLimitation,
        presenceDots: a.presenceDots,
        active: true,
      },
    });
  }

  // 6. Pastoral Actions (matching mock lastCareRecord)
  const actions = [
    {
      id: '019756a1-6001-7000-8000-000000000001',
      participantId: PARTICIPANTS.pedro,
      groupId: GROUP_JOVENS,
      actionType: 'message',
      signalType: 'care-urgent',
      note: 'Mandei mensagem perguntando se tava tudo bem.',
      recordedAt: new Date('2026-03-20T10:30:00Z'),
    },
    {
      id: '019756a1-6002-7000-8000-000000000002',
      participantId: PARTICIPANTS.carlos,
      groupId: GROUP_CASAIS,
      actionType: 'call',
      signalType: 'care-urgent',
      note: 'Liguei para o Carlos, não atendeu.',
      recordedAt: new Date('2026-03-10T14:00:00Z'),
    },
    {
      id: '019756a1-6003-7000-8000-000000000003',
      participantId: PARTICIPANTS.mariana,
      groupId: GROUP_JOVENS,
      actionType: 'prayer',
      signalType: 'care-attention',
      note: 'Orei pela Mariana no grupo.',
      recordedAt: new Date('2026-04-01T09:00:00Z'),
    },
    {
      id: '019756a1-6004-7000-8000-000000000004',
      participantId: PARTICIPANTS.juliana,
      groupId: GROUP_JOVENS,
      actionType: 'visit',
      signalType: 'care-attention',
      note: 'Visitei a Juliana em casa.',
      recordedAt: new Date('2026-04-05T16:30:00Z'),
    },
    {
      id: '019756a1-6005-7000-8000-000000000005',
      participantId: PARTICIPANTS.camila,
      groupId: GROUP_JOVENS,
      actionType: 'message',
      signalType: 'care-ok',
      note: 'Mandei mensagem de encorajamento.',
      recordedAt: new Date('2026-04-10T11:00:00Z'),
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
        performedBy: LEADER_ID,
        actionType: a.actionType,
        signalType: a.signalType,
        note: a.note,
        recordedAt: a.recordedAt,
      },
    });
  }

  // 7. Pastoral Notes (relational memory for Pedro — matching mockParticipantProfile)
  const notes = [
    {
      id: '019756a1-7001-7000-8000-000000000001',
      participantId: PARTICIPANTS.pedro,
      noteType: 'conversation',
      content: 'Mandei mensagem perguntando se tava tudo bem. Disse que sim mas pareceu evasivo.',
      occurredAt: new Date('2026-03-20T10:30:00Z'),
      metadata: {},
    },
    {
      id: '019756a1-7002-7000-8000-000000000002',
      participantId: PARTICIPANTS.pedro,
      noteType: 'prayer',
      content: 'Orei pelo Pedro no grupo. Ele tava presente nesse dia.',
      occurredAt: new Date('2026-03-13T19:30:00Z'),
      metadata: {},
    },
    {
      id: '019756a1-7003-7000-8000-000000000003',
      participantId: PARTICIPANTS.pedro,
      noteType: 'milestone',
      content: 'Próxima reunião',
      occurredAt: new Date('2026-04-17T19:30:00Z'),
      metadata: { dayOfWeek: 'quinta', eventName: 'Próxima reunião' },
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
        authorId: LEADER_ID,
        noteType: n.noteType,
        content: n.content,
        occurredAt: n.occurredAt,
        metadata: n.metadata,
      },
    });
  }

  console.log('Seed completed: 1 tenant, 11 users, 2 groups, 11 memberships, 10 alerts, 5 actions, 3 notes');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Seed failed:', e);
    prisma.$disconnect();
    process.exit(1);
  });
