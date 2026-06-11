import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchHighlight } from '../search-highlight';

describe('SearchHighlight — dec-014 XSS safety', () => {
  it('renders plain text without sentinels unchanged', () => {
    const { container } = render(<SearchHighlight snippet="texto simples" />);
    expect(container.textContent).toBe('texto simples');
    expect(container.querySelector('b')).toBeNull();
  });

  it('wraps sentinel-delimited text in <b> tag', () => {
    render(<SearchHighlight snippet={"texto \x02destacado\x03 aqui"} />);
    const bold = screen.getByText('destacado');
    expect(bold.tagName).toBe('B');
  });

  it('XSS dec-014: name with <script>alert(1)</script> renders as text, NOT as DOM element', () => {
    // Backend sends sentinel chars, not HTML. Even if payload contains HTML,
    // React escapes it as text content.
    const snippet = '<script>alert(1)</script> \x02script\x03 alert 1';
    const { container } = render(<SearchHighlight snippet={snippet} />);

    // No <script> element in the DOM
    expect(container.querySelector('script')).toBeNull();
    // The literal text '<script>' appears as text content
    expect(container.textContent).toContain('<script>alert(1)</script>');
    // The highlighted part 'script' is in a <b>
    const bold = screen.getByText('script');
    expect(bold.tagName).toBe('B');
  });

  it('XSS dec-014: snippet with <img> injection stays as text', () => {
    const snippet = '\x02resultado\x03 <img src=x onerror=alert(1)>';
    const { container } = render(<SearchHighlight snippet={snippet} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('does NOT use dangerouslySetInnerHTML (structural check)', () => {
    // The component renders spans and b tags — no innerHTML-based rendering.
    // Verify by checking that HTML entities are NOT decoded (they would be if innerHTML was used).
    const snippet = 'safe \x02&amp;term\x03 text';
    const { container } = render(<SearchHighlight snippet={snippet} />);
    // React text content shows literal &amp; not &
    expect(container.textContent).toContain('&amp;term');
  });

  it('multiple highlights in one snippet', () => {
    const snippet = "\x02fé\x03 e \x02graça\x03 de Deus";
    const { container } = render(<SearchHighlight snippet={snippet} />);
    const bolds = container.querySelectorAll('b');
    expect(bolds).toHaveLength(2);
    expect(bolds[0].textContent).toBe('fé');
    expect(bolds[1].textContent).toBe('graça');
  });
});
