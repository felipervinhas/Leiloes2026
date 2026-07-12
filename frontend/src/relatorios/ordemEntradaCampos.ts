import type { OrdemEntradaContexto } from './ordemEntradaContext';
import type { CampoDisponivel } from './promissoriaCampos';
import type { ColunaTabela } from './tipoLayout';

export interface LoteOrdemPDF {
  id: number;
  lotexx: string;
  deslot?: string;
  nomeVendedor?: string;
  nomeRaca?: string;
  catego?: string;
  ordem: string;
  dataLeilao?: string;
  enderecoLeilao?: string;
  horaInicioLeilao?: string;
  leiloeiro?: string;
  horaFechamentoPreLeilao?: string;
  regulamentoLeilao?: string;
  observacoesLeilao?: string;
  categoriaLeilao?: string;
  tipoLeilao?: string;
  transmissaoLeilao?: string;
  linkTransmissao1Leilao?: string;
  linkTransmissao2Leilao?: string;
  urlCatalogoLeilao?: string;
  comissaoVendedorLeilao?: number;
  comissaoCompradorLeilao?: number;
  qtdParcelasLeilao?: number;
  multiploLeilao?: number;
  dataSaldoLeilao?: string;
  cidadeLeilao?: string;
  estadoLeilao?: string;
  condicaoPagamentoLeilao?: string;
}

/** Catálogo de campos de "documento" (fora da tabela de lotes) da Ordem de Entrada. */
export const ORDEM_ENTRADA_CAMPOS: CampoDisponivel[] = [
  { grupo: 'Documento', key: 'titulo', label: 'Título / Leilão' },
  { grupo: 'Documento', key: 'empresa', label: 'Nome da Empresa' },
  { grupo: 'Documento', key: 'agora', label: 'Data/Hora de Emissão' },
  { grupo: 'Documento', key: 'totalLotes', label: 'Total de Lotes' },
  { grupo: 'Leilão', key: 'dataLeilao', label: 'Data do Leilão' },
  { grupo: 'Leilão', key: 'enderecoLeilao', label: 'Local / Endereço' },
  { grupo: 'Leilão', key: 'cidadeLeilao', label: 'Cidade' },
  { grupo: 'Leilão', key: 'estadoLeilao', label: 'UF' },
  { grupo: 'Leilão', key: 'horaInicioLeilao', label: 'Hora de Início' },
  { grupo: 'Leilão', key: 'horaFechamentoPreLeilao', label: 'Hora Fechamento Pré-Leilão' },
  { grupo: 'Leilão', key: 'leiloeiro', label: 'Leiloeiro' },
  { grupo: 'Leilão', key: 'categoriaLeilao', label: 'Categoria do Leilão' },
  { grupo: 'Leilão', key: 'tipoLeilao', label: 'Tipo de Leilão' },
  { grupo: 'Leilão', key: 'transmissaoLeilao', label: 'Transmissão' },
  { grupo: 'Leilão', key: 'linkTransmissao1Leilao', label: 'Link Transmissão 1' },
  { grupo: 'Leilão', key: 'linkTransmissao2Leilao', label: 'Link Transmissão 2' },
  { grupo: 'Leilão', key: 'urlCatalogoLeilao', label: 'URL do Catálogo' },
  { grupo: 'Leilão', key: 'comissaoVendedorLeilao', label: 'Comissão Vendedor (%)' },
  { grupo: 'Leilão', key: 'comissaoCompradorLeilao', label: 'Comissão Comprador (%)' },
  { grupo: 'Leilão', key: 'qtdParcelasLeilao', label: 'Qtd. Parcelas' },
  { grupo: 'Leilão', key: 'multiploLeilao', label: 'Múltiplo' },
  { grupo: 'Leilão', key: 'dataSaldoLeilao', label: 'Data do Saldo' },
  { grupo: 'Leilão', key: 'condicaoPagamentoLeilao', label: 'Condição de Pagamento' },
  { grupo: 'Leilão', key: 'regulamentoLeilao', label: 'Regulamento' },
  { grupo: 'Leilão', key: 'observacoesLeilao', label: 'Observações do Leilão' },
];

/** Colunas padrão sugeridas ao adicionar uma nova Tabela de Lotes no editor. */
export const COLUNAS_LOTES_PADRAO: ColunaTabela[] = [
  { key: 'ordem', label: 'Ordem', largura: 12, visivel: true },
  { key: 'lotexx', label: 'Lote', largura: 12, visivel: true },
  { key: 'deslot', label: 'Descrição', largura: 36, visivel: true },
  { key: 'nomeVendedor', label: 'Vendedor', largura: 22, visivel: true },
  { key: 'nomeRaca', label: 'Raça', largura: 12, visivel: true },
  { key: 'catego', label: 'Sexo', largura: 6, visivel: true },
];

export function resolverCampoOrdemEntrada(key: string, ctx: OrdemEntradaContexto): string {
  const valor = (ctx as any)[key];
  return valor == null ? '' : String(valor);
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function interpolarTextoOrdemEntrada(texto: string, ctx: OrdemEntradaContexto): string {
  return texto.replace(PLACEHOLDER_RE, (_match, key) => resolverCampoOrdemEntrada(key, ctx));
}
