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
  const nomesContrapartes = grupo.contrapartes.map(p => p.nomexx || '—').join(', ') || '—';
  return {
    titulo: 'Fatura Unificada',
    empresa: empresa || 'Leilões 2026',
    agora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    totalLotes: grupo.lotes.length,
    leilao: grupo.leilao || '—',
    dataLeilao: grupo.datlei || '—',
    compradorNome: comp ? (comp.nomexx || '—') : `Vários compradores (${grupo.contrapartes.length}): ${nomesContrapartes}`,
    compradorDocumento: comp ? (comp.cnpjxx ? `CNPJ: ${comp.cnpjxx}` : `CPF: ${comp.cpfxxx || 'não informado'}`) : '—',
    compradorEndereco: comp ? ([comp.endere, comp.bairro].filter(Boolean).join(', ') || '—') : '—',
    compradorBairro: comp ? (comp.bairro || '—') : '—',
    compradorCidade: comp ? (comp.nomeCidade || '—') : '—',
    compradorUf: comp ? (comp.nomeEstado || '—') : '—',
    compradorCep: comp ? (comp.cepxxx || '—') : '—',
    compradorTelefone: comp ? (comp.celu1 || comp.telres || comp.telcom || '—') : '—',
    compradorEmail: comp ? (comp.emailx || '—') : '—',
    compradorPropriedade: comp ? (comp.nomePropriedade || '—') : '—',
    vendedorNome: ven ? (ven.nomexx || '—') : `Vários vendedores (${grupo.contrapartes.length}): ${nomesContrapartes}`,
    vendedorDocumento: ven ? (ven.cnpjxx ? `CNPJ: ${ven.cnpjxx}` : `CPF: ${ven.cpfxxx || 'não informado'}`) : '—',
    vendedorEndereco: ven ? ([ven.endere, ven.bairro].filter(Boolean).join(', ') || '—') : '—',
    vendedorBairro: ven ? (ven.bairro || '—') : '—',
    vendedorCidade: ven ? (ven.nomeCidade || '—') : '—',
    vendedorUf: ven ? (ven.nomeEstado || '—') : '—',
    vendedorCep: ven ? (ven.cepxxx || '—') : '—',
    vendedorTelefone: ven ? (ven.celu1 || ven.telres || '—') : '—',
    vendedorEmail: ven ? (ven.emailx || '—') : '—',
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
