import type { FichaClienteContexto } from './fichaClienteContext';
import type { CampoDisponivel } from './promissoriaCampos';
import type { ColunaTabela } from './tipoLayout';

export interface PropriedadeFichaPDF {
  id: number;
  nomePropriedade?: string;
  inscricao?: string;
  codigoPropriedade?: string;
  cidade?: string;
  estado?: string;
  localidade?: string;
}

/** Catálogo de campos de "documento" (fora da tabela de propriedades) da Ficha de Cliente. */
export const FICHA_CLIENTE_CAMPOS: CampoDisponivel[] = [
  { grupo: 'Documento', key: 'titulo', label: 'Título do Documento' },
  { grupo: 'Documento', key: 'empresa', label: 'Nome da Empresa' },
  { grupo: 'Documento', key: 'agora', label: 'Data/Hora de Emissão' },
  { grupo: 'Documento', key: 'totalPropriedades', label: 'Total de Propriedades' },
  { grupo: 'Cliente', key: 'nome', label: 'Nome' },
  { grupo: 'Cliente', key: 'cpf', label: 'CPF' },
  { grupo: 'Cliente', key: 'cnpj', label: 'CNPJ' },
  { grupo: 'Cliente', key: 'rg', label: 'RG' },
  { grupo: 'Cliente', key: 'nascimento', label: 'Data de Nascimento' },
  { grupo: 'Cliente', key: 'estadoCivil', label: 'Estado Civil' },
  { grupo: 'Cliente', key: 'profissao', label: 'Profissão' },
  { grupo: 'Endereço', key: 'endereco', label: 'Endereço' },
  { grupo: 'Endereço', key: 'bairro', label: 'Bairro' },
  { grupo: 'Endereço', key: 'cidade', label: 'Cidade' },
  { grupo: 'Endereço', key: 'uf', label: 'UF' },
  { grupo: 'Endereço', key: 'cep', label: 'CEP' },
  { grupo: 'Contato', key: 'telefoneResidencial', label: 'Telefone Residencial' },
  { grupo: 'Contato', key: 'telefoneComercial', label: 'Telefone Comercial' },
  { grupo: 'Contato', key: 'celular1', label: 'Celular 1' },
  { grupo: 'Contato', key: 'celular2', label: 'Celular 2' },
  { grupo: 'Contato', key: 'email', label: 'E-mail' },
  { grupo: 'Contato', key: 'email2', label: 'E-mail 2' },
  { grupo: 'Outros', key: 'observacoes', label: 'Observações' },
  { grupo: 'Outros', key: 'dataCadastro', label: 'Data de Cadastro' },
];

/** Colunas padrão sugeridas ao adicionar uma nova Tabela de Propriedades no editor. */
export const COLUNAS_PROPRIEDADES_PADRAO: ColunaTabela[] = [
  { key: 'nomePropriedade', label: 'Propriedade', largura: 30, visivel: true },
  { key: 'inscricao', label: 'IE', largura: 16, visivel: true },
  { key: 'cidade', label: 'Cidade', largura: 24, visivel: true },
  { key: 'estado', label: 'UF', largura: 8, visivel: true },
  { key: 'localidade', label: 'Localidade', largura: 32, visivel: true },
];

export function resolverCampoFichaCliente(key: string, ctx: FichaClienteContexto): string {
  const valor = (ctx as any)[key];
  return valor == null ? '' : String(valor);
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function interpolarTextoFichaCliente(texto: string, ctx: FichaClienteContexto): string {
  return texto.replace(PLACEHOLDER_RE, (_match, key) => resolverCampoFichaCliente(key, ctx));
}
