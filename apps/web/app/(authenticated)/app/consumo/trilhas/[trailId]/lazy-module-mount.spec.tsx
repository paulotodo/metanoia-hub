/**
 * lazy-module-mount.spec.tsx — T13
 * Ref: tasks.md §4.5.4, spec §FR-009.
 *
 * We mock IntersectionObserver so children don't mount until the IO fires.
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LazyModuleMount } from './lazy-module-mount';

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let ioCallback: IOCallback | null = null;
let observeSpy: ReturnType<typeof vi.fn>;
let disconnectSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  observeSpy = vi.fn();
  disconnectSpy = vi.fn();

  // Must use a class/constructor-like so `new IntersectionObserver(cb)` works
  class MockIntersectionObserver {
    constructor(cb: IOCallback) {
      ioCallback = cb;
    }
    observe = observeSpy;
    disconnect = disconnectSpy;
    unobserve = vi.fn();
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  ioCallback = null;
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// T13: LazyModuleMount
// ---------------------------------------------------------------------------

describe('LazyModuleMount — T13', () => {
  it('T13-not-mounted: children NOT in DOM before IO fires', () => {
    render(
      <LazyModuleMount placeholderHeight={80}>
        <div data-testid="lazy-child">Conteúdo do módulo</div>
      </LazyModuleMount>,
    );
    // Placeholder visible, child not rendered
    expect(screen.getByTestId('lazy-module-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('lazy-child')).toBeNull();
  });

  it('T13-mounts-after-io: children ARE in DOM after IO fires with isIntersecting=true', () => {
    render(
      <LazyModuleMount placeholderHeight={80}>
        <div data-testid="lazy-child">Conteúdo do módulo</div>
      </LazyModuleMount>,
    );

    // Simulate IO entry
    act(() => {
      ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(screen.getByTestId('lazy-child')).toBeTruthy();
    expect(screen.queryByTestId('lazy-module-placeholder')).toBeNull();
  });

  it('T13-no-mount-when-not-intersecting: children stay hidden if isIntersecting=false', () => {
    render(
      <LazyModuleMount placeholderHeight={80}>
        <div data-testid="lazy-child">Conteúdo</div>
      </LazyModuleMount>,
    );

    act(() => {
      ioCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    });

    expect(screen.queryByTestId('lazy-child')).toBeNull();
    expect(screen.getByTestId('lazy-module-placeholder')).toBeTruthy();
  });

  it('T13-placeholder-height: placeholder has inline style with correct height', () => {
    render(
      <LazyModuleMount placeholderHeight={120}>
        <div>Content</div>
      </LazyModuleMount>,
    );
    const placeholder = screen.getByTestId('lazy-module-placeholder');
    expect((placeholder as HTMLElement).style.height).toBe('120px');
  });

  it('T13-placeholder-aria-hidden: placeholder is aria-hidden', () => {
    render(
      <LazyModuleMount placeholderHeight={80}>
        <div>Content</div>
      </LazyModuleMount>,
    );
    const placeholder = screen.getByTestId('lazy-module-placeholder');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
  });

  it('T13-disconnect-after-mount: IO disconnects after mounting', () => {
    render(
      <LazyModuleMount placeholderHeight={80}>
        <div data-testid="lazy-child">Content</div>
      </LazyModuleMount>,
    );

    act(() => {
      ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
