import React, { useEffect, useState } from 'react';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Button, Space, Divider, Tooltip, Segmented, Input } from 'antd';
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  UndoOutlined, RedoOutlined, PrinterOutlined, CodeOutlined, EyeOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;
type Modo = 'visual' | 'html';

// Não existe extensão oficial estável de font-size no Tiptap — segue o
// padrão da comunidade, adicionando o atributo na mesma mark do TextStyle
// (a mesma usada por FontFamily/Color), só pra ler/preservar o "font-size"
// inline ao trocar entre os modos Visual e HTML.
const TIPOS_ESTILO_FONTE = ['textStyle', 'paragraph', 'heading'];

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: TIPOS_ESTILO_FONTE,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.fontSize || null,
          renderHTML: (attributes: { fontSize?: string | null }) => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}` };
          },
        },
      },
    }];
  },
});

// Preserva o atributo "style" inteiro (width, border, text-align, padding...)
// em vez de tentar modelar cada propriedade CSS individualmente — os templates
// de contrato vêm de HTML colado direto (ex.: layout da Knorr com tabelas de
// testemunhas), então é mais confiável guardar o style bruto do que recriar
// cada regra via atributos específicos do Tiptap.
const rawStyleAttr = {
  style: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.getAttribute('style'),
    renderHTML: (attributes: { style?: string | null }) =>
      attributes.style ? { style: attributes.style } : {},
  },
};

// <div> genérico com estilo (ex.: o frame de página com largura/fonte do
// contrato) — o Tiptap não tem um node de div por padrão, então sem isso o
// wrapper e seu style são descartados ao entrar no modo Visual.
const DivBlock = Node.create({
  name: 'divBlock',
  group: 'block',
  content: 'block+',
  addAttributes() {
    return rawStyleAttr;
  },
  parseHTML() {
    return [{ tag: 'div' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

// <span> vazio usado só como traço/linha em branco (ex.: as linhas de
// assinatura com border-bottom). Como não tem texto, não dá pra guardar como
// mark (marks precisam de conteúdo) — vira um node inline "atômico". Spans
// com texto continuam caindo no TextStyle normalmente (getAttrs devolve
// `false` e o Tiptap tenta as outras regras de parse).
const InlineSpan = Node.create({
  name: 'inlineSpan',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return rawStyleAttr;
  },
  parseHTML() {
    return [{
      tag: 'span',
      // Prioridade alta: span vazio precisa virar este node atômico ANTES do
      // TextStyle tentar tratá-lo como mark — mark em elemento sem texto não
      // gera nenhum conteúdo, e o traço da assinatura simplesmente some.
      priority: 1000,
      getAttrs: (element: HTMLElement) => (element.textContent?.trim() === '' ? {} : false),
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes)];
  },
});

interface Props {
  content: string;
  onChange?: (html: string) => void;
  onPrint?: () => void;
  readOnly?: boolean;
}

export default function ContratoEditor({ content, onChange, onPrint, readOnly }: Props) {
  const [modo, setModo] = useState<Modo>('visual');
  const [htmlEdit, setHtmlEdit] = useState(content);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily.configure({ types: TIPOS_ESTILO_FONTE }),
      Color.configure({ types: TIPOS_ESTILO_FONTE }),
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      DivBlock,
      InlineSpan,
      Table.extend({
        addAttributes() { return { ...this.parent?.(), ...rawStyleAttr }; },
      }).configure({ resizable: false }),
      TableRow.extend({
        addAttributes() { return { ...this.parent?.(), ...rawStyleAttr }; },
      }),
      TableHeader.extend({
        addAttributes() { return { ...this.parent?.(), ...rawStyleAttr }; },
      }),
      TableCell.extend({
        addAttributes() { return { ...this.parent?.(), ...rawStyleAttr }; },
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => onChange?.(ed.getHTML()),
  });

  // Só sincroniza o editor visual (e o texto do modo HTML) fora do modo HTML
  // — digitando no modo HTML, o editor Tiptap fica oculto mas continua ativo
  // por baixo, e sincronizar a cada tecla dispara o onUpdate dele, que reemite
  // o HTML já sem os estilos que o Tiptap não reconhece, sobrescrevendo o que
  // foi digitado num loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (modo === 'html') return;
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
    setHtmlEdit(content);
  }, [content, modo]);

  // Sai do modo HTML: joga o que foi digitado de volta pro editor visual.
  const irParaVisual = () => {
    editor?.commands.setContent(htmlEdit);
    onChange?.(htmlEdit);
    setModo('visual');
  };
  // Entra no modo HTML: parte do HTML atual do editor visual.
  const irParaHtml = () => {
    setHtmlEdit(editor?.getHTML() ?? content);
    setModo('html');
  };

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
    const html = modo === 'html' ? htmlEdit : (editor?.getHTML() ?? '');
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
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Space size={2} wrap>
            {modo === 'visual' && (
              <>
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
              </>
            )}

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

          <Segmented
            size="small"
            value={modo}
            onChange={v => (v === 'html' ? irParaHtml() : irParaVisual())}
            options={[
              { label: 'Visual', value: 'visual', icon: <EyeOutlined /> },
              { label: 'HTML', value: 'html', icon: <CodeOutlined /> },
            ]}
          />
        </div>
      )}

      {/* Editor */}
      <div style={{ padding: modo === 'html' ? 0 : '12px 16px', minHeight: 400, background: '#fff' }}>
        <style>{`
          .ProseMirror { outline: none; min-height: 360px; }
          .ProseMirror p { margin: 0 0 8px; }
          .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { margin: 12px 0 6px; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 24px; }
        `}</style>
        {modo === 'html' ? (
          <TextArea
            value={htmlEdit}
            onChange={e => { setHtmlEdit(e.target.value); onChange?.(e.target.value); }}
            autoSize={{ minRows: 18 }}
            style={{
              fontFamily: "'Courier New', monospace", fontSize: 13,
              border: 'none', borderRadius: 0, resize: 'vertical',
            }}
            placeholder="<p>Escreva o HTML do contrato aqui. Use style inline pra fonte e tamanho, ex.: <span style=&quot;font-family: 'Times New Roman'; font-size: 14pt;&quot;>texto</span></p>"
            readOnly={readOnly}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}
