import { describe, it, expect, vi } from 'vitest';
import { safeNavigate } from '../safe-navigate';

describe('safeNavigate', () => {
  it('calls push for valid relative path', () => {
    const push = vi.fn();
    safeNavigate('/app/radar', push);
    expect(push).toHaveBeenCalledExactlyOnceWith('/app/radar');
  });

  it('javascript: URL is rejected (no-op)', () => {
    const push = vi.fn();
    safeNavigate('javascript:alert(1)', push);
    expect(push).not.toHaveBeenCalled();
  });

  it('protocol-relative //evil.com is rejected', () => {
    const push = vi.fn();
    safeNavigate('//evil.com', push);
    expect(push).not.toHaveBeenCalled();
  });

  it('absolute external URL https://evil.com is rejected', () => {
    const push = vi.fn();
    safeNavigate('https://evil.com/steal', push);
    expect(push).not.toHaveBeenCalled();
  });

  it('data: URL is rejected', () => {
    const push = vi.fn();
    safeNavigate('data:text/html,<script>alert(1)</script>', push);
    expect(push).not.toHaveBeenCalled();
  });

  it('empty string is rejected', () => {
    const push = vi.fn();
    safeNavigate('', push);
    expect(push).not.toHaveBeenCalled();
  });

  it('undefined is rejected (no-op)', () => {
    const push = vi.fn();
    safeNavigate(undefined, push);
    expect(push).not.toHaveBeenCalled();
  });

  it('null is rejected (no-op)', () => {
    const push = vi.fn();
    safeNavigate(null, push);
    expect(push).not.toHaveBeenCalled();
  });

  it('vbscript: URL is rejected', () => {
    const push = vi.fn();
    safeNavigate('vbscript:msgbox(1)', push);
    expect(push).not.toHaveBeenCalled();
  });
});
