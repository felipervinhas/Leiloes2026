import type { FaturaUnificadaContexto } from './faturaUnificadaContext';
import type { CampoDisponivel } from './promissoriaCampos';
import type { ColunaTabela } from './tipoLayout';

export const FATURA_UNIFICADA_CAMPOS: CampoDisponivel[] = [
  { grupo: 'Documento', key: 'titulo', label: 'Título do Documento' },
  { grupo: 'Documento', key: 'empresa', label: 'Nome da Empresa' },
  { grupo: 'Documento', key: 'agora', label: 'Data/Hora de Emissão' },
  { grupo: 'Documento', key: 'totalLotes', label: 'Total de Lotes' },
  { grupo: 'Leilão', key: 'leilao', label: 'Nome do Leilão' },
  { grupo: 'Leilão', key: 'dataLeilao', label: 'Data do Leilão' },
  { grupo: 'Comprador', key: 'compradorNome', label: 'Nome' },
  { grupo: 'Comprador', key: 'compradorDocumento', label: 'CPF/CNPJ' },
  { grupo: 'Comprador', key: 'compradorEndereco', label: 'Endereço' },
  { grupo: 'Comprador', key: 'compradorBairro', label: 'Bairro' },
  { grupo: 'Comprador', key: 'compradorCidade', label: 'Cidade' },
  { grupo: 'Comprador', key: 'compradorUf', label: 'UF' },
  { grupo: 'Comprador', key: 'compradorCep', label: 'CEP' },
  { grupo: 'Comprador', key: 'compradorTelefone', label: 'Telefone' },
  { grupo: 'Comprador', key: 'compradorEmail', label: 'E-mail' },
  { grupo: 'Comprador', key: 'compradorPropriedade', label: 'Propriedade' },
  { grupo: 'Vendedor', key: 'vendedorNome', label: 'Nome' },
  { grupo: 'Vendedor', key: 'vendedorDocumento', label: 'CPF/CNPJ' },
  { grupo: 'Vendedor', key: 'vendedorEndereco', label: 'Endereço' },
  { grupo: 'Vendedor', key: 'vendedorBairro', label: 'Bairro' },
  { grupo: 'Vendedor', key: 'vendedorCidade', label: 'Cidade' },
  { grupo: 'Vendedor', key: 'vendedorUf', label: 'UF' },
  { grupo: 'Vendedor', key: 'vendedorCep', label: 'CEP' },
  { grupo: 'Vendedor', key: 'vendedorTelefone', label: 'Telefone' },
  { grupo: 'Vendedor', key: 'vendedorEmail', label: 'E-mail' },
  { grupo: 'Totais', key: 'totalCompra', label: 'Total da Compra' },
  { grupo: 'Totais', key: 'totalAVista', label: 'Total Pagto. à Vista' },
  { grupo: 'Totais', key: 'totalPromissorias', label: 'Total em Promissórias' },
  { grupo: 'Totais', key: 'totalSinal', label: 'Total do Sinal / 1ª Parcela(s)' },
  { grupo: 'Totais', key: 'totalComissao', label: 'Total da Comissão' },
  { grupo: 'Totais', key: 'totalDesconto', label: 'Total Desconto p/ Pagto. à Vista' },
  { grupo: 'Totais', key: 'totalSinalExtenso', label: 'Total do Sinal (por extenso)' },
  { grupo: 'Totais', key: 'totalComissaoExtenso', label: 'Total da Comissão (por extenso)' },
];

/** Colunas padrão sugeridas ao adicionar uma nova Tabela de Lotes (Fatura Unificada) no editor.
 * `nomeContraparte`/`documentoContraparte` só têm dado nos modos 'vendedor' (mostra o
 * comprador de cada lote) e 'comprador' (mostra o vendedor) — por isso começam ocultas,
 * o usuário liga pelo Switch no editor quando for montar um layout para esses modos. */
export const COLUNAS_LOTES_FATURA_PADRAO: ColunaTabela[] = [
  { key: 'lotexx', label: 'Lote', largura: 10, visivel: true },
  { key: 'deslot', label: 'Descrição', largura: 34, visivel: true },
  { key: 'desfin', label: 'Cond. Pagamento', largura: 22, visivel: true },
  { key: 'valorOriginal', label: 'Vlr. Bruto', largura: 12, visivel: true },
  { key: 'valorPagar', label: 'Vlr. Líquido', largura: 12, visivel: true },
  { key: 'sinal', label: 'Sinal/1ª Parc.', largura: 14, visivel: true },
  { key: 'nomeContraparte', label: 'Comprador/Vendedor', largura: 24, visivel: false },
  { key: 'documentoContraparte', label: 'CPF/CNPJ Comprador/Vendedor', largura: 20, visivel: false },
];

export function resolverCampoFaturaUnificada(key: string, ctx: FaturaUnificadaContexto): string {
  const valor = (ctx as any)[key];
  return valor == null ? '' : String(valor);
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function interpolarTextoFaturaUnificada(texto: string, ctx: FaturaUnificadaContexto): string {
  return texto.replace(PLACEHOLDER_RE, (_match, key) => resolverCampoFaturaUnificada(key, ctx));
}
