import { describe, expect, it } from 'vitest';
import {
  extractPlainText,
  isSafeRichTextHref,
  parseEditableHtml,
  plainTextToRichText,
  richTextToEditableHtml,
} from '@/lib/business/marketing/rich-text';

describe('marketing rich text', () => {
  it('converts legacy paragraphs and extracts their plain text', () => {
    const document = plainTextToRichText('First paragraph.\n\nSecond paragraph.', 'page:body');

    expect(document.blocks).toHaveLength(2);
    expect(extractPlainText(document)).toBe('First paragraph.\n\nSecond paragraph.');
    expect(document.blocks[0]?.id).toContain('page:body:block.0');
  });

  it('round-trips supported marks, lists, headings, and safe links', () => {
    const parsed = parseEditableHtml(
      '<h2>Signal</h2><p><strong>Bold</strong> and <em>italic</em> <a href="/release">release</a></p><ul><li>One</li><li>Two</li></ul>',
      'section:hero:data:body',
      { allowHeadings: true },
    );

    expect(parsed.invalidLinks).toEqual([]);
    expect(parsed.document.blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'list',
    ]);
    expect(extractPlainText(parsed.document)).toContain('Bold and italic release');
    expect(richTextToEditableHtml(parsed.document)).toContain('<a href="/release">release</a>');
  });

  it('preserves Enter-created blocks and blank lines through editable serialization', () => {
    const html =
      '<div>First line</div><div>Second line</div><div><br></div><div>Fourth line</div>';
    const parsed = parseEditableHtml(html, 'section:hero:data:body');
    const plainText = extractPlainText(parsed.document);
    const serialized = richTextToEditableHtml(parsed.document);
    const roundTrip = parseEditableHtml(serialized, 'section:hero:data:body');

    expect(parsed.document.blocks).toHaveLength(4);
    expect(plainText).toBe('First line\n\nSecond line\n\n\n\n\nFourth line');
    expect(serialized).toBe(
      '<p>First line</p><p>Second line</p><p><br></p><p>Fourth line</p>',
    );
    expect(extractPlainText(roundTrip.document)).toBe(plainText);
  });

  it('turns unsafe links into plain text and never stores the scheme', () => {
    const parsed = parseEditableHtml('<p><a href="javascript:alert(1)">Do not run</a></p>', 'field');

    expect(parsed.invalidLinks).toEqual(['javascript:alert(1)']);
    expect(JSON.stringify(parsed.document)).not.toContain('javascript:');
    expect(extractPlainText(parsed.document)).toBe('Do not run');
  });

  it('only permits internal routes, hashes, and HTTPS URLs', () => {
    expect(isSafeRichTextHref('/docs')).toBe(true);
    expect(isSafeRichTextHref('#faq')).toBe(true);
    expect(isSafeRichTextHref('https://example.com/docs')).toBe(true);
    expect(isSafeRichTextHref('//evil.example')).toBe(false);
    expect(isSafeRichTextHref('http://example.com')).toBe(false);
    expect(isSafeRichTextHref('javascript:alert(1)')).toBe(false);
  });
});
