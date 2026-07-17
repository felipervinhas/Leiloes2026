export type TipoCampoLayout =
  | 'campo' | 'texto_livre' | 'bloco:parcelas' | 'logo' | 'retangulo'
  | 'bloco:tabela-lotes' | 'bloco:compradores' | 'bloco:tabela-propriedades'
  | 'bloco:tabela-lotes-fatura';

export type AlinhamentoH = 'left' | 'center' | 'right';
export type AlinhamentoV = 'top' | 'middle' | 'bottom';

export interface ColunaTabela {
  key: string;
  label: string;
  largura: number;
  visivel: boolean;
}

export interface CampoLayout {
  id: string;
  tipo: TipoCampoLayout;
  /** dot-path no catálogo de campos (obrigatório quando tipo === 'campo') */
  key?: string;
  /** texto fixo, pode conter placeholders {{grupo.campo}} (obrigatório quando tipo === 'texto_livre') */
  textoFixo?: string;
  /** posição/tamanho em milímetros, relativos à página A4 (210x297mm) */
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** família base da fonte: 'Helvetica' | 'Times-Roman' | 'Courier' */
  fontFamily: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color: string;
  align: AlinhamentoH;
  verticalAlign?: AlinhamentoV;
  /** fundo do texto (campo/texto_livre) ou preenchimento do retângulo */
  backgroundColor?: string;
  /** cor da borda do retângulo */
  borderColor?: string;
  /** espessura da borda do retângulo, em pt */
  borderWidth?: number;
  /** raio da borda do retângulo, em pt */
  borderRadius?: number;
  /** opacidade geral do campo, de 0 a 1 (útil para marca d'água) */
  opacity?: number;
  /** rotação em graus (útil para marca d'água na diagonal) */
  rotacao?: number;
  /** colunas da tabela (obrigatório quando tipo === 'bloco:tabela-lotes') */
  colunas?: ColunaTabela[];
  /** mini-layout do cartão repetido, coordenadas relativas ao próprio cartão (obrigatório quando tipo === 'bloco:compradores') */
  subLayout?: CampoLayout[];
  /** altura de cada cartão repetido, em mm (obrigatório quando tipo === 'bloco:compradores') */
  alturaCartao?: number;
  /** espaço vertical entre cartões repetidos, em mm */
  espacamentoCartao?: number;
  /** marcado por importações (ex. .fr3) quando o campo original não tem correspondência no catálogo atual — sinaliza no canvas que o usuário precisa trocar por um campo válido */
  naoMapeado?: boolean;
}

export const FONTES_BASE: { value: string; label: string }[] = [
  { value: 'Helvetica', label: 'Helvetica (sem serifa)' },
  { value: 'Times-Roman', label: 'Times (serifada)' },
  { value: 'Courier', label: 'Courier (monoespaçada)' },
];

const VARIANTES_CONHECIDAS: Record<string, { base: string; bold: boolean; italic: boolean }> = {
  'Helvetica': { base: 'Helvetica', bold: false, italic: false },
  'Helvetica-Bold': { base: 'Helvetica', bold: true, italic: false },
  'Helvetica-Oblique': { base: 'Helvetica', bold: false, italic: true },
  'Helvetica-BoldOblique': { base: 'Helvetica', bold: true, italic: true },
  'Times-Roman': { base: 'Times-Roman', bold: false, italic: false },
  'Times-Bold': { base: 'Times-Roman', bold: true, italic: false },
  'Times-Italic': { base: 'Times-Roman', bold: false, italic: true },
  'Times-BoldItalic': { base: 'Times-Roman', bold: true, italic: true },
  'Courier': { base: 'Courier', bold: false, italic: false },
  'Courier-Bold': { base: 'Courier', bold: true, italic: false },
  'Courier-Oblique': { base: 'Courier', bold: false, italic: true },
  'Courier-BoldOblique': { base: 'Courier', bold: true, italic: true },
};

/** Converte (família base + negrito + itálico) na fonte real embutida do PDF. */
export function resolverFontFamily(base: string, bold?: boolean, italic?: boolean): string {
  if (base === 'Times-Roman') {
    if (bold && italic) return 'Times-BoldItalic';
    if (bold) return 'Times-Bold';
    if (italic) return 'Times-Italic';
    return 'Times-Roman';
  }
  if (bold && italic) return `${base}-BoldOblique`;
  if (bold) return `${base}-Bold`;
  if (italic) return `${base}-Oblique`;
  return base;
}

/**
 * Normaliza um campo salvo (possivelmente no formato antigo, com fontFamily
 * combinando família+estilo, ex. "Helvetica-Bold") para o formato atual com
 * bold/italic separados. Também preenche defaults para campos novos.
 */
export function normalizarCampoLayout(c: any): CampoLayout {
  const variante = VARIANTES_CONHECIDAS[c.fontFamily];
  return {
    ...c,
    fontFamily: variante ? variante.base : (c.fontFamily || 'Helvetica'),
    bold: c.bold ?? variante?.bold ?? false,
    italic: c.italic ?? variante?.italic ?? false,
    underline: c.underline ?? false,
    align: c.align || 'left',
    verticalAlign: c.verticalAlign || 'top',
    opacity: c.opacity ?? 1,
    rotacao: c.rotacao ?? 0,
    subLayout: c.tipo === 'bloco:compradores' ? (c.subLayout || []).map(normalizarCampoLayout) : c.subLayout,
  };
}
