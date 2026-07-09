import type { PromissoriaContexto } from './promissoriaContext';
import { fmtR, fmtData, CATEGO } from './promissoriaUtils';

export type FormatoCampo = 'texto' | 'data' | 'moeda' | 'categoria';

export interface CampoDisponivel {
  key: string;   // dot-path dentro do PromissoriaContexto, ex: 'lote.nomeVendedor', 'comp.nomexx', 'calc.extenso'
  label: string;
  grupo: string;
  formato?: FormatoCampo;
}

/** Catálogo único de campos da Nota Promissória — alimenta a paleta do editor e o resolvedor de valores. */
export const PROMISSORIA_CAMPOS: CampoDisponivel[] = [
  { grupo: 'Leilão', key: 'dados.leilao', label: 'Nome do Leilão' },
  { grupo: 'Leilão', key: 'dados.datlei', label: 'Data do Leilão', formato: 'data' },
  { grupo: 'Leilão', key: 'dados.codnot', label: 'Número da Nota' },

  { grupo: 'Lote', key: 'lote.lotexx', label: 'Número do Lote' },
  { grupo: 'Lote', key: 'lote.deslot', label: 'Descrição do Lote' },
  { grupo: 'Lote', key: 'lote.descricaoRaca', label: 'Raça' },
  { grupo: 'Lote', key: 'lote.especies', label: 'Espécie' },
  { grupo: 'Lote', key: 'lote.catego', label: 'Sexo/Categoria', formato: 'categoria' },
  { grupo: 'Lote', key: 'lote.rpxxx', label: 'RP' },
  { grupo: 'Lote', key: 'lote.sbbxxx', label: 'SBB' },
  { grupo: 'Lote', key: 'lote.pesoxx', label: 'Peso (kg)' },
  { grupo: 'Lote', key: 'lote.qtdxxx', label: 'Quantidade' },
  { grupo: 'Lote', key: 'lote.pelagem', label: 'Pelagem' },
  { grupo: 'Lote', key: 'lote.datnas', label: 'Data de Nascimento', formato: 'data' },
  { grupo: 'Lote', key: 'lote.obslot', label: 'Observações do Lote' },

  { grupo: 'Vendedor', key: 'lote.nomeVendedor', label: 'Nome do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.cpfVendedor', label: 'CPF do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.endereVendedor', label: 'Endereço do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.bairroVendedor', label: 'Bairro do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.cidadeVendedor', label: 'Cidade do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.estadoVendedor', label: 'UF do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.cepVendedor', label: 'CEP do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.celularVendedor', label: 'Celular do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.telresVendedor', label: 'Telefone Res. do Vendedor' },
  { grupo: 'Vendedor', key: 'lote.emailVendedor', label: 'E-mail do Vendedor' },

  { grupo: 'Comprador', key: 'comp.nomexx', label: 'Nome do Comprador' },
  { grupo: 'Comprador', key: 'comp.cpfxxx', label: 'CPF do Comprador' },
  { grupo: 'Comprador', key: 'comp.endere', label: 'Endereço do Comprador' },
  { grupo: 'Comprador', key: 'comp.bairro', label: 'Bairro do Comprador' },
  { grupo: 'Comprador', key: 'comp.nomeCidade', label: 'Cidade do Comprador' },
  { grupo: 'Comprador', key: 'comp.nomeEstado', label: 'UF do Comprador' },
  { grupo: 'Comprador', key: 'comp.cepxxx', label: 'CEP do Comprador' },
  { grupo: 'Comprador', key: 'comp.celu1', label: 'Telefone do Comprador' },
  { grupo: 'Comprador', key: 'comp.emailx', label: 'E-mail do Comprador' },

  { grupo: 'Propriedade', key: 'comp.nomePropriedade', label: 'Nome da Propriedade' },
  { grupo: 'Propriedade', key: 'comp.cidadeProp', label: 'Cidade da Propriedade' },
  { grupo: 'Propriedade', key: 'comp.estadoProp', label: 'UF da Propriedade' },

  { grupo: 'Financeiro', key: 'comp.desfin', label: 'Condição de Pagamento' },
  { grupo: 'Financeiro', key: 'comp.valorOriginal', label: 'Valor Total', formato: 'moeda' },
  { grupo: 'Financeiro', key: 'comp.comissao', label: 'Comissão do Leiloeiro (%)' },
  { grupo: 'Financeiro', key: 'comp.valorComissao', label: 'Valor da Comissão', formato: 'moeda' },
  { grupo: 'Financeiro', key: 'comp.valorDesconto', label: 'Desconto', formato: 'moeda' },
  { grupo: 'Financeiro', key: 'comp.valorPagar', label: 'Valor Líquido', formato: 'moeda' },
  { grupo: 'Financeiro', key: 'comp.percen', label: '% do Lote' },
  { grupo: 'Financeiro', key: 'comp.formaPagamento', label: 'Forma de Pagamento' },

  { grupo: 'Comissão Vendedor', key: 'comp.comissaoVendedor', label: 'Comissão do Vendedor (%)' },
  { grupo: 'Comissão Vendedor', key: 'comp.valorComissaoVendedor', label: 'Valor da Comissão do Vendedor', formato: 'moeda' },

  { grupo: 'Calculados', key: 'calc.totalValor', label: 'Valor Total da Promissória', formato: 'moeda' },
  { grupo: 'Calculados', key: 'calc.totalParcelas', label: 'Soma das Parcelas', formato: 'moeda' },
  { grupo: 'Calculados', key: 'calc.extenso', label: 'Valor por Extenso' },
  { grupo: 'Calculados', key: 'calc.dataExtenso', label: 'Data por Extenso' },
  { grupo: 'Calculados', key: 'calc.praca', label: 'Praça (Cidade/UF Vendedor)' },
  { grupo: 'Calculados', key: 'calc.localEmissao', label: 'Local de Emissão' },
  { grupo: 'Calculados', key: 'calc.credor', label: 'Credor' },
  { grupo: 'Calculados', key: 'calc.cpfCredor', label: 'CPF do Credor' },
  { grupo: 'Calculados', key: 'calc.endereVend', label: 'Endereço do Vendedor (completo)' },
  { grupo: 'Calculados', key: 'calc.agora', label: 'Data/Hora de Emissão' },
  { grupo: 'Calculados', key: 'calc.nomeEmpresa', label: 'Nome da Empresa' },
];

function lookup(key: string, ctx: PromissoriaContexto): any {
  return key.split('.').reduce<any>((val, part) => val?.[part], ctx);
}

/** Resolve o valor de um campo do catálogo para exibição, aplicando o formato definido. */
export function resolverCampo(key: string, ctx: PromissoriaContexto): string {
  const valor = lookup(key, ctx);
  if (valor == null || valor === '') return '';
  const def = PROMISSORIA_CAMPOS.find(c => c.key === key);
  switch (def?.formato) {
    case 'moeda': return fmtR(Number(valor));
    case 'data': return fmtData(String(valor));
    case 'categoria': return CATEGO[String(valor)] || String(valor);
    default: return String(valor);
  }
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Substitui placeholders {{grupo.campo}} de um texto livre pelos valores resolvidos do contexto. */
export function interpolarTexto(texto: string, ctx: PromissoriaContexto): string {
  return texto.replace(PLACEHOLDER_RE, (_match, key) => resolverCampo(key, ctx));
}
