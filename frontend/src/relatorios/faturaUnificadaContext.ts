import { FaturaUnificadaGrupo } from './RelatorioFaturaUnificada';
import { valorExtenso } from './promissoriaUtils';

export interface FaturaUnificadaContexto {
  titulo: string;
  empresa: string;
  agora: string;
  totalLotes: number;
  leilao: string;
  dataLeilao: string;
  compradorNome: string;
  compradorDocumento: string;
  compradorEndereco: string;
  compradorBairro: string;
  compradorCidade: string;
  compradorUf: string;
  compradorCep: string;
  compradorTelefone: string;
  compradorEmail: string;
  compradorPropriedade: string;
  vendedorNome: string;
  vendedorDocumento: string;
  vendedorEndereco: string;
  vendedorBairro: string;
  vendedorCidade: string;
  vendedorUf: string;
  vendedorCep: string;
  vendedorTelefone: string;
  vendedorEmail: string;
  totalCompra: string;
  totalAVista: string;
  totalPromissorias: string;
  totalSinal: string;
  totalComissao: string;
  totalDesconto: string;
  totalSinalExtenso: string;
  totalComissaoExtenso: string;
}

const fmtR = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

export function montarContextoFaturaUnificada(
  grupo: FaturaUnificadaGrupo,
  empresa: string | undefined,
): FaturaUnificadaContexto {
  const comp = grupo.comprador;
  const ven  = grupo.vendedor;
  return {
    titulo: 'Fatura Unificada',
    empresa: empresa || 'Leilões 2026',
    agora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    totalLotes: grupo.lotes.length,
    leilao: grupo.leilao || '—',
    dataLeilao: grupo.datlei || '—',
    compradorNome: comp.nomexx || '—',
    compradorDocumento: comp.cnpjxx ? `CNPJ: ${comp.cnpjxx}` : `CPF: ${comp.cpfxxx || 'não informado'}`,
    compradorEndereco: [comp.endere, comp.bairro].filter(Boolean).join(', ') || '—',
    compradorBairro: comp.bairro || '—',
    compradorCidade: comp.nomeCidade || '—',
    compradorUf: comp.nomeEstado || '—',
    compradorCep: comp.cepxxx || '—',
    compradorTelefone: comp.celu1 || comp.telres || comp.telcom || '—',
    compradorEmail: comp.emailx || '—',
    compradorPropriedade: comp.nomePropriedade || '—',
    vendedorNome: ven.nomexx || '—',
    vendedorDocumento: ven.cnpjxx ? `CNPJ: ${ven.cnpjxx}` : `CPF: ${ven.cpfxxx || 'não informado'}`,
    vendedorEndereco: [ven.endere, ven.bairro].filter(Boolean).join(', ') || '—',
    vendedorBairro: ven.bairro || '—',
    vendedorCidade: ven.nomeCidade || '—',
    vendedorUf: ven.nomeEstado || '—',
    vendedorCep: ven.cepxxx || '—',
    vendedorTelefone: ven.celu1 || ven.telres || '—',
    vendedorEmail: ven.emailx || '—',
    totalCompra: fmtR(grupo.totais.totalCompra),
    totalAVista: fmtR(grupo.totais.totalAVista),
    totalPromissorias: fmtR(grupo.totais.totalPromissorias),
    totalSinal: fmtR(grupo.totais.totalSinal),
    totalComissao: fmtR(grupo.totais.totalComissao),
    totalDesconto: fmtR(grupo.totais.totalDesconto),
    totalSinalExtenso: valorExtenso(grupo.totais.totalSinal),
    totalComissaoExtenso: valorExtenso(grupo.totais.totalComissao),
  };
}
