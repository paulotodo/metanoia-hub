/**
 * skip-nav.spec.ts -- E2E keyboard test: Skip Navigation (WCAG 2.1 SC 2.4.1)
 *
 * Ref: US1/AC1-AC3, FR-001, SC-007 -- feature a11y-teclado-publico FASE 6
 * Scope: public pages that render the SkipNav component (root layout).
 * Browser: Chromium only (dec-012).
 *
 * Scenarios:
 *   1. Tab key focuses SkipNav as FIRST element (homepage)
 *   2. SkipNav has translate-y-0 applied on focus (CSS visible)
 *   3. Enter on SkipNav moves focus to #conteudo area (where it exists)
 *   4. SkipNav is first Tab stop on pages with keyboard (not autoFocus) start
 */
import { test, expect } from '@playwright/test';

// Selector for the skip-nav anchor
const SKIP_NAV_SELECTOR = 'a[href="#conteudo"]';

// Pages where skip-nav is first Tab stop (no autoFocus competing)
// NOTE: /recuperar-senha has autoFocus on email, so SkipNav Tab-first is NOT guaranteed
// on that page (autoFocus competes with Tab order in some browsers). Excluded intentionally.
const PAGES_SKIP_FIRST = ['/', '/login', '/register'];

test.describe('Skip Navigation -- keyboard access (US1)', () => {
  test('Tab focuses SkipNav as first element on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Press Tab once from body -- skip-nav must be the FIRST focusable element
    await page.keyboard.press('Tab');

    const skipNav = page.locator(SKIP_NAV_SELECTOR);
    await expect(skipNav).toBeFocused({ timeout: 5_000 });
  });

  test('SkipNav is in focus order and gets CSS focus class when focused', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');

    const skipNav = page.locator(SKIP_NAV_SELECTOR);
    await expect(skipNav).toBeFocused();

    // Verify that the skip-nav element has the class that applies on focus
    // The CSS class -translate-y-[calc(100%+1rem)] is the off-screen state
    // and focus:translate-y-0 brings it back -- validate it IS in the DOM and focusable
    const className = await skipNav.getAttribute('class');
    expect(className).toContain('skip-nav');
    expect(className).toContain('focus:translate-y-0');

    // After Tab: the bounding box should be in the top area (position:absolute; top-4)
    // y may be slightly above viewport (e.g. -1px) due to browser sub-pixel rendering
    // Accept y >= -5 as "effectively visible" (within 5px of viewport edge)
    const box = await skipNav.boundingBox();
    expect(box).not.toBeNull();
    // Use optional chaining to avoid non-null assertion (eslint @typescript-eslint/no-non-null-assertion)
    const boxY = box?.y ?? -9999;
    expect(boxY).toBeGreaterThanOrEqual(-5);
  });

  test('Enter on SkipNav moves focus to main content area (#conteudo)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');
    const skipNav = page.locator(SKIP_NAV_SELECTOR);
    await expect(skipNav).toBeFocused();

    await page.keyboard.press('Enter');

    // Focus should be on or within #conteudo
    // OR the URL hash should update to #conteudo (native anchor behavior)
    const focusedId = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return 'none';
      if (el.id === 'conteudo') return 'conteudo';
      const main = document.querySelector('#conteudo');
      if (main?.contains(el)) return 'within-conteudo';
      // body focus after anchor jump is also acceptable (native anchor + tabindex=-1 on main)
      if (el === document.body) return 'body';
      return el.id || el.tagName;
    });

    // Accept: direct #conteudo, within it, or body (when main lacks tabindex, focus returns to body)
    expect(['conteudo', 'within-conteudo', 'body']).toContain(focusedId);

    // Additionally: the page URL should have #conteudo fragment
    await expect(page).toHaveURL(/#conteudo/);
  });

  for (const pagePath of PAGES_SKIP_FIRST) {
    test(`SkipNav is first Tab stop on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      await page.keyboard.press('Tab');

      const skipNav = page.locator(SKIP_NAV_SELECTOR);
      await expect(skipNav).toBeFocused({ timeout: 5_000 });
    });
  }

  test('SkipNav is present on /recuperar-senha (even if not Tab-first due to autoFocus)', async ({ page }) => {
    await page.goto('/recuperar-senha');
    await page.waitForLoadState('networkidle');

    // The SkipNav element must exist in the DOM on all public pages
    const skipNav = page.locator(SKIP_NAV_SELECTOR);
    await expect(skipNav).toBeAttached();
  });
});
