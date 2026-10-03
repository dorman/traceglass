// @polsia:user-owned — lightweight owner-facing rich-text editor island.
'use client';

import { Bold, Heading2, Italic, Link2, List, ListOrdered, Redo2, Undo2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  extractPlainText,
  isSafeRichTextHref,
  parseEditableHtml,
  plainTextToRichText,
  type RichTextOptions,
  richTextToEditableHtml,
} from '@/lib/business/marketing/rich-text';
import type { RichTextDocument } from '@/lib/contracts/pages';

type RichTextEditorProps = {
  fieldKey: string;
  label: string;
  fallback: string;
  document?: RichTextDocument;
  options?: RichTextOptions;
  onChange: (document: RichTextDocument, plainText: string) => void;
};

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  fieldKey,
  label,
  fallback,
  document: documentValue,
  options = {},
  onChange,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const locallyEmittedDocumentRef = useRef<RichTextDocument | null>(null);
  const [linkHref, setLinkHref] = useState('');
  const [invalidLinks, setInvalidLinks] = useState<string[]>([]);
  const allowHeadings = options.allowHeadings === true;

  const currentDocument = documentValue ?? plainTextToRichText(fallback, fieldKey);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (locallyEmittedDocumentRef.current === currentDocument) {
      // The parent is echoing this editor's input. Keep the browser's live DOM
      // and selection; normalizing it here would move the caret after Enter.
      locallyEmittedDocumentRef.current = null;
      return;
    }
    locallyEmittedDocumentRef.current = null;
    const html = richTextToEditableHtml(currentDocument);
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }, [currentDocument]);

  const rememberSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  function restoreSelection() {
    const selection = window.getSelection();
    const range = selectionRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const emitFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const parsed = parseEditableHtml(editor.innerHTML, fieldKey, { allowHeadings });
    locallyEmittedDocumentRef.current = parsed.document;
    setInvalidLinks(parsed.invalidLinks);
    onChange(parsed.document, extractPlainText(parsed.document));
  }, [allowHeadings, fieldKey, onChange]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const handleInput = () => {
      emitFromEditor();
      rememberSelection();
    };
    editor.addEventListener('input', handleInput);
    editor.addEventListener('keyup', rememberSelection);
    editor.addEventListener('mouseup', rememberSelection);
    editor.addEventListener('select', rememberSelection);
    return () => {
      editor.removeEventListener('input', handleInput);
      editor.removeEventListener('keyup', rememberSelection);
      editor.removeEventListener('mouseup', rememberSelection);
      editor.removeEventListener('select', rememberSelection);
    };
  }, [emitFromEditor, rememberSelection]);

  function command(name: string, value?: string) {
    restoreSelection();
    document.execCommand(name, false, value);
    emitFromEditor();
    rememberSelection();
  }

  function applyLink() {
    const href = linkHref.trim();
    if (!isSafeRichTextHref(href)) {
      setInvalidLinks([href || 'empty URL']);
      return;
    }
    command('createLink', href);
    setLinkHref('');
    setInvalidLinks([]);
  }

  return (
    <div className="grid gap-2">
      <span className="font-medium">{label}</span>
      <div className="overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/30 p-1">
          <ToolbarButton label="Bold" onClick={() => command('bold')}>
            <Bold aria-hidden />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => command('italic')}>
            <Italic aria-hidden />
          </ToolbarButton>
          {options.allowHeadings ? (
            <ToolbarButton label="Heading 2" onClick={() => command('formatBlock', '<h2>')}>
              <Heading2 aria-hidden />
            </ToolbarButton>
          ) : null}
          <ToolbarButton label="Bulleted list" onClick={() => command('insertUnorderedList')}>
            <List aria-hidden />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" onClick={() => command('insertOrderedList')}>
            <ListOrdered aria-hidden />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-border" aria-hidden />
          <div className="flex min-w-0 flex-1 gap-1">
            <label htmlFor={`${fieldKey}-link`} className="sr-only">
              Link URL
            </label>
            <input
              id={`${fieldKey}-link`}
              value={linkHref}
              onChange={(event) => setLinkHref(event.target.value)}
              onFocus={rememberSelection}
              placeholder="Link URL (route or https://)"
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              inputMode="url"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={applyLink}
              aria-label="Apply link"
            >
              <Link2 aria-hidden />
              <span className="hidden sm:inline">Link</span>
            </Button>
          </div>
          <div className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton label="Undo" onClick={() => command('undo')}>
            <Undo2 aria-hidden />
          </ToolbarButton>
          <ToolbarButton label="Redo" onClick={() => command('redo')}>
            <Redo2 aria-hidden />
          </ToolbarButton>
        </div>
        <div
          ref={editorRef}
          contentEditable
          className="min-h-28 max-w-none overflow-wrap-anywhere p-3 text-sm leading-6 outline-none [&_a]:text-primary [&_a]:underline [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc"
          suppressContentEditableWarning
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Supports bold, italic, links, lists, and safe headings in body copy. Structured values stay
        in Advanced structured values.
      </p>
      {invalidLinks.length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Unsupported link removed. Use an internal route or an HTTPS URL.
        </p>
      ) : null}
    </div>
  );
}
