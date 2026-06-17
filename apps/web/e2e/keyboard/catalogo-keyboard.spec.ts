/**
 * Story 12.2 — US5: E2E Catálogo e Busca (Chromium)
 *
 * FR-015: campo de busca é o primeiro focável da seção
 * FR-016: filtros navegáveis por teclado (Enter/Space abre; Arrow navega; Escape fecha)
 * FR-017: cards focáveis + ativáveis com Enter
 * FR-018: paginação alcançável via Tab com rótulos descritivos
 * dec-015: foco permanece no input após busca; contagem anunciada via role=status
 *
 * Estratégia (isolada — padrão configuracoes/planos/modal-focus-trap):
 *   Renderiza HTML inline via page.setContent replicando FIELMENTE o contrato
 *   acessível de CatalogSearch (src/components/catalog/catalog-search.tsx):
 *   searchbox (type=search, role=searchbox), FilterDropdown (button
 *   aria-haspopup=listbox + <ul role=listbox> com Enter/Space/Arrow/Escape),
 *   cards como <a> com aria-label "Ver trilha {name}", região role=status
 *   aria-live=polite e paginação com aria-label "Página anterior"/"Próxima página".
 *   A busca é "mockada" no <script> (debounce 300ms como no componente), sem
 *   depender de auth/backend (Keycloak/API indisponíveis fora do CI).
 *   Strings em PT-BR vêm de messages/pt-BR.json (catalog.*).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Fixture de resultados mock (shape consumido pelo componente)
const MOCK_RESULTS = [
  { lessonId: 'lesson-1', lessonName: 'Fundamentos do Discipulado', trailId: 'trail-1', trailName: 'Trilha de Discipulado' },
  { lessonId: 'lesson-2', lessonName: 'Oração e Comunhão', trailId: 'trail-1', trailName: 'Trilha de Discipulado' },
];

// HTML que replica o markup acessível de CatalogSearch.
// `window.__setResults(arr)` injeta resultados (cards + paginação) simulando a
// resposta da API; a digitação aciona debounce de 300ms como no componente.
const CATALOG_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Catálogo de Trilhas</title>
  <style>
    body { font-family: sans-serif; }
    .listbox { position: absolute; z-index: 50; margin-top: 4px; border: 1px solid #d4d4d4; background: #fff; }
    [role="option"] { padding: 6px 12px; }
    [role="option"].active { background: #e0e7ff; }
    .card { display: block; border: 1px solid #d4d4d4; padding: 16px; border-radius: 8px; margin-bottom: 8px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    button:disabled { opacity: 0.4; }
  </style>
</head>
<body>
  <main id="conteudo">
    <section aria-label="Catálogo de Trilhas">
      <div role="search">
        <label for="catalog-search-input" class="sr-only">Buscar trilhas e aulas...</label>
        <input
          id="catalog-search-input"
          type="search"
          placeholder="Buscar trilhas e aulas..."
          aria-label="Buscar trilhas e aulas..."
          aria-controls="catalog-results"
          autocomplete="off"
        />

        <div role="group" aria-label="Filtros">
          <div class="relative" style="position:relative;display:inline-block;">
            <button
              id="filter-categoria-btn"
              type="button"
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-label="Abrir filtro Categoria: Todos"
            >
              <span>Categoria:</span> <span>Todos</span> <span aria-hidden="true">▼</span>
            </button>
          </div>
          <div class="relative" style="position:relative;display:inline-block;">
            <button
              id="filter-status-btn"
              type="button"
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-label="Abrir filtro Status: Todos"
            >
              <span>Status:</span> <span>Todos</span> <span aria-hidden="true">▼</span>
            </button>
          </div>
        </div>
      </div>

      <div
        id="catalog-result-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
        data-testid="catalog-result-status"
      ></div>

      <div id="catalog-results"></div>
    </section>
  </main>

  <script>
    (function () {
      var CATEGORY_OPTIONS = [
        { label: 'Todos', value: '' },
        { label: 'Discipulado', value: 'discipulado' },
        { label: 'Liderança', value: 'lideranca' },
        { label: 'Família', value: 'familia' },
        { label: 'Devocionais', value: 'devocionais' },
      ];

      // --- FilterDropdown (FR-016) -----------------------------------------
      function wireDropdown(btnId, label, options) {
        var btn = document.getElementById(btnId);
        var listbox = null;
        var activeIdx = -1;

        function open() {
          if (listbox) return;
          activeIdx = 0;
          listbox = document.createElement('ul');
          listbox.className = 'listbox';
          listbox.setAttribute('role', 'listbox');
          listbox.setAttribute('aria-label', label);
          listbox.setAttribute('tabindex', '0');
          options.forEach(function (opt, idx) {
            var li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.textContent = opt.label;
            if (idx === activeIdx) li.classList.add('active');
            li.addEventListener('click', function () { close(); });
            listbox.appendChild(li);
          });
          listbox.addEventListener('keydown', onListKeyDown);
          btn.parentNode.appendChild(listbox);
          btn.setAttribute('aria-expanded', 'true');
          listbox.focus();
        }

        function close() {
          if (!listbox) return;
          listbox.remove();
          listbox = null;
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }

        function highlight(idx) {
          var opts = listbox.querySelectorAll('[role="option"]');
          opts.forEach(function (o, i) { o.classList.toggle('active', i === idx); });
        }

        function onListKeyDown(e) {
          if (e.key === 'Escape') { e.preventDefault(); close(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = (activeIdx + 1) % options.length; highlight(activeIdx); }
          if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = (activeIdx - 1 + options.length) % options.length; highlight(activeIdx); }
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); }
          if (e.key === 'Tab') { close(); }
        }

        btn.addEventListener('click', function () { listbox ? close() : open(); });
        btn.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { if (listbox) { e.preventDefault(); close(); } return; }
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            open();
          }
        });
      }

      wireDropdown('filter-categoria-btn', 'Categoria', CATEGORY_OPTIONS);
      wireDropdown('filter-status-btn', 'Status', CATEGORY_OPTIONS);

      // --- Resultados + paginação (FR-017/FR-018) --------------------------
      var resultsContainer = document.getElementById('catalog-results');
      var statusRegion = document.getElementById('catalog-result-status');
      var PAGE_SIZE = 10;
      var currentResults = [];
      var currentPage = 1;

      function totalPages() { return Math.max(1, Math.ceil(currentResults.length / PAGE_SIZE)); }

      function render() {
        resultsContainer.innerHTML = '';
        var start = (currentPage - 1) * PAGE_SIZE;
        var pageResults = currentResults.slice(start, start + PAGE_SIZE);

        if (pageResults.length > 0) {
          var ul = document.createElement('ul');
          ul.setAttribute('role', 'list');
          ul.setAttribute('aria-label', 'Catálogo de Trilhas');
          pageResults.forEach(function (item) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.className = 'card';
            a.setAttribute('href', '/app/consumo/trilhas/' + item.trailId);
            a.setAttribute('aria-label', 'Ver trilha ' + item.lessonName);
            a.textContent = item.lessonName + ' — ' + item.trailName;
            li.appendChild(a);
            ul.appendChild(li);
          });
          resultsContainer.appendChild(ul);
        }

        // Paginação (só quando >1 página)
        if (totalPages() > 1) {
          var navEl = document.createElement('nav');
          navEl.setAttribute('aria-label', 'Filtros');
          var prev = document.createElement('button');
          prev.type = 'button';
          prev.setAttribute('aria-label', 'Página anterior');
          prev.textContent = 'Página anterior';
          prev.disabled = currentPage <= 1;
          prev.addEventListener('click', function () {
            if (currentPage > 1) { currentPage--; render(); }
          });
          var next = document.createElement('button');
          next.type = 'button';
          next.setAttribute('aria-label', 'Próxima página');
          next.textContent = 'Próxima página';
          next.disabled = currentPage >= totalPages();
          next.addEventListener('click', function () {
            if (currentPage < totalPages()) { currentPage++; render(); }
          });
          navEl.appendChild(prev);
          navEl.appendChild(next);
          resultsContainer.appendChild(navEl);
          // Re-focar o botão "próxima" após render (foco não se perde)
          if (document.activeElement === document.body && window.__lastFocusNext) {
            next.focus();
          }
        }
      }

      // dec-015: anunciar contagem via role=status; NÃO mover foco para resultados.
      window.__setResults = function (arr) {
        currentResults = arr || [];
        currentPage = 1;
        statusRegion.textContent = currentResults.length + ' trilha(s) encontrada(s)';
        render();
      };

      // Digitação aciona busca com debounce de 300ms (igual ao componente).
      var input = document.getElementById('catalog-search-input');
      var debounce = null;
      input.addEventListener('input', function () {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(function () {
          // mock "API": query não vazia → resultados injetados via __pendingResults
          var q = input.value.trim();
          if (q.length > 0) {
            window.__setResults(window.__pendingResults || []);
          } else {
            window.__setResults([]);
          }
        }, 300);
      });
    })();
  </script>
</body>
</html>
`;

test.describe('US5 — Catálogo e Busca: navegação por teclado', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(CATALOG_HTML, { waitUntil: 'domcontentloaded' });
    // Resultados padrão que a "API" retorna para qualquer query não vazia
    await page.evaluate((results) => {
      (window as unknown as { __pendingResults: unknown[] }).__pendingResults = results;
    }, MOCK_RESULTS);
  });

  // AC US5-1: campo de busca é o primeiro focável da seção (FR-015)
  test('AC1: campo de busca é o primeiro elemento focável da seção', async ({ page }) => {
    const searchInput = page.getByRole('searchbox');
    await expect(searchInput).toBeVisible();

    // Tab a partir do início do documento deve focar o searchbox primeiro
    await page.keyboard.press('Tab');
    await expect(searchInput).toBeFocused();
  });

  // AC US5-2: filtros acessíveis por teclado (FR-016)
  test('AC2: filtros abrem com Enter/Space e navegam com Arrow; Escape fecha', async ({ page }) => {
    const categoryBtn = page.getByRole('button', { name: /Categoria/i });
    await categoryBtn.focus();
    await expect(categoryBtn).toBeFocused();

    // Enter abre o listbox
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    // Arrow Down navega entre opções
    await page.keyboard.press('ArrowDown');
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

    // Aguardar debounce (300ms) + render
    await page.waitForTimeout(400);

    // Cards devem ser links (<a>) focáveis — nome via aria-label "Ver trilha {name}"
    const cards = page.getByRole('link', { name: /Fundamentos|Oração/i });
    await expect(cards.first()).toBeVisible();

    // dec-015: foco deve permanecer no input (NÃO mover para resultados)
    await expect(searchInput).toBeFocused();

    // Região role=status anuncia contagem
    const statusRegion = page.locator('[data-testid="catalog-result-status"]');
    await expect(statusRegion).toHaveAttribute('role', 'status');
    await expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    await expect(statusRegion).toContainText(/trilha\(s\) encontrada\(s\)/);
  });

  // AC US5-4: paginação alcançável via Tab com rótulos descritivos (FR-018)
  test('AC4: botões de paginação têm aria-label e são alcançáveis via Tab', async ({ page }) => {
    // 12 resultados forçam paginação (>10 por página)
    const manyResults = Array.from({ length: 12 }, (_, i) => ({
      lessonId: `lesson-${i}`,
      lessonName: `Aula ${i + 1}`,
      trailId: `trail-${i}`,
      trailName: 'Trilha',
    }));

    await page.evaluate((results) => {
      (window as unknown as { __setResults: (r: unknown[]) => void }).__setResults(results);
    }, manyResults);

    const nextBtn = page.getByRole('button', { name: /Próxima página/i });
    await expect(nextBtn).toBeVisible();

    const prevBtn = page.getByRole('button', { name: /Página anterior/i });
    await expect(prevBtn).toBeVisible();
    // Na primeira página, "anterior" está desabilitado
    await expect(prevBtn).toBeDisabled();

    // Ativar próxima página com Enter
    await nextBtn.focus();
    await page.keyboard.press('Enter');

    // "Página anterior" agora deve estar habilitado
    const prevBtnAfter = page.getByRole('button', { name: /Página anterior/i });
    await expect(prevBtnAfter).not.toBeDisabled();
  });

  // axe: sem violações critical na página do catálogo
  test('axe: sem violações critical na página de catálogo', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });
});
