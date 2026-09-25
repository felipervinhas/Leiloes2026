import { FaturaData, fmtFidelidade } from './RelatorioFaturaCompra';
import { valorExtenso, fmtDataExtenso } from './promissoriaUtils';
import { fmtDocumento } from '../utils/documento';

export interface PromissoriaCalc {
  totalParcelas: number;
  totalValor: number;
  extenso: string;
  dataExtenso: string;
  praca: string;
  localEmissao: string;
  credor: string;
  cpfCredor?: string;
  /** "CNPJ 00.000.000/0001-00" ou "CPF 000.000.000-00" do credor (vendedor) — vazio se não tiver nenhum */
  documentoCredor?: string;
  /** CPF/CNPJ do comprador e do vendedor com o rótulo ("CNPJ: ...") */
  documentoComprador: string;
  documentoVendedor: string;
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
  const documentoVendedor  = fmtDocumento(dados.lote?.cpfVendedor, dados.lote?.cnpjVendedor);
  const documentoComprador = fmtDocumento(comp.cpfxxx, comp.cnpjxx);
  const documentoCredor = (dados.lote?.cnpjVendedor || dados.lote?.cpfVendedor)
    ? documentoVendedor.replace(': ', ' ') : undefined;

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
      credor, cpfCredor, documentoCredor, documentoComprador, documentoVendedor, endereVend, agora, nomeEmpresa, fidelidade,
    },
  };
}
