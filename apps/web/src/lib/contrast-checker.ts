/**
 * WCAG 2.1 contrast ratio utilities for brand color accessibility checking.
 *
 * Ref: spec.md §9.1, AC7 — non-blocking warning when ratio < 4.5:1 (WCAG AA).
 */

/** Surface reference colors (hardcoded per spec §9.1). */
const SURFACE_BASE = '#FAFAF8';
const SURFACE_ELEVATED = '#FFFFFF';

/**
 * Converts a single 8-bit channel value (0–255) to its linearized sRGB component.
 * WCAG 2.1 formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function linearize(value: number): number {
  const sRGB = value / 255;
  return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/**
 * Parses a hex color string (#RGB, #RRGGBB) into [r, g, b] channels (0–255).
 * Returns null if the input is not a valid hex color.
 */
function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const c0 = clean[0] ?? '';
    const c1 = clean[1] ?? '';
    const c2 = clean[2] ?? '';
    const r = parseInt(c0 + c0, 16);
    const g = parseInt(c1 + c1, 16);
    const b = parseInt(c2 + c2, 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

/**
 * Computes the relative luminance of a hex color as per WCAG 2.1.
 * Returns a value in [0, 1] where 0 = black and 1 = white.
 *
 * @throws {Error} if the input is not a valid hex color
 */
export function relativeLuminance(hexColor: string): number {
  const channels = parseHex(hexColor);
  if (!channels) {
    throw new Error(`Invalid hex color: ${hexColor}`);
  }
  const [r, g, b] = channels;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Computes the WCAG 2.1 contrast ratio between two hex colors.
 * Returns a value in [1, 21].
 *
 * @throws {Error} if either color is not a valid hex color
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const WCAG_AA_THRESHOLD = 4.5;

export interface BrandContrastResult {
  /** Contrast ratio between the primary brand color and surface-base (#FAFAF8). */
  surfaceBase: number;
  /** Contrast ratio between the primary brand color and surface-elevated (#FFFFFF). */
  surfaceElevated: number;
  /**
   * True if any ratio is below the WCAG AA threshold (4.5:1).
   * Non-blocking: the form shows a warning but does not prevent saving.
   */
  hasWarning: boolean;
}

/**
 * Checks whether a primary brand color meets WCAG AA contrast against
 * the project's standard surface colors.
 *
 * @param primaryHex - A hex color string (e.g. '#1E40AF')
 * @returns Contrast ratios and a warning flag
 */
export function checkBrandContrast(primaryHex: string): BrandContrastResult {
  const surfaceBase = contrastRatio(primaryHex, SURFACE_BASE);
  const surfaceElevated = contrastRatio(primaryHex, SURFACE_ELEVATED);
  const hasWarning = surfaceBase < WCAG_AA_THRESHOLD || surfaceElevated < WCAG_AA_THRESHOLD;
  return { surfaceBase, surfaceElevated, hasWarning };
}
