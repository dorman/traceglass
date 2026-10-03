// @polsia:user-owned — allowlisted rich-text renderer for public copy.
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { isSafeRichTextHref } from '@/lib/business/marketing/rich-text';
import type { RichTextDocument, RichTextInline } from '@/lib/contracts/pages';

type RichTextContentProps = {
  document?: RichTextDocument;
  fallback: string;
  as?: 'div' | 'span';
  className?: string;
};

function Inline({ child }: { child: RichTextInline }): ReactNode {
  if (child.type === 'link') {
    if (!isSafeRichTextHref(child.href))
      return child.children.map((item) => <Inline key={item.id} child={item} />);
    const content = child.children.map((item) => <Inline key={item.id} child={item} />);
    return child.href.startsWith('/') || child.href.startsWith('#') ? (
      <Link href={child.href}>{content}</Link>
    ) : (
      <a href={child.href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  let content: ReactNode = child.text;
  if (child.marks.includes('bold')) content = <strong>{content}</strong>;
  if (child.marks.includes('italic')) content = <em>{content}</em>;
  return <span key={child.id}>{content}</span>;
}

function InlineChildren({ nodes }: { nodes: RichTextInline[] }) {
  return nodes.map((child) => <Inline key={child.id} child={child} />);
}

export function RichTextContent({
  document,
  fallback,
  as = 'div',
  className,
}: RichTextContentProps) {
  if (!document) {
    return as === 'span' ? (
      <span className={className}>{fallback}</span>
    ) : (
      <div className={className}>{fallback}</div>
    );
  }

  if (as === 'span') {
    return (
      <span className={className}>
        {document.blocks.map((block, index) => (
          <span key={block.id}>
            {index > 0 ? <br /> : null}
            {block.type === 'list' ? (
              block.items.map((item) => (
                <span key={item.id}>
                  <InlineChildren nodes={item.children} />
                  <br />
                </span>
              ))
            ) : (
              <InlineChildren nodes={block.children} />
            )}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className={className}>
      {document.blocks.map((block) => {
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={block.id}>
              {block.items.map((item) => (
                <li key={item.id}>
                  <InlineChildren nodes={item.children} />
                </li>
              ))}
            </List>
          );
        }
        if (block.type === 'heading') {
          const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3';
          return (
            <Heading key={block.id}>
              <InlineChildren nodes={block.children} />
            </Heading>
          );
        }
        return (
          <p key={block.id}>
            <InlineChildren nodes={block.children} />
          </p>
        );
      })}
    </div>
  );
}
