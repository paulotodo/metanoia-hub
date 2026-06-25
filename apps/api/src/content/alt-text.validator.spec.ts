import { AltTextValidator } from './alt-text.validator';

describe('AltTextValidator', () => {
  describe('hasInvalidImgs', () => {
    it('should return true for <img> without alt attribute', () => {
      const html = '<p>Hello</p><img src="photo.jpg" /><p>World</p>';
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(true);
    });

    it('should return true for <img> with empty alt attribute', () => {
      const html = '<img src="photo.jpg" alt="" />';
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(true);
    });

    it('should return true for <img> with alt= but no value', () => {
      const html = '<img src="photo.jpg" alt= />';
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(true);
    });

    it('should return false for <img> with non-empty alt attribute (double quotes)', () => {
      const html = '<img src="photo.jpg" alt="Photo of the team" />';
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(false);
    });

    it('should return false for <img> with non-empty alt attribute (single quotes)', () => {
      const html = "<img src='photo.jpg' alt='Foto da equipe' />";
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(false);
    });

    it('should return false for null input', () => {
      expect(AltTextValidator.hasInvalidImgs(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(AltTextValidator.hasInvalidImgs(undefined)).toBe(false);
    });

    it('should return false for empty string input', () => {
      expect(AltTextValidator.hasInvalidImgs('')).toBe(false);
    });

    it('should return false for HTML without any img tags', () => {
      const html = '<p>Some text with <strong>bold</strong> content</p>';
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(false);
    });

    it('should detect mixed: one valid alt and one missing alt', () => {
      const html = '<img src="a.jpg" alt="Valid" /> <img src="b.jpg" />';
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(true);
    });

    it('should return true for TipTap-generated img without alt (common editor output)', () => {
      const html = '<img src="https://cdn.example.com/image.png" width="800" height="600">';
      expect(AltTextValidator.hasInvalidImgs(html)).toBe(true);
    });
  });
});
