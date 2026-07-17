import { CampoLayout } from './tipoLayout';
import { CampoDisponivel } from './promissoriaCampos';

const novoId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `imp${Date.now()}_${Math.random()}`;

/**
 * Dicionário de códigos de campo do sistema Delphi (usados nos .fr3 e também em
 * VARIAVEIS_DISPONIVEIS do editor de contratos) para o dot-path do catálogo de
 * campos do editor de relatórios (PROMISSORIA_CAMPOS). Códigos ambíguos (ex.
 * telefone comercial x residencial, quando o catálogo só tem um campo de telefone)
 * ficam de fora de propósito — o importador os traz como placeholder para decisão manual.
 */
export const DELPHI_FIELD_MAP: Record<string, string> = {
  LEILAO: 'dados.leilao', LEILOE: 'dados.leilao', DATLEI: 'dados.datlei', CODNOT: 'dados.codnot',

  NOMCOM: 'comp.nomexx', CPFCOM: 'comp.cpfxxx', ENDCOM: 'comp.endere', BAICOM: 'comp.bairro',
  CEPCOM: 'comp.cepxxx', MUNCOM: 'comp.nomeCidade', ESTCOM: 'comp.nomeEstado', EMACOM: 'comp.emailx',
  FONCOM: 'comp.celu1',

  NOMVEN: 'lote.nomeVendedor', CPFVEN: 'lote.cpfVendedor', CPFCNPJVEN: 'lote.cpfVendedor',
  ENDVEN: 'lote.endereVendedor', BAIVEN: 'lote.bairroVendedor', CEPVEN: 'lote.cepVendedor',
  MUNVEN: 'lote.cidadeVendedor', ESTVEN: 'lote.estadoVendedor',
  FONVEN: 'lote.celularVendedor', COMVEN: 'lote.celularVendedor', EMAVEN: 'lote.emailVendedor',

  LOTEXX: 'lote.lotexx', DESLOT: 'lote.deslot', RACACOM: 'lote.descricaoRaca',
  RPXXXX: 'lote.rpxxx', RPXXX: 'lote.rpxxx', SBBXXX: 'lote.sbbxxx', DATNAS: 'lote.datnas',
  CATEGO: 'lote.catego', PELAGE: 'lote.pelagem', PELAGEM: 'lote.pelagem', OBSLOT: 'lote.obslot',

  VLRTOT: 'comp.valorOriginal', VLRLIQ: 'comp.valorPagar', DESFIN: 'comp.desfin',
};

export interface AvisoImportacao {
  tipo: 'nao_mapeado' | 'banda_ignorada' | 'elemento_ignorado' | 'pagina_diferente';
  mensagem: string;
}

export interface ResultadoImportacaoFastReport {
  layout: CampoLayout[];
  avisos: AvisoImportacao[];
}

export interface OpcoesImportacaoFastReport {
  larguraEsperadaMM?: number;
  alturaEsperadaMM?: number;
  suportaBlocoParcelas?: boolean;
}

