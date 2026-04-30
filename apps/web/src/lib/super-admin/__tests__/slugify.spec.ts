import { describe, expect, it } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
  it.each([
    ['Igreja Restauração', 'igreja-restauracao'],
    ['Comunidade @Esperança 2!', 'comunidade-esperanca-2'],
    ['  Igreja  Vida  Nova  ', 'igreja-vida-nova'],
    ['Café & Pão', 'cafe-pao'],
    ['ABC', 'abc'],
    ['---test---', 'test'],
  ])('slugify(%j) → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
