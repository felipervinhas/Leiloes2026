import { FaturaData, fmtFidelidade } from './RelatorioFaturaCompra';
import { valorExtenso, fmtDataExtenso } from './promissoriaUtils';

export interface PromissoriaCalc {
  totalParcelas: number;
  totalValor: number;
  extenso: string;
  dataExtenso: string;
  praca: string;
  localEmissao: string;
  credor: string;
  cpfCredor?: string;
  endereVend: string;
  agora: string;
  nomeEmpresa: string;
  fidelidade?: string;
}

export interface PromissoriaContexto {
  dados: FaturaData;
  lote?: FaturaData['lote'];
  comp: FaturaData['compradores'][number];
  calc: PromissoriaCalc;
}

/** Contexto de dados de uma página da Nota Promissória (um comprador). */
export function montarContextoPromissoria(
  dados: FaturaData,
  comp: FaturaData['compradores'][number],
  empresa?: string,
): PromissoriaContexto {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const totalParcelas = comp.parcelas.reduce((a, p) => a + (p.vlrpar ?? 0), 0);
  const totalValor    = comp.valorPagar ?? totalParcelas;
  const extenso       = valorExtenso(totalValor).toUpperCase();
  const credor        = dados.lote?.nomeVendedor || nomeEmpresa;
  const cpfCredor     = dados.lote?.cpfVendedor;

  const endereVend = [
    dados.lote?.endereVendedor,
    dados.lote?.bairroVendedor,
    dados.lote?.cidadeVendedor,
    dados.lote?.estadoVendedor,
  ].filter(Boolean).join(', ');

  const dataExtenso = fmtDataExtenso(dados.datlei || dados.datlan);
  // Praça de pagamento (na frase da nota) é a cidade/estado do vendedor
  // (credor) — é lá que o título é exigível. Já o "Local + Data" da
  // assinatura (localEmissao) é onde o documento é de fato assinado/emitido:
  // o leilão, não a cidade pessoal do vendedor.
  const praca = [
    dados.lote?.cidadeVendedor?.toUpperCase(),
    dados.lote?.estadoVendedor?.toUpperCase(),
  ].filter(Boolean).join('/') || '___';
  const localEmissao = dados.cidadeLeilao?.toUpperCase() || '___';
  const fidelidade = fmtFidelidade(comp.tipoDescontoFidelidade, comp.descontoFidelidade) || undefined;

  return {
    dados,
    lote: dados.lote,
    comp,
    calc: {
      totalParcelas, totalValor, extenso, dataExtenso, praca, localEmissao,
      credor, cpfCredor, endereVend, agora, nomeEmpresa, fidelidade,
    },
  };
}
