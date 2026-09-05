export interface Lote {
  id: number;
  lotexx: string;
  deslot?: string;
  rpxxx?: string;
  sbbxxx?: string;
  pesoxx?: number;
  tatxxx?: string;
  racaxx?: number;
  idleilao?: number;
  codven?: number;
  ordem?: string;
  catego: string;
  vlrins?: number;
  pelage?: string;
  datnas?: Date | string;
  obslot?: string;
  filiacao?: string;
  lanmax?: number;
  urlvideo?: string;
  comentario?: string;
  multiplo?: number;
  vendido?: string;
  publica?: string;
  qtdAnimais?: number;
  tipoSecao?: string;
  condic?: number;
  // Comissão própria do lote (%) — sobrepõe a do leilão quando preenchida.
  // Usado principalmente em leilões "Vendas Diretas", onde não há uma taxa
  // única pro leilão inteiro: cada lote negocia a sua.
  comcom?: number | null;
  comven?: number | null;
  nomeRaca?: string;
  nomeVendedor?: string;
  estabelecimento?: string;
  nomeLeilao?: string;
  dataLeilao?: Date | string;
  enderecoLeilao?: string;
  horaInicioLeilao?: string;
  leiloeiro?: string;
  horaFechamentoPreLeilao?: string;
  regulamentoLeilao?: string;
  observacoesLeilao?: string;
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
  dataSaldoLeilao?: Date | string;
  cidadeLeilao?: string;
  estadoLeilao?: string;
  condicaoPagamentoLeilao?: string;
  imgLote1?: string;
}
