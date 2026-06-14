import { describe, it, expect } from 'vitest';
import {
  BrandingResponseSchema,
  BrandingColorSchema,
  UpdateBrandingSchema,
} from '../tenants/branding';

// ---------------------------------------------------------------------------
// Snapshot test — gates against silent breaking changes (AC9)
// ---------------------------------------------------------------------------

describe('BrandingResponseSchema', () => {
  it('matches snapshot', () => {
    expect(BrandingResponseSchema.shape).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// BrandingColorSchema — hex color validation
// ---------------------------------------------------------------------------

describe('BrandingColorSchema', () => {
  it('accepts a valid 6-digit hex color', () => {
    expect(() => BrandingColorSchema.parse('#1E40AF')).not.toThrow();
  });

  it('accepts a valid 3-digit hex color', () => {
    expect(() => BrandingColorSchema.parse('#F59')).not.toThrow();
  });

  it('accepts a valid 8-digit hex color (with alpha)', () => {
    expect(() => BrandingColorSchema.parse('#1E40AFFF')).not.toThrow();
  });

  it('rejects non-hex strings', () => {
    expect(() => BrandingColorSchema.parse('not-a-hex')).toThrow();
  });

  it('rejects color without # prefix', () => {
    expect(() => BrandingColorSchema.parse('1E40AF')).toThrow();
  });

  it('rejects strings > 9 chars', () => {
    expect(() => BrandingColorSchema.parse('#1E40AF00FF')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// UpdateBrandingSchema — strict (no extra keys)
// ---------------------------------------------------------------------------

describe('UpdateBrandingSchema', () => {
  it('accepts valid partial update', () => {
    const result = UpdateBrandingSchema.parse({ primaryColor: '#1E40AF' });
    expect(result.primaryColor).toBe('#1E40AF');
  });

  it('accepts empty object (no-op update)', () => {
    expect(() => UpdateBrandingSchema.parse({})).not.toThrow();
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(() =>
      UpdateBrandingSchema.parse({ primaryColor: '#1E40AF', unknownField: 'x' }),
    ).toThrow();
  });

  it('accepts displayName without colors (Free tenant use case)', () => {
    const result = UpdateBrandingSchema.parse({ displayName: 'Igreja Test' });
    expect(result.displayName).toBe('Igreja Test');
  });
});
