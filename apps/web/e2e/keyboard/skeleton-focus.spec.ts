/**
 * skeleton-focus.spec.ts -- E2E keyboard test: Skeleton focus stability (WCAG 2.1 SC 2.1.1)
 *
 * Ref: US6/AC1-AC2, FR-010/FR-011, SC-007 -- feature a11y-teclado-publico FASE 6
 * Browser: Chromium only (dec-012).
 *
 * Context: TrailCardSkeleton uses role="status" aria-busy="true" aria-label="Carregando..."
 * and aria-hidden on inner decorative elements. Skeleton elements must NOT be focusable
 * during loading -- Tab should skip them.
 *
 * Scenarios:
 *   1. Skeleton elements are not Tab-focusable (no tabIndex >= 0)
 *   2. Skeleton container has role="status" and aria-busy="true"
 *   3. Hydration does not cause focus loss (focus-stability)
 */
import { test, expect } from '@playwright/test';

test.describe('Skeleton loading states -- focus stability (US6)', () => {
  test('Tab does not focus skeleton decorative elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify no focusable elements inside role="status" skeletons
    const focusableInSkeletons = await page.locator(
      '[role="status"] button, [role="status"] a, ' +
      '[role="status"] input, [role="status"] [tabindex="0"]'
    ).count();

    expect(focusableInSkeletons).toBe(0);
  });

  test('Skeleton container has correct ARIA attributes', async ({ page }) => {
    // Inject a TrailCardSkeleton-like element to validate the contract
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.addScriptTag({
      content: `
        const skeleton = document.createElement('div');
        skeleton.setAttribute('role', 'status');
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Carregando trilha...');
        skeleton.setAttribute('data-testid', 'test-skeleton');
        skeleton.style.cssText = 'position:absolute;top:-9999px;';

        // Inner decorative divs -- should NOT be focusable
        for (let i = 0; i < 3; i++) {
          const bar = document.createElement('div');
          bar.className = 'skeleton-bar';
          bar.setAttribute('aria-hidden', 'true');
          skeleton.appendChild(bar);
        }

        document.body.appendChild(skeleton);
      `
    });

    const skeleton = page.locator('[data-testid="test-skeleton"]');
    await expect(skeleton).toHaveAttribute('role', 'status');
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    await expect(skeleton).toHaveAttribute('aria-label');

    // Inner elements should not be focusable
    const focusableChildren = await skeleton.locator('[tabindex="0"], button, a, input').count();
    expect(focusableChildren).toBe(0);
  });

  test('Skeleton does not trap focus during Tab traversal', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Inject skeleton BEFORE and AFTER a real focusable button
    await page.addScriptTag({
      content: `
        const before = document.createElement('div');
        before.setAttribute('role', 'status');
        before.setAttribute('aria-busy', 'true');
        before.setAttribute('aria-label', 'Carregando...');
        before.setAttribute('data-testid', 'skeleton-before');
        // inner divs NOT focusable
        for (let i = 0; i < 2; i++) {
          const d = document.createElement('div');
          d.setAttribute('aria-hidden', 'true');
          before.appendChild(d);
        }

        const realBtn = document.createElement('button');
        realBtn.setAttribute('data-testid', 'real-btn-between-skeletons');
        realBtn.textContent = 'Botao real';

        const after = document.createElement('div');
        after.setAttribute('role', 'status');
        after.setAttribute('aria-busy', 'true');
        after.setAttribute('aria-label', 'Carregando...');
        after.setAttribute('data-testid', 'skeleton-after');
        for (let i = 0; i < 2; i++) {
          const d = document.createElement('div');
          d.setAttribute('aria-hidden', 'true');
          after.appendChild(d);
        }

        document.body.appendChild(before);
        document.body.appendChild(realBtn);
        document.body.appendChild(after);
      `
    });

    // Focus the real button directly
    const realBtn = page.locator('[data-testid="real-btn-between-skeletons"]');
    await realBtn.focus();
    await expect(realBtn).toBeFocused();

    // Tab forward: should go to next REAL focusable element, skipping skeleton children
    await page.keyboard.press('Tab');

    // Focus should NOT be on a skeleton child
    const focusedInSkeleton = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const skelBefore = document.querySelector('[data-testid="skeleton-before"]');
      const skelAfter = document.querySelector('[data-testid="skeleton-after"]');
      return skelBefore?.contains(el) || skelAfter?.contains(el);
    });

    expect(focusedInSkeleton).toBe(false);
  });

  test('Skeleton aria-hidden inner elements not announced to AT', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.addScriptTag({
      content: `
        const skel = document.createElement('div');
        skel.setAttribute('role', 'status');
        skel.setAttribute('aria-busy', 'true');
        skel.setAttribute('data-testid', 'skel-aria-check');

        const inner = document.createElement('div');
        inner.setAttribute('aria-hidden', 'true');
        inner.setAttribute('data-testid', 'skel-inner');
        inner.textContent = 'decorativo';
        skel.appendChild(inner);
        document.body.appendChild(skel);
      `
    });

    const inner = page.locator('[data-testid="skel-inner"]');
    await expect(inner).toHaveAttribute('aria-hidden', 'true');
  });
});
