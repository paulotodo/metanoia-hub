import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://metanoia:metanoia_dev_pass@localhost:5432/metanoia_dev',
  },
});
