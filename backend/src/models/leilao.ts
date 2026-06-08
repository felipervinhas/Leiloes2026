export interface Leilao {
  id: number;
  leilao: string;
  endere?: string;
  codcid?: string;
  datlei?: Date | string;
  leiloe?: string;
  condic?: number;
  qtdpar?: number;
  comven?: number;
  comcom?: number;
  ativox?: string;
  urlcatalogo?: string;
  linktransmissao1?: string;
  linktransmissao2?: string;
  tipoLeilao?: string;
  transmissao?: string;
  horaInicio?: string;
  horaFechamentoPre?: string;
  regulamento?: string;
  multiplo?: number;
  observacoes?: string;
  tipo?: string;
  dataSaldo?: Date | string;
  nomeCidade?: string;
  nomeEstado?: string;
  descricaoCondicao?: string;
}
