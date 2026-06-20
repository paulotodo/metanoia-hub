/**
 * Seed: 3 platform ContentTemplates (tenant_id NULL, scope=platform).
 * Story 13-5 / FR42 / FR-21.
 *
 * SECURITY: app role (metanoia_app) cannot INSERT tenant_id=NULL (RLS content_templates_insert
 * requires tenant_id = current_tenant). This seed MUST run with DATABASE_URL pointing to a
 * privileged role (owner/superuser) that bypasses RLS, OR use SET LOCAL row_security = off
 * inside a superuser transaction.
 *
 * Strategy: connect via DATABASE_URL (superuser/owner), then within $transaction call
 * SET LOCAL row_security = off to bypass RLS for this session only.
 *
 * Idempotent: upsert by fixed UUID — safe to run 2x without duplicates.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Fixed UUIDs for deterministic idempotency (UUIDv7 format, manually assigned)
const TEMPLATE_DISCIPULADO_ID = '01921100-0001-7000-8000-000000000001';
const TEMPLATE_ESTUDO_ID = '01921100-0001-7000-8000-000000000002';
const TEMPLATE_ACOLHIMENTO_ID = '01921100-0001-7000-8000-000000000003';
const SYSTEM_USER_ID = '00000000-0000-7000-8000-000000000000';

const PLATFORM_TEMPLATES = [
  {
    id: TEMPLATE_DISCIPULADO_ID,
    name: 'Discipulado Básico',
    description: 'Trilha introdutória de discipulado cristão com 4 módulos e 12 lições.',
    structure: {
      modules: [
        {
          name: 'Fundamentos da Fé',
          order: 0,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'O que é ser discípulo?', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 30 },
            { name: 'A Bíblia como guia', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 30 },
            { name: 'Oração e comunhão', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 45 },
          ],
        },
        {
          name: 'Vida em Comunidade',
          order: 1,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'Igreja: família espiritual', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 30 },
            { name: 'Servindo ao próximo', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 30 },
            { name: 'Dons espirituais', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 45 },
          ],
        },
        {
          name: 'Crescimento Espiritual',
          order: 2,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'Estudo sistemático da Bíblia', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 45 },
            { name: 'Jejum e disciplinas espirituais', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 30 },
            { name: 'Testemunho cristão', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 30 },
          ],
        },
        {
          name: 'Missão e Vocação',
          order: 3,
          lessonAccessMode: 'free',
          lessons: [
            { name: 'Chamado ao serviço', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 30 },
            { name: 'Evangelismo prático', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 30 },
            { name: 'Vida de missão cotidiana', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 30 },
          ],
        },
      ],
    },
  },
  {
    id: TEMPLATE_ESTUDO_ID,
    name: 'Estudo Bíblico Temático',
    description: 'Trilha de estudo bíblico por temas com 3 módulos e 9 lições.',
    structure: {
      modules: [
        {
          name: 'Antigo Testamento',
          order: 0,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'Criação e queda', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 45 },
            { name: 'Os patriarcas', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 45 },
            { name: 'Os profetas', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 45 },
          ],
        },
        {
          name: 'Novo Testamento',
          order: 1,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'Os evangelhos sinóticos', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 45 },
            { name: 'O evangelho de João', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 45 },
            { name: 'Cartas paulinas', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 45 },
          ],
        },
        {
          name: 'Temas Teológicos',
          order: 2,
          lessonAccessMode: 'free',
          lessons: [
            { name: 'Graça e salvação', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 45 },
            { name: 'Escatologia básica', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 45 },
            { name: 'Hermenêutica simples', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 45 },
          ],
        },
      ],
    },
  },
  {
    id: TEMPLATE_ACOLHIMENTO_ID,
    name: 'Acolhimento de Novos Membros',
    description: 'Trilha de integração para novos membros com 2 módulos e 6 lições.',
    structure: {
      modules: [
        {
          name: 'Boas-vindas à Igreja',
          order: 0,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'Nossa história e visão', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 20 },
            { name: 'Como nos organizamos', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 20 },
            { name: 'Próximos passos', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 20 },
          ],
        },
        {
          name: 'Integração à Comunidade',
          order: 1,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'Células e grupos pequenos', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 20 },
            { name: 'Ministérios disponíveis', contentType: 'rich_text', order: 1, estimatedDurationMinutes: 20 },
            { name: 'Como contribuir', contentType: 'rich_text', order: 2, estimatedDurationMinutes: 20 },
          ],
        },
      ],
    },
  },
];

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL not set');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      // Bypass RLS: DATABASE_URL must point to superuser/owner role.
      // SET LOCAL row_security = off applies only to this transaction.
      await tx.$executeRawUnsafe('SET LOCAL row_security = off');

      for (const tpl of PLATFORM_TEMPLATES) {
        await tx.$executeRaw`
          INSERT INTO content_templates (
            id, tenant_id, scope, source_trail_id,
            name, description, version, structure,
            created_by, created_at, deleted_at
          ) VALUES (
            ${tpl.id}::uuid,
            NULL,
            'platform'::"TemplateScope",
            NULL,
            ${tpl.name},
            ${tpl.description},
            1,
            ${JSON.stringify(tpl.structure)}::jsonb,
            ${SYSTEM_USER_ID}::uuid,
            now(),
            NULL
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            structure = EXCLUDED.structure
        `;
        console.log(`Upserted platform template: ${tpl.name}`);
      }
    });

    const count = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM content_templates WHERE tenant_id IS NULL
    `;
    console.log(`Platform templates total: ${count[0].count}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('content-templates-seed')) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main as seedContentTemplates };
