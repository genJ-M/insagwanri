'use client';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { clsx } from 'clsx';
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Minus, Undo, Redo,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  className?: string;
}

function ToolbarBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-primary-100 text-primary-600'
          : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '내용을 입력하세요.',
  minHeight = 180,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const ICON_SIZE = 'h-3.5 w-3.5';

  return (
    <div className={clsx('border border-border rounded-xl overflow-hidden bg-white', className)}>
      {/* 툴바 */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-gray-50">
          {/* 굵기 / 기울임 / 밑줄 / 취소선 */}
          <ToolbarBtn title="굵게 (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="기울임 (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="밑줄 (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className={ICON_SIZE} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-border mx-1" />

          {/* 정렬 */}
          <ToolbarBtn title="왼쪽 정렬" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeft className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="가운데 정렬" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenter className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="오른쪽 정렬" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRight className={ICON_SIZE} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-border mx-1" />

          {/* 목록 */}
          <ToolbarBtn title="글머리 목록" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="번호 목록" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className={ICON_SIZE} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-border mx-1" />

          {/* 실행취소 / 다시실행 */}
          <ToolbarBtn title="실행 취소 (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
            <Undo className={ICON_SIZE} />
          </ToolbarBtn>
          <ToolbarBtn title="다시 실행 (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
            <Redo className={ICON_SIZE} />
          </ToolbarBtn>
        </div>
      )}

      {/* 에디터 본문 */}
      <EditorContent
        editor={editor}
        className={clsx(
          'prose prose-sm max-w-none px-4 py-3 focus-within:ring-2 focus-within:ring-primary-100 transition-all',
          disabled && 'bg-gray-50 text-text-secondary cursor-not-allowed',
        )}
        style={{ minHeight }}
      />
    </div>
  );
}

/** HTML 읽기 전용 렌더러 (다운로드/출력용) */
export function RichTextViewer({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={clsx('prose prose-sm max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
