/* eslint-disable @metanoia/no-surveillance-terms */
/**
 * Testes da regra ESLint no-surveillance-terms
 *
 * Usa RuleTester do ESLint v9 para verificar:
 *  - Termos proibidos em strings literais → erro
 *  - Classes Tailwind tracking-tight/wide → permitido (sem falso-positivo)
 *  - Imports técnicos → permitido
 *  - Termos pastorais de vocabulary.ts → permitido
 *
 * Nota: RuleTester.run() registra seus próprios describe/it internamente.
 * Por isso é chamado no top-level (fora de describe/it do vitest).
 */
import { RuleTester } from 'eslint';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rule = require('../../../config/eslint/no-surveillance-terms.js') as {
  create: (context: unknown) => unknown;
  meta: unknown;
};

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// RuleTester.run() integra com o test runner via globals describe/it.
// Em vitest com globals: true, isso funciona no top-level.
tester.run('no-surveillance-terms', rule, {
  valid: [
    // Termos pastorais permitidos
    { code: `const label = "cuidado";` },
    { code: `const label = "acompanhamento";` },
    { code: `const label = "presença";` },
    { code: `const label = "atenção pastoral";` },
    { code: `const label = "visibilidade pastoral";` },
    { code: `const label = "jornada";` },
    { code: `const label = "sinal de cuidado";` },
    // Classes Tailwind — não são linguagem user-facing
    { code: `const cls = "font-semibold tracking-tight text-sm";` },
    { code: `const cls = "uppercase tracking-wide text-muted";` },
    // Import técnico — infraestrutura (importDeclaration ignorada)
    { code: `import something from "prom-client-monitoring";` },
    // Variável com nome técnico (identifier, não string)
    { code: `const monitoringService = {};` },
    // String sem termos proibidos
    { code: `const msg = "Bem-vindo ao grupo";` },
    { code: `const msg = "Sua jornada começa aqui";` },
  ],

  invalid: [
    // Termos PT proibidos
    {
      code: `const msg = "vigilância pastoral";`,
      errors: [{ messageId: 'forbidden' }],
    },
    {
      code: `const msg = "vigilancia pastoral";`,
      errors: [{ messageId: 'forbidden' }],
    },
    {
      code: `const msg = "monitoramento de membros";`,
      errors: [{ messageId: 'forbidden' }],
    },
    {
      code: `const msg = "rastreamento de presença";`,
      errors: [{ messageId: 'forbidden' }],
    },
    // Termos EN proibidos
    {
      code: `const msg = "surveillance dashboard";`,
      errors: [{ messageId: 'forbidden' }],
    },
    {
      code: `const msg = "monitoring panel";`,
      errors: [{ messageId: 'forbidden' }],
    },
    {
      code: `const msg = "user tracking system";`,
      errors: [{ messageId: 'forbidden' }],
    },
    // Template literal
    {
      code: 'const msg = `Dashboard de monitoramento`;',
      errors: [{ messageId: 'forbidden' }],
    },
    // Case insensitive
    {
      code: `const msg = "SURVEILLANCE";`,
      errors: [{ messageId: 'forbidden' }],
    },
  ],
});
