import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Button, Space, Divider, Tooltip } from 'antd';
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  UndoOutlined, RedoOutlined, PrinterOutlined,
} from '@ant-design/icons';

interface Props {
  content: string;
  onChange?: (html: string) => void;
  onPrint?: () => void;
  readOnly?: boolean;
}

export default function ContratoEditor({ content, onChange, onPrint, readOnly }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => onChange?.(ed.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  const btn = (title: string, icon: React.ReactNode, active: boolean, onClick: () => void) => (
    <Tooltip title={title}>
      <Button
        size="small"
        icon={icon}
        type={active ? 'primary' : 'default'}
        onClick={onClick}
        style={{ minWidth: 30 }}
      />
    </Tooltip>
  );

  const handlePrint = () => {
    if (onPrint) { onPrint(); return; }
    const html = editor?.getHTML() ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Contrato</title>
      <style>
        @page { size: A4; margin: 2cm; }
        body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #000; }
        h1 { font-size: 16pt; } h2 { font-size: 14pt; } h3 { font-size: 13pt; }
        p { margin: 0 0 8pt; text-align: justify; }
        ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  if (!editor) return null;

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      {/* Toolbar */}
      {!readOnly && (
        <div style={{
          padding: '6px 10px',
          background: '#fafafa',
          borderBottom: '1px solid #d9d9d9',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
        }}>
          <Space size={2} wrap>
            {btn('Negrito (Ctrl+B)', <BoldOutlined />,
              editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
            {btn('Itálico (Ctrl+I)', <ItalicOutlined />,
              editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
            {btn('Sublinhado (Ctrl+U)', <UnderlineOutlined />,
              editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            {btn('Esquerda', <AlignLeftOutlined />,
              editor.isActive({ textAlign: 'left' }),
              () => editor.chain().focus().setTextAlign('left').run())}
            {btn('Centro', <AlignCenterOutlined />,
              editor.isActive({ textAlign: 'center' }),
              () => editor.chain().focus().setTextAlign('center').run())}
            {btn('Direita', <AlignRightOutlined />,
              editor.isActive({ textAlign: 'right' }),
              () => editor.chain().focus().setTextAlign('right').run())}

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            {btn('Lista com marcadores', <UnorderedListOutlined />,
              editor.isActive('bulletList'),
              () => editor.chain().focus().toggleBulletList().run())}
            {btn('Lista numerada', <OrderedListOutlined />,
              editor.isActive('orderedList'),
              () => editor.chain().focus().toggleOrderedList().run())}

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            {btn('Desfazer', <UndoOutlined />, false,
              () => editor.chain().focus().undo().run())}
            {btn('Refazer', <RedoOutlined />, false,
              () => editor.chain().focus().redo().run())}

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            <Tooltip title="Imprimir / Salvar PDF">
              <Button
                size="small"
                type="primary"
                icon={<PrinterOutlined />}
                onClick={handlePrint}
              >
                Imprimir
              </Button>
            </Tooltip>
          </Space>
        </div>
      )}

      {/* Editor */}
      <div style={{ padding: '12px 16px', minHeight: 400, background: '#fff' }}>
        <style>{`
          .ProseMirror { outline: none; min-height: 360px; }
          .ProseMirror p { margin: 0 0 8px; }
          .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { margin: 12px 0 6px; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 24px; }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
