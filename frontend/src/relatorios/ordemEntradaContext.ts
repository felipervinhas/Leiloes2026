export interface OrdemEntradaContexto {
  titulo: string;
  empresa: string;
  agora: string;
  totalLotes: number;
  dataLeilao: string;
  enderecoLeilao: string;
  cidadeLeilao: string;
  estadoLeilao: string;
  horaInicioLeilao: string;
  horaFechamentoPreLeilao: string;
  leiloeiro: string;
  categoriaLeilao: string;
  tipoLeilao: string;
  transmissaoLeilao: string;
  linkTransmissao1Leilao: string;
  linkTransmissao2Leilao: string;
  urlCatalogoLeilao: string;
  comissaoVendedorLeilao: string;
  comissaoCompradorLeilao: string;
  qtdParcelasLeilao: string;
  multiploLeilao: string;
  dataSaldoLeilao: string;
  condicaoPagamentoLeilao: string;
  regulamentoLeilao: string;
  observacoesLeilao: string;
}

interface LoteComDadosLeilao {
  dataLeilao?: string | Date;
  enderecoLeilao?: string;
  cidadeLeilao?: string;
  estadoLeilao?: string;
  horaInicioLeilao?: string;
  horaFechamentoPreLeilao?: string;
  leiloeiro?: string;
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
  dataSaldoLeilao?: string | Date;
  condicaoPagamentoLeilao?: string;
  regulamentoLeilao?: string;
  observacoesLeilao?: string;
}

function dataBr(v?: string | Date): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function numOuTraco(v?: number): string {
  return v == null ? '—' : String(v);
}

export function montarContextoOrdemEntrada(
  titulo: string | undefined,
  empresa: string | undefined,
  lotes: LoteComDadosLeilao[],
): OrdemEntradaContexto {
  const primeiro = lotes[0];
  return {
    titulo: titulo || '—',
    empresa: empresa || 'Leilões 2026',
    agora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    totalLotes: lotes.length,
    dataLeilao: dataBr(primeiro?.dataLeilao),
    enderecoLeilao: primeiro?.enderecoLeilao || '—',
    cidadeLeilao: primeiro?.cidadeLeilao || '—',
    estadoLeilao: primeiro?.estadoLeilao || '—',
    horaInicioLeilao: primeiro?.horaInicioLeilao || '—',
    horaFechamentoPreLeilao: primeiro?.horaFechamentoPreLeilao || '—',
    leiloeiro: primeiro?.leiloeiro || '—',
    categoriaLeilao: primeiro?.categoriaLeilao || '—',
    tipoLeilao: primeiro?.tipoLeilao || '—',
    transmissaoLeilao: primeiro?.transmissaoLeilao || '—',
    linkTransmissao1Leilao: primeiro?.linkTransmissao1Leilao || '—',
    linkTransmissao2Leilao: primeiro?.linkTransmissao2Leilao || '—',
    urlCatalogoLeilao: primeiro?.urlCatalogoLeilao || '—',
    comissaoVendedorLeilao: numOuTraco(primeiro?.comissaoVendedorLeilao),
    comissaoCompradorLeilao: numOuTraco(primeiro?.comissaoCompradorLeilao),
    qtdParcelasLeilao: numOuTraco(primeiro?.qtdParcelasLeilao),
    multiploLeilao: numOuTraco(primeiro?.multiploLeilao),
    dataSaldoLeilao: dataBr(primeiro?.dataSaldoLeilao),
    condicaoPagamentoLeilao: primeiro?.condicaoPagamentoLeilao || '—',
    regulamentoLeilao: primeiro?.regulamentoLeilao || '—',
    observacoesLeilao: primeiro?.observacoesLeilao || '—',
  };
}
