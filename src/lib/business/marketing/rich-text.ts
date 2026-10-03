// @polsia:user-owned — client-safe rich-text model and conversion helpers.
import type {
  PageContent,
  RichTextBlock,
  RichTextDocument,
  RichTextInline,
  RichTextListItem,
  RichTextMap,
  RichTextText,
} from '@/lib/contracts/pages';

export type RichTextOptions = { allowHeadings?: boolean };
export type RichTextParseResult = { document: RichTextDocument; invalidLinks: string[] };

const SAFE_ROUTE = /^(?:\/(?!\/)|#|\?|\.\/|\.\.\/)/;

export function isSafeRichTextHref(href: string): boolean {
  const value = href.trim();
  if (
    !value ||
    value.split('').some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    return false;
  }
  if (SAFE_ROUTE.test(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function richTextFieldKey(sectionId: string, path: readonly (string | number)[]): string {
  return `section:${sectionId}:${path.join('.')}`;
}

export const pageBodyRichTextKey = 'page:body';

function nodeId(fieldKey: string, path: readonly (string | number)[]): string {
  return `${fieldKey}:${path.join('.') || 'root'}`.replace(/[^a-zA-Z0-9:._-]/g, '-');
}

function textNode(
  fieldKey: string,
  path: readonly (string | number)[],
  text: string,
): RichTextText {
  return { id: nodeId(fieldKey, path), type: 'text', text, marks: [] };
}

function inlineText(
  fieldKey: string,
  path: readonly (string | number)[],
  text: string,
): RichTextInline[] {
  return [textNode(fieldKey, path, text)];
}

export function plainTextToRichText(value: string, fieldKey: string): RichTextDocument {
  const blocks: RichTextBlock[] = value
    .split(/\n\s*\n/)
    .map((paragraph, _index) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => ({
      id: nodeId(fieldKey, ['block', index]),
      type: 'paragraph' as const,
      children: inlineText(fieldKey, ['block', index, 'text'], paragraph),
    }));
  if (blocks.length > 0 || !value) return { version: 1, blocks };
  return { version: 1, blocks: [] };
}

export function extractPlainText(document: RichTextDocument): string {
  return document.blocks
    .map((block) => {
      if (block.type === 'list') {
        return block.items.map((item) => inlinePlainText(item.children)).join('\n');
      }
      return inlinePlainText(block.children);
    })
    .join('\n\n');
}

function inlinePlainText(children: readonly RichTextInline[]): string {
  return children
    .map((child) => (child.type === 'link' ? inlinePlainText(child.children) : child.text))
    .join('');
}

function readInline(
  node: Node,
  fieldKey: string,
  path: readonly (string | number)[],
  marks: RichTextText['marks'],
  invalidLinks: string[],
): RichTextInline[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [{ ...textNode(fieldKey, path, node.textContent ?? ''), marks }];
  }
  if (!(node instanceof Element)) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return [{ ...textNode(fieldKey, path, '\n'), marks }];
  const nextMarks = [...marks];
  if ((tag === 'strong' || tag === 'b') && !nextMarks.includes('bold')) nextMarks.push('bold');
  if ((tag === 'em' || tag === 'i') && !nextMarks.includes('italic')) nextMarks.push('italic');
  if (tag === 'a') {
    const href = node.getAttribute('href') ?? '';
    const children = Array.from(node.childNodes).flatMap((child, index) =>
      readInline(child, fieldKey, [...path, 'link', index], nextMarks, invalidLinks),
    );
    if (!isSafeRichTextHref(href)) {
      invalidLinks.push(href);
      return children;
    }
    return [
      {
        id: nodeId(fieldKey, path),
        type: 'link',
        href: href.trim(),
        children: children.flatMap((child) => (child.type === 'link' ? child.children : [child])),
      },
    ];
  }
  return Array.from(node.childNodes).flatMap((child, index) =>
    readInline(child, fieldKey, [...path, index], nextMarks, invalidLinks),
  );
}

function normalizeChildren(children: RichTextInline[]): RichTextInline[] {
  return children.filter((child) => child.type === 'link' || child.text.length > 0);
}

function readBlock(
  node: Element,
  fieldKey: string,
  path: readonly (string | number)[],
  options: RichTextOptions,
  invalidLinks: string[],
): RichTextBlock[] {
  const tag = node.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') {
    const items: RichTextListItem[] = Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((child, index) => ({
        id: nodeId(fieldKey, [...path, 'item', index]),
        type: 'list-item' as const,
        children: normalizeChildren(
          Array.from(child.childNodes).flatMap((item, childIndex) =>
            readInline(item, fieldKey, [...path, 'item', index, childIndex], [], invalidLinks),
          ),
        ),
      }));
    return [
      {
        id: nodeId(fieldKey, path),
        type: 'list',
        ordered: tag === 'ol',
        items,
      },
    ];
  }
  const headingLevel = tag.match(/^h([1-3])$/);
  const type = headingLevel && options.allowHeadings ? 'heading' : 'paragraph';
  const children = normalizeChildren(
    Array.from(node.childNodes).flatMap((child, index) =>
      readInline(child, fieldKey, [...path, index], [], invalidLinks),
    ),
  );
  return [
    type === 'heading'
      ? { id: nodeId(fieldKey, path), type, level: Number(headingLevel?.[1]), children }
      : { id: nodeId(fieldKey, path), type, children },
  ];
}

export function parseEditableHtml(
  html: string,
  fieldKey: string,
  options: RichTextOptions = {},
): RichTextParseResult {
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  const invalidLinks: string[] = [];
  if (!root) return { document: { version: 1, blocks: [] }, invalidLinks };
  const blocks = Array.from(root.childNodes).flatMap((node, index) => {
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) return [];
    if (!(node instanceof Element)) {
      return [
        {
          id: nodeId(fieldKey, ['block', index]),
          type: 'paragraph' as const,
          children: normalizeChildren(
            readInline(node, fieldKey, ['block', index], [], invalidLinks),
          ),
        },
      ];
    }
    return readBlock(node, fieldKey, ['block', index], options, invalidLinks);
  });
  return { document: { version: 1, blocks }, invalidLinks };
}

function inlineHtml(child: RichTextInline): string {
  if (child.type === 'link') {
    return `<a href="${escapeAttribute(child.href)}">${child.children.map(inlineHtml).join('')}</a>`;
  }
  let value = escapeHtml(child.text);
  if (child.marks.includes('bold')) value = `<strong>${value}</strong>`;
  if (child.marks.includes('italic')) value = `<em>${value}</em>`;
  return value.replace(/\n/g, '<br>');
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

export function richTextToEditableHtml(document: RichTextDocument): string {
  return document.blocks
    .map((block) => {
      if (block.type === 'list') {
        const tag = block.ordered ? 'ol' : 'ul';
        return `<${tag}>${block.items
          .map((item) => `<li>${item.children.map(inlineHtml).join('')}</li>`)
          .join('')}</${tag}>`;
      }
      const tag = block.type === 'heading' ? `h${block.level}` : 'p';
      return `<${tag}>${block.children.map(inlineHtml).join('')}</${tag}>`;
    })
    .join('');
}

export function getRichText(content: PageContent, key: string): RichTextDocument | undefined {
  return content.richText?.[key];
}

export function withRichText(
  content: PageContent,
  key: string,
  document: RichTextDocument,
): PageContent {
  const richText: RichTextMap = { ...(content.richText ?? {}), [key]: document };
  return { ...content, richText };
}

export function updatePath(
  value: Record<string, unknown>,
  path: readonly (string | number)[],
  replacement: unknown,
): Record<string, unknown> {
  const [head, ...tail] = path;
  if (head === undefined) return value;
  const next = Array.isArray(value) ? [...value] : { ...value };
  if (tail.length === 0) {
    (next as Record<string | number, unknown>)[head] = replacement;
    return next as Record<string, unknown>;
  }
  const child = (value as Record<string | number, unknown>)[head];
  if (Array.isArray(child)) {
    const childNext = [...child];
    childNext[Number(tail[0])] = updatePath(
      (childNext[Number(tail[0])] as Record<string, unknown>) ?? {},
      tail.slice(1),
      replacement,
    );
    (next as Record<string | number, unknown>)[head] = childNext;
  } else {
    (next as Record<string | number, unknown>)[head] = updatePath(
      (child as Record<string, unknown>) ?? {},
      tail,
      replacement,
    );
  }
  return next as Record<string, unknown>;
}
