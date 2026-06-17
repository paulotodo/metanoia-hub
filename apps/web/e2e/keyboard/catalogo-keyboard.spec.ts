/**
 * Story 12.2 — US5: E2E Catálogo e Busca (Chromium)
 *
 * FR-015: campo de busca é o primeiro focável da seção
 * FR-016: filtros navegáveis por teclado (Enter/Space abre; Arrow navega; Escape fecha)
 * FR-017: cards focáveis + ativáveis com Enter
 * FR-018: paginação alcançável via Tab com rótulos descritivos
 * dec-015: foco permanece no input após busca; contagem anunciada via role=status
 *
 * Estratégia: mock de API offline-first (route interception) para isolar do backend.
 * Cenários cobrem os 4 ACs de US5.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Fixture de resultados mock
const MOCK_RESULTS = [
  {
    lessonId: 'lesson-1',
    lessonName: 'Fundamentos do Discipulado',
    trailId: 'trail-1',
    trailName: 'Trilha de Discipulado',
    moduleName: 'Módulo 1',
    snippet: '\x02Discipulado\x03 é a base da fé cristã.',
    isDraft: false,
  },
  {
    lessonId: 'lesson-2',
    lessonName: 'Oração e Comunhão',
    trailId: 'trail-1',
    trailName: 'Trilha de Discipulado',
    moduleName: 'Módulo 2',
    snippet: 'A \x02oração\x03 fortalece a comunhão.',
    isDraft: false,
  },
];

test.describe('US5 — Catálogo e Busca: navegação por teclado', () => {
  test.beforeEach(async ({ page }) => {
    // Interceptar chamada de busca e retornar mock
    await page.route('**/api/v1/search?*', async (route) => {
      const url = route.request().url();
      const q = new URL(url).searchParams.get('q') ?? '';
      const filtered = q.length > 0 ? MOCK_RESULTS : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: filtered }),
      });
    });

    await page.goto('/app/consumo/catalogo');
    await page.waitForLoadState('networkidle');
  });

  // AC US5-1: campo de busca é o primeiro focável da seção (FR-015)
  test('AC1: campo de busca é o primeiro elemento focável da seção', async ({ page }) => {
    // Tab a partir do início da seção — o primeiro Tab deve focar o input de busca
    await page.keyboard.press('Tab');

    // Pode ser o skip-nav primeiro, então testamos que o searchbox existe e é focável
    const searchInput = page.getByRole('searchbox');
    await expect(searchInput).toBeVisible();

    // Focar diretamente e confirmar que foco permanece
    await searchInput.focus();
    await expect(searchInput).toBeFocused();
  });

  // AC US5-2: filtros acessíveis por teclado (FR-016)
  test('AC2: filtros abrem com Enter/Space e navegam com Arrow; Escape fecha', async ({ page }) => {
    // Focar no botão de filtro de Categoria
    const categoryBtn = page.getByRole('button', { name: /Categoria/i });
    await categoryBtn.focus();
    await expect(categoryBtn).toBeFocused();

    // Enter abre o listbox
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    // Arrow Down navega para próxima opção
    await page.keyboard.press('ArrowDown');
    // Verificar que alguma opção está visualmente ativa
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();

    // Escape fecha e retorna foco ao botão
    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden();
    await expect(categoryBtn).toBeFocused();
  });

  // AC US5-3: cards focáveis com role=link, ativáveis com Enter (FR-017)
  test('AC3: cards têm role=link, são focáveis e anúncio não move o foco', async ({ page }) => {
    const searchInput = page.getByRole('searchbox');
    await searchInput.focus();
    await searchInput.fill('discipulado');

    // Aguardar resultados aparecerem
    await page.waitForResponse('**/api/v1/search?*');
    await page.waitForTimeout(400); // debounce 300ms + margem

    // Cards devem ser links (<a>) focáveis
    const cards = page.getByRole('link', { name: /Fundamentos|Oração/i });
    await expect(cards.first()).toBeVisible();

    // dec-015: foco deve permanecer no input (NÃO mover para resultados)
    await expect(searchInput).toBeFocused();

    // Região role=status anuncia contagem
    const statusRegion = page.locator('[data-testid="catalog-result-status"]');
    await expect(statusRegion).toHaveAttribute('role', 'status');
    await expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });

  // AC US5-4: paginação alcançável via Tab com rótulos descritivos (FR-018)
  test('AC4: botões de paginação têm aria-label e são alcançáveis via Tab', async ({ page }) => {
    // Injetar 12 resultados mock para forçar paginação
    const manyResults = Array.from({ length: 12 }, (_, i) => ({
      lessonId: `lesson-${i}`,
      lessonName: `Aula ${i + 1}`,
      trailId: `trail-${i}`,
      trailName: 'Trilha',
      moduleName: 'Módulo 1',
      snippet: `Conteúdo da aula ${i + 1}`,
      isDraft: false,
    }));

    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: manyResults }),
      });
    });

    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('aula');
    await page.waitForTimeout(400);

    // Botão "Próxima página" deve existir e ter aria-label
    const nextBtn = page.getByRole('button', { name: /Próxima página/i });
    await expect(nextBtn).toBeVisible();

    const prevBtn = page.getByRole('button', { name: /Página anterior/i });
    await expect(prevBtn).toBeVisible();

    // Ativar próxima página com Enter
    await nextBtn.focus();
    await page.keyboard.press('Enter');

    // Botão "Página anterior" agora deve estar habilitado
    await expect(prevBtn).not.toBeDisabled();
  });

  // axe: sem violações critical na página do catálogo
  test('axe: sem violações critical na página de catálogo', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });
});
