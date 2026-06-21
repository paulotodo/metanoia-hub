import { describe, it, expect } from 'vitest';
import { renderBaseLayout, escapeHtml, validateUrl, type BrandingData } from './base.layout';

const WITH_BRANDING: BrandingData = {
  primaryColor: '#D97706',
  secondaryColor: '#92400E',
  displayName: 'Igreja Exemplo',
  logoUrl: 'https://cdn.example.com/logo.png',
};

const WITHOUT_BRANDING: BrandingData = {
  primaryColor: null,
  secondaryColor: null,
  displayName: null,
  logoUrl: null,
};

describe('escapeHtml', () => {
  it('escapes <script> XSS payload (AC 1.1.2)', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes img onerror XSS payload (AC 1.1.2)', () => {
    const result = escapeHtml('"><img onerror=alert(1)>');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;img');
  });

  it('escapes all 5 HTML special characters', () => {
    expect(escapeHtml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#x27;');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('preserves non-special characters', () => {
    const input = 'João Conceição';
    expect(escapeHtml(input)).toBe('João Conceição');
  });
});

describe('validateUrl', () => {
  it('allows https URLs', () => {
    expect(validateUrl('https://app.metanoia.app/radar')).toBe('https://app.metanoia.app/radar');
  });

  it('allows http URLs', () => {
    expect(validateUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('blocks javascript: scheme', () => {
    expect(validateUrl('javascript:alert(1)')).toBe('#');
  });

  it('blocks data: URIs', () => {
    expect(validateUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('returns # for malformed URLs', () => {
    expect(validateUrl('not-a-url')).toBe('#');
  });

  it('preserves long signed URLs (800+ chars)', () => {
    const longUrl = 'https://cdn.example.com/export/' + 'a'.repeat(800);
    expect(validateUrl(longUrl)).toBe(longUrl);
  });
});

describe('renderBaseLayout', () => {
  it('matches snapshot with tenant branding', () => {
    const html = renderBaseLayout({
      content: '<p>Test content</p>',
      branding: WITH_BRANDING,
      subject: 'Test Subject',
    });
    expect(html).toMatchSnapshot();
  });

  it('matches snapshot without branding (uses defaults)', () => {
    const html = renderBaseLayout({
      content: '<p>Test content</p>',
      branding: WITHOUT_BRANDING,
      subject: 'Test Subject',
    });
    expect(html).toMatchSnapshot();
  });

  it('always contains charset UTF-8', () => {
    const html = renderBaseLayout({ content: '', branding: WITHOUT_BRANDING, subject: 'S' });
    expect(html).toContain('charset="UTF-8"');
  });

  it('uses default primaryColor when branding is null', () => {
    const html = renderBaseLayout({ content: '', branding: WITHOUT_BRANDING, subject: 'S' });
    expect(html).toContain('#1E40AF'); // default primary
  });

  it('uses tenant primaryColor when provided', () => {
    const html = renderBaseLayout({ content: '', branding: WITH_BRANDING, subject: 'S' });
    expect(html).toContain('#D97706');
  });

  it('logo img has alt attribute (CHK070 accessibility)', () => {
    const html = renderBaseLayout({ content: '', branding: WITH_BRANDING, subject: 'S' });
    expect(html).toMatch(/alt="[^"]+"/);
  });

  it('falls back to text logo when logoUrl is null (CHK065)', () => {
    const html = renderBaseLayout({ content: '', branding: WITHOUT_BRANDING, subject: 'S' });
    // Should NOT have an <img> tag in header (no logo URL)
    expect(html).not.toContain('<img src=');
    // Should have the displayName text instead
    expect(html).toContain('Metanoia');
  });
});
