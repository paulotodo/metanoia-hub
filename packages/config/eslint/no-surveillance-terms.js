/**
 * ESLint Custom Rule: no-surveillance-terms
 *
 * Bloqueia o uso de termos de vigilância corporativa em strings literais
 * do código-fonte. Toda linguagem user-facing DEVE usar os termos pastorais
 * definidos em packages/types/src/vocabulary/vocabulary.ts.
 *
 * Decisão arquitetural (Story 6-1):
 *   A regra captura string literals que contêm os termos proibidos, excluindo:
 *
 *   1. Atributos `className` / `class` JSX — classes Tailwind como
 *      "tracking-tight" e "tracking-wide" são CSS, não linguagem user-facing.
 *      Excluir evita falso-positivo massivo em toda a codebase de UI.
 *
 *   2. Import/require declarations — nomes de pacotes técnicos (ex: datadog,
 *      opentelemetry, prom-client) são infraestrutura, não linguagem pastoral.
 *
 *   3. Strings com "tracking-" seguido de palavra Tailwind (tight/wide/normal
 *      etc.) — salvaguarda adicional para usos em variáveis de CSS string.
 *
 *   Para outros arquivos de observabilidade técnica, configure `ignores` no
 *   eslint.config do app correspondente (use globs sem barra-asterisco dupla
 *   aqui para não fechar o bloco JSDoc):
 *     ignores: ['src/observability/', 'src/telemetry/']
 *
 * Termos bloqueados (variantes PT + EN):
 *   vigilância, vigilancia, tracking*, monitoramento, surveillance,
 *   monitoring, rastreamento
 *   (* "tracking" sozinho ou em contexto user-facing — não classes CSS)
 *
 * @see packages/types/src/vocabulary/vocabulary.ts — fonte canônica dos termos
 */

'use strict';

/** Sufixos Tailwind válidos para "tracking-" (não são termos de vigilância) */
const TAILWIND_TRACKING_SUFFIXES = [
  'tight',
  'wide',
  'normal',
  'tighter',
  'wider',
  'widest',
  'loosest',
  'loose',
];

/** @type {import('eslint').Rule.RuleModule} */
const noSurveillanceTerms = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Bloqueia termos de vigilância em strings literais user-facing. Use os termos pastorais de packages/types/src/vocabulary/vocabulary.ts.',
      recommended: false,
    },
    messages: {
      forbidden:
        'Termo de vigilância proibido: "{{term}}". Use os termos pastorais definidos em packages/types/src/vocabulary/vocabulary.ts. ' +
        'Ex: "cuidado", "acompanhamento", "presença", "atenção pastoral", "visibilidade pastoral".',
    },
    schema: [],
  },

  create(context) {
    /**
     * Verifica se o nó está dentro de um atributo JSX className/class.
     * Ex: <div className="tracking-tight"> — deve ser ignorado.
     */
    function isInClassNameAttribute(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === 'JSXAttribute' &&
          current.name &&
          (current.name.name === 'className' || current.name.name === 'class')
        ) {
          return true;
        }
        // Sai do JSX para não subir além do componente
        if (current.type === 'JSXElement' || current.type === 'JSXOpeningElement') {
          break;
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Verifica se o nó está em import/require (infraestrutura técnica).
     */
    function isInImportOrRequire(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === 'ImportDeclaration' ||
          current.type === 'ExportNamedDeclaration' ||
          current.type === 'ExportAllDeclaration'
        ) {
          return true;
        }
        if (
          current.type === 'CallExpression' &&
          current.callee &&
          current.callee.name === 'require'
        ) {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Verifica se "tracking" aparece como classe CSS Tailwind válida.
     * Ex: "tracking-tight", "tracking-wide", "font-semibold tracking-tight text-sm"
     */
    function isOnlyTailwindTracking(value) {
      if (typeof value !== 'string') return false;
      const lower = value.toLowerCase();
      // Verifica se "tracking" no valor está sempre seguido de sufixo CSS válido
      const trackingMatches = lower.match(/tracking(?:-(\w+))?/g);
      if (!trackingMatches) return false;
      const allAreCss = trackingMatches.every((match) => {
        const suffix = match.replace('tracking-', '');
        return TAILWIND_TRACKING_SUFFIXES.includes(suffix);
      });
      return allAreCss;
    }

    /**
     * Termos proibidos e suas variantes (case-insensitive).
     * "tracking" é tratado separadamente por conflito com Tailwind.
     */
    const STRICTLY_FORBIDDEN = [
      'vigilância',
      'vigilancia',
      'monitoramento',
      'surveillance',
      'monitoring',
      'rastreamento',
    ];

    function findForbiddenTerm(value) {
      if (typeof value !== 'string') return null;
      const lower = value.toLowerCase();

      // Verificar termos estritamente proibidos
      const strict = STRICTLY_FORBIDDEN.find((term) =>
        lower.includes(term.toLowerCase()),
      );
      if (strict) return strict;

      // "tracking" só é proibido se NÃO for exclusivamente classe Tailwind
      if (lower.includes('tracking')) {
        if (!isOnlyTailwindTracking(value)) {
          return 'tracking';
        }
      }

      return null;
    }

    return {
      Literal(node) {
        if (isInImportOrRequire(node)) return;
        if (isInClassNameAttribute(node)) return;

        const term = findForbiddenTerm(node.value);
        if (term) {
          context.report({
            node,
            messageId: 'forbidden',
            data: { term },
          });
        }
      },

      // Captura template literals (ex: `Monitoramento de presença`)
      TemplateLiteral(node) {
        if (isInImportOrRequire(node)) return;
        if (isInClassNameAttribute(node)) return;

        for (const quasi of node.quasis) {
          const term = findForbiddenTerm(quasi.value.raw);
          if (term) {
            context.report({
              node: quasi,
              messageId: 'forbidden',
              data: { term },
            });
          }
        }
      },
    };
  },
};

module.exports = noSurveillanceTerms;
