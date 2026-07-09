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
}

/** Catálogo de campos de "documento" (fora da tabela de lotes) da Ordem de Entrada. */
export const ORDEM_ENTRADA_CAMPOS: CampoDisponivel[] = [
  { grupo: 'Documento', key: 'titulo', label: 'Título / Leilão' },
  { grupo: 'Documento', key: 'empresa', label: 'Nome da Empresa' },
  { grupo: 'Documento', key: 'agora', label: 'Data/Hora de Emissão' },
  { grupo: 'Documento', key: 'totalLotes', label: 'Total de Lotes' },
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
