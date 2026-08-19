import { fmtDataUTC } from '../utils/data';

export interface ClienteFichaPDF {
  id: number;
  nomexx?: string;
  cpfxxx?: string;
  cnpjxx?: string;
  rgxxxx?: string;
  endere?: string;
  bairro?: string;
  nomeCidade?: string;
  nomeEstado?: string;
  cepxxx?: string;
  telres?: string;
  telcom?: string;
  celu1?: string;
  celu2?: string;
  emailx?: string;
  email2?: string;
  estciv?: string;
  profiss?: string;
  obsxxx?: string;
  datnas?: string;
  datcad?: string;
}

export interface FichaClienteContexto {
  titulo: string;
  empresa: string;
  agora: string;
  nome: string;
  cpf: string;
  cnpj: string;
  rg: string;
  nascimento: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefoneResidencial: string;
  telefoneComercial: string;
  celular1: string;
  celular2: string;
  email: string;
  email2: string;
  estadoCivil: string;
  profissao: string;
  observacoes: string;
  dataCadastro: string;
  totalPropriedades: number;
}

function dataBr(v?: string): string {
  return v ? fmtDataUTC(v) : '—';
}

export function montarContextoFichaCliente(
  cliente: ClienteFichaPDF,
  empresa: string | undefined,
  totalPropriedades: number,
): FichaClienteContexto {
  return {
    titulo: 'Ficha de Cliente',
    empresa: empresa || 'Leilões 2026',
    agora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    nome: cliente.nomexx || '—',
    cpf: cliente.cpfxxx || '—',
    cnpj: cliente.cnpjxx || '—',
    rg: cliente.rgxxxx || '—',
    nascimento: dataBr(cliente.datnas),
    endereco: cliente.endere || '—',
    bairro: cliente.bairro || '—',
    cidade: cliente.nomeCidade || '—',
    uf: cliente.nomeEstado || '—',
    cep: cliente.cepxxx || '—',
    telefoneResidencial: cliente.telres || '—',
    telefoneComercial: cliente.telcom || '—',
    celular1: cliente.celu1 || '—',
    celular2: cliente.celu2 || '—',
    email: cliente.emailx || '—',
    email2: cliente.email2 || '—',
    estadoCivil: cliente.estciv || '—',
    profissao: cliente.profiss || '—',
    observacoes: cliente.obsxxx || '—',
    dataCadastro: dataBr(cliente.datcad),
    totalPropriedades,
  };
}