const PX_TO_MM = 25.4 / 96;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Converte TColor do Delphi (0x00BBGGRR) para hexadecimal #RRGGBB. */
function delphiColorToHex(dec: number): string {
  if (!Number.isFinite(dec) || dec < 0) return '#000000';
  const b = (dec >> 16) & 0xff;
  const g = (dec >> 8) & 0xff;
  const r = dec & 0xff;
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function mapFonte(nome: string): string {
  const n = (nome || '').toLowerCase();
  if (n.includes('times') || n.includes('serif')) return 'Times-Roman';
  if (n.includes('courier') || n.includes('consolas') || n.includes('mono')) return 'Courier';
  return 'Helvetica';
}

function mapAlign(hAlign: string | null): CampoLayout['align'] {
  if (hAlign === 'haCenter') return 'center';
  if (hAlign === 'haRight') return 'right';
  return 'left';
}

function mapVAlign(vAlign: string | null): NonNullable<CampoLayout['verticalAlign']> {
  if (vAlign === 'vaCenter') return 'middle';
  if (vAlign === 'vaBottom') return 'bottom';
  return 'top';
}

/**
 * Importa um relatório FastReport (.fr3, formato XML do Delphi) como ponto de partida
 * para o editor. Campos com correspondência conhecida (DELPHI_FIELD_MAP) viram campos
 * vinculados; os demais viram texto livre "[CODIGO]" para o usuário revisar e reatribuir.
 * Bandas repetidas de parcelas viram o bloco pronto "bloco:parcelas" (a banda em si não é
 * replicada campo a campo, pois o bloco já resolve a repetição das linhas).
 */
export function importarFastReport(
  xmlTexto: string,
  camposDisponiveis: CampoDisponivel[],
  opcoes: OpcoesImportacaoFastReport = {},
): ResultadoImportacaoFastReport {
  const doc = new DOMParser().parseFromString(xmlTexto, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Não foi possível interpretar o XML — verifique se o conteúdo colado é um .fr3 válido.');
  }

  const page = doc.getElementsByTagName('TfrxReportPage')[0];
  if (!page) {
    throw new Error('Nenhuma "TfrxReportPage" encontrada — este arquivo não parece ser um relatório FastReport.');
  }

  const avisos: AvisoImportacao[] = [];
  const layout: CampoLayout[] = [];
  const chavesConhecidas = new Set(camposDisponiveis.map(c => c.key));

  const paperWidth = parseFloat(page.getAttribute('PaperWidth') || '210');
  const paperHeight = parseFloat(page.getAttribute('PaperHeight') || '297');
  const leftMargin = parseFloat(page.getAttribute('LeftMargin') || '10');
  const topMargin = parseFloat(page.getAttribute('TopMargin') || '5');

  if (opcoes.larguraEsperadaMM && Math.abs(paperWidth - opcoes.larguraEsperadaMM) > 2) {
    avisos.push({
      tipo: 'pagina_diferente',
      mensagem: `A página do arquivo importado é ${paperWidth}x${paperHeight}mm, diferente do tamanho deste tipo de relatório (${opcoes.larguraEsperadaMM}x${opcoes.alturaEsperadaMM}mm). As posições podem ficar deslocadas.`,
    });
  }

  const pushCampo = (partial: Omit<CampoLayout, 'id'>) => {
    layout.push({ id: novoId(), ...partial });
  };

  const processarMemo = (el: Element, bandTopPx: number, bandLeftPx: number) => {
    const leftPx = parseFloat(el.getAttribute('Left') || '0');
    const topPx = parseFloat(el.getAttribute('Top') || '0');
    const wPx = parseFloat(el.getAttribute('Width') || '0');
    const hPx = parseFloat(el.getAttribute('Height') || '0');
    const dataField = el.getAttribute('DataField');
    const texto = el.getAttribute('Text') || '';
    if (!dataField && !texto.trim()) return; // rótulo vazio, nada a importar

    const fontHeight = parseFloat(el.getAttribute('Font.Height') || '-12');
    const fontStyle = parseInt(el.getAttribute('Font.Style') || '0', 10);
    const fontColorDec = parseInt(el.getAttribute('Font.Color') || '0', 10);
    const fillBack = el.getAttribute('Fill.BackColor');

    const base = {
      x: round2(leftMargin + (bandLeftPx + leftPx) * PX_TO_MM),
      y: round2(topMargin + (bandTopPx + topPx) * PX_TO_MM),
      largura: round2(Math.max(wPx * PX_TO_MM, 5)),
      altura: round2(Math.max(hPx * PX_TO_MM, 4)),
      fontFamily: mapFonte(el.getAttribute('Font.Name') || ''),
      fontSize: Math.max(6, Math.round(Math.abs(fontHeight) * 0.75)),
      bold: !!(fontStyle & 1),
      italic: !!(fontStyle & 2),
      underline: !!(fontStyle & 4),
      color: delphiColorToHex(fontColorDec),
      align: mapAlign(el.getAttribute('HAlign')),
      verticalAlign: mapVAlign(el.getAttribute('VAlign')),
      opacity: 1,
      rotacao: 0,
      ...(fillBack ? { backgroundColor: delphiColorToHex(parseInt(fillBack, 10)) } : {}),
    };

    if (dataField) {
      const chave = DELPHI_FIELD_MAP[dataField.toUpperCase()];
      if (chave && chavesConhecidas.has(chave)) {
        pushCampo({ tipo: 'campo', key: chave, ...base });
        return;
      }
      avisos.push({
        tipo: 'nao_mapeado',
        mensagem: `Campo "${dataField}" não tem correspondente conhecido no catálogo atual — inserido como texto "[${dataField}]" e marcado no canvas; substitua pelo campo correto na paleta.`,
      });
      pushCampo({ tipo: 'texto_livre', textoFixo: `[${dataField}]`, naoMapeado: true, ...base });
      return;
    }

    pushCampo({ tipo: 'texto_livre', textoFixo: texto, ...base });
  };

  const processarLogo = (el: Element, bandTopPx: number, bandLeftPx: number) => {
    if (layout.some(c => c.tipo === 'logo')) return; // só um logotipo por layout
    const leftPx = parseFloat(el.getAttribute('Left') || '0');
    const topPx = parseFloat(el.getAttribute('Top') || '0');
    const wPx = parseFloat(el.getAttribute('Width') || '0');
    const hPx = parseFloat(el.getAttribute('Height') || '0');
    pushCampo({
      tipo: 'logo',
      x: round2(leftMargin + (bandLeftPx + leftPx) * PX_TO_MM),
      y: round2(topMargin + (bandTopPx + topPx) * PX_TO_MM),
      largura: round2(Math.max(wPx * PX_TO_MM, 10)),
      altura: round2(Math.max(hPx * PX_TO_MM, 10)),
      fontFamily: 'Helvetica', fontSize: 9, color: '#000000', align: 'left',
      bold: false, italic: false, underline: false, verticalAlign: 'top', opacity: 1, rotacao: 0,
    });
    avisos.push({
      tipo: 'elemento_ignorado',
      mensagem: 'A imagem do logotipo original não foi importada — o bloco "Logotipo" usa a logo cadastrada da empresa.',
    });
  };

  Array.from(page.children).forEach(bandEl => {
    const datasetName = bandEl.getAttribute('DataSetName') || bandEl.getAttribute('DataSet') || '';
    const bandTopPx = parseFloat(bandEl.getAttribute('Top') || '0');
    const bandLeftPx = parseFloat(bandEl.getAttribute('Left') || '0');
    const ehBandaDeParcelas = /parcela/i.test(datasetName);

    if (ehBandaDeParcelas) {
      if (opcoes.suportaBlocoParcelas) {
        if (!layout.some(c => c.tipo === 'bloco:parcelas')) {
          const wPx = parseFloat(bandEl.getAttribute('Width') || '0');
          pushCampo({
            tipo: 'bloco:parcelas',
            x: round2(leftMargin + bandLeftPx * PX_TO_MM),
            y: round2(topMargin + bandTopPx * PX_TO_MM),
            largura: round2(Math.max(wPx * PX_TO_MM, 100)),
            altura: 60,
            fontFamily: 'Helvetica', fontSize: 8, color: '#000000', align: 'left',
            bold: false, italic: false, underline: false, verticalAlign: 'top', opacity: 1, rotacao: 0,
          });
          avisos.push({
            tipo: 'elemento_ignorado',
            mensagem: 'A tabela de parcelas foi posicionada com uma altura inicial padrão (60mm) — redimensione conforme a quantidade real de parcelas.',
          });
        }
      } else {
        avisos.push({
          tipo: 'banda_ignorada',
          mensagem: `A banda de parcelas ("${datasetName}") foi ignorada — este tipo de relatório não suporta tabela de parcelas.`,
        });
      }
      return; // não replica os campos individuais da banda, o bloco já resolve a repetição
    }

    Array.from(bandEl.children).forEach(el => {
      if (el.tagName === 'TfrxMemoView') processarMemo(el, bandTopPx, bandLeftPx);
      else if (el.tagName === 'TfrxPictureView') processarLogo(el, bandTopPx, bandLeftPx);
      // TfrxLineView e outras formas decorativas não têm equivalente direto — ignoradas silenciosamente
    });
  });

  return { layout, avisos };
}
