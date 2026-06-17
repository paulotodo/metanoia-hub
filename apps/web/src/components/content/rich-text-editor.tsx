'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useCallback } from 'react';

interface RichTextEditorProps {
  /** Initial HTML content (e.g., from contentBody field) */
  value?: string | null;
  /** Called with the HTML string whenever content changes */
  onChange?: (html: string) => void;
  /** Whether the editor is read-only (participant view) */
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * RichTextEditor — editor de texto enriquecido para conteúdo de aulas.
 * Salva conteúdo como HTML no campo `contentBody` do banco de dados.
 * Suporta: negrito, itálico, títulos (H1-H3), listas, links e imagens.
 */
export function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Image,
    ],
    content: value ?? '',
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL do link:', previousUrl ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  if (readOnly) {
    return (
      <div
        className={`prose prose-sm max-w-none ${className ?? ''}`}
        data-testid="rich-text-viewer"
        dangerouslySetInnerHTML={{ __html: value ?? '' }}
      />
    );
  }

  return (
    <div
      className={`rounded-lg border focus-within:ring-2 focus-within:ring-brand-teal/30 ${className ?? ''}`}
      data-testid="rich-text-editor"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b bg-muted/30 px-3 py-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-1 text-sm font-bold hover:bg-muted ${editor.isActive('bold') ? 'bg-muted' : ''}`}
          aria-label="Negrito"
          aria-pressed={editor.isActive('bold')}
        >
          N
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-1 text-sm italic hover:bg-muted ${editor.isActive('italic') ? 'bg-muted' : ''}`}
          aria-label="Itálico"
          aria-pressed={editor.isActive('italic')}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded px-2 py-1 text-sm font-semibold hover:bg-muted ${editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}`}
          aria-label="Título H2"
          aria-pressed={editor.isActive('heading', { level: 2 })}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`rounded px-2 py-1 text-sm hover:bg-muted ${editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}`}
          aria-label="Título H3"
          aria-pressed={editor.isActive('heading', { level: 3 })}
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded px-2 py-1 text-sm hover:bg-muted ${editor.isActive('bulletList') ? 'bg-muted' : ''}`}
          aria-label="Lista com marcadores"
          aria-pressed={editor.isActive('bulletList')}
        >
          •—
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded px-2 py-1 text-sm hover:bg-muted ${editor.isActive('orderedList') ? 'bg-muted' : ''}`}
          aria-label="Lista numerada"
          aria-pressed={editor.isActive('orderedList')}
        >
          1.
        </button>
        <button
          type="button"
          onClick={setLink}
          className={`rounded px-2 py-1 text-sm hover:bg-muted ${editor.isActive('link') ? 'bg-muted' : ''}`}
          aria-label="Inserir link"
          aria-pressed={editor.isActive('link')}
        >
          Link
        </button>
      </div>
      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 focus:outline-none min-h-[200px]"
      />
    </div>
  );
}
