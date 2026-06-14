import { describe, it, expect } from 'vitest';
import { checkBrandContrast, contrastRatio, relativeLuminance } from '../contrast-checker';

describe('relativeLuminance', () => {
  it('black (#000000) has luminance 0', () => {
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('white (#FFFFFF) has luminance ~1', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('throws for invalid hex', () => {
    expect(() => relativeLuminance('not-a-color')).toThrow();
  });
});

describe('contrastRatio', () => {
  it('black on white = 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('white on white = 1:1', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });
});

describe('checkBrandContrast', () => {
  it('yellow (#FFFF00) has poor contrast → hasWarning: true (AC7)', () => {
    const result = checkBrandContrast('#FFFF00');
    expect(result.hasWarning).toBe(true);
  });

  it('dark navy (#000080) has good contrast → hasWarning: false (AC7)', () => {
    const result = checkBrandContrast('#000080');
    expect(result.hasWarning).toBe(false);
  });

  it('returns surfaceBase and surfaceElevated ratios', () => {
    const result = checkBrandContrast('#000000');
    expect(result.surfaceBase).toBeGreaterThan(1);
    expect(result.surfaceElevated).toBeGreaterThan(1);
  });
});
