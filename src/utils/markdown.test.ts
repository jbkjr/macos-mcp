/**
 * Markdown to HTML Converter Tests
 */

import { describe, it, expect } from 'vitest';
import { markdownToHtml } from './markdown.js';

describe('markdownToHtml', () => {
  describe('basic conversions', () => {
    it('should return empty string for empty input', () => {
      expect(markdownToHtml('')).toBe('');
      expect(markdownToHtml(null as unknown as string)).toBe('');
    });

    it('should escape HTML entities', () => {
      expect(markdownToHtml('Tom & Jerry')).toContain('&amp;');
    });
  });

  describe('headings', () => {
    it('should convert h1 headings', () => {
      expect(markdownToHtml('# Heading 1')).toBe('<h1>Heading 1</h1>');
    });

    it('should convert h2 headings', () => {
      expect(markdownToHtml('## Heading 2')).toBe('<h2>Heading 2</h2>');
    });

    it('should convert h3 headings', () => {
      expect(markdownToHtml('### Heading 3')).toBe('<h3>Heading 3</h3>');
    });

    it('should convert h4 headings', () => {
      expect(markdownToHtml('#### Heading 4')).toBe('<h4>Heading 4</h4>');
    });

    it('should convert h5 headings', () => {
      expect(markdownToHtml('##### Heading 5')).toBe('<h5>Heading 5</h5>');
    });

    it('should convert h6 headings', () => {
      expect(markdownToHtml('###### Heading 6')).toBe('<h6>Heading 6</h6>');
    });

    it('should handle multiple headings', () => {
      const input = '# H1\n## H2\n### H3';
      const result = markdownToHtml(input);
      expect(result).toContain('<h1>H1</h1>');
      expect(result).toContain('<h2>H2</h2>');
      expect(result).toContain('<h3>H3</h3>');
    });
  });

  describe('text formatting', () => {
    it('should convert bold text with asterisks', () => {
      expect(markdownToHtml('**bold**')).toBe('<b>bold</b>');
    });

    it('should convert bold text with underscores', () => {
      expect(markdownToHtml('__bold__')).toBe('<b>bold</b>');
    });

    it('should convert italic text with asterisks', () => {
      expect(markdownToHtml('*italic*')).toBe('<i>italic</i>');
    });

    it('should convert italic text with underscores', () => {
      expect(markdownToHtml('_italic_')).toBe('<i>italic</i>');
    });

    it('should convert bold italic text', () => {
      expect(markdownToHtml('***bold italic***')).toBe('<b><i>bold italic</i></b>');
    });

    it('should convert strikethrough text', () => {
      expect(markdownToHtml('~~strikethrough~~')).toBe('<s>strikethrough</s>');
    });

    it('should convert inline code', () => {
      expect(markdownToHtml('`code`')).toBe('<code>code</code>');
    });
  });

  describe('links', () => {
    it('should convert markdown links', () => {
      expect(markdownToHtml('[text](https://example.com)')).toBe(
        '<a href="https://example.com">text</a>'
      );
    });

    it('should handle links with special characters in text', () => {
      expect(markdownToHtml('[Click here!](https://example.com)')).toBe(
        '<a href="https://example.com">Click here!</a>'
      );
    });
  });

  describe('lists', () => {
    it('should convert unordered lists with dashes', () => {
      const input = '- Item 1\n- Item 2\n- Item 3';
      const result = markdownToHtml(input);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
      expect(result).toContain('<li>Item 3</li>');
      expect(result).toContain('</ul>');
    });

    it('should convert unordered lists with asterisks', () => {
      const input = '* Item 1\n* Item 2';
      const result = markdownToHtml(input);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('should convert ordered lists', () => {
      const input = '1. First\n2. Second\n3. Third';
      const result = markdownToHtml(input);
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
      expect(result).toContain('<li>Second</li>');
      expect(result).toContain('<li>Third</li>');
      expect(result).toContain('</ol>');
    });
  });

  describe('blockquotes', () => {
    it('should convert blockquotes', () => {
      expect(markdownToHtml('> Quote')).toBe('<blockquote>Quote</blockquote>');
    });

    it('should merge consecutive blockquotes', () => {
      const input = '> Line 1\n> Line 2';
      const result = markdownToHtml(input);
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<br>');
      expect(result.match(/<blockquote>/g)?.length).toBe(1);
    });
  });

  describe('horizontal rules', () => {
    it('should convert --- to hr', () => {
      expect(markdownToHtml('---')).toBe('<hr>');
    });

    it('should convert *** to hr', () => {
      expect(markdownToHtml('***')).toBe('<hr>');
    });

    it('should convert ___ to hr', () => {
      expect(markdownToHtml('___')).toBe('<hr>');
    });
  });

  describe('line breaks', () => {
    it('should convert newlines to br tags', () => {
      const result = markdownToHtml('Line 1\nLine 2');
      expect(result).toContain('<br>');
    });

    it('should not add excessive br tags', () => {
      const result = markdownToHtml('Line 1\n\n\n\nLine 2');
      expect(result).not.toContain('<br><br><br>');
    });
  });

  describe('complex documents', () => {
    it('should handle a complete document', () => {
      const input = `# Title

This is a **bold** and *italic* paragraph.

## List Section

- Item 1
- Item 2
- Item 3

> A quote

[Link](https://example.com)`;

      const result = markdownToHtml(input);
      expect(result).toContain('<h1>Title</h1>');
      expect(result).toContain('<b>bold</b>');
      expect(result).toContain('<i>italic</i>');
      expect(result).toContain('<h2>List Section</h2>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<a href="https://example.com">Link</a>');
    });
  });
});
