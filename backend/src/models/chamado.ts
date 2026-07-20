export type TipoChamado = 'Erro' | 'Melhoria';
export type StatusChamado = 'Pendente' | 'Em Andamento' | 'Concluído' | 'Recusado';

export interface Chamado {
  id: number;
  tipo: TipoChamado;
  titulo: string;
  descricao: string;
  status: StatusChamado;
  idUsuario?: number;
  nomeUsuario?: string;
  imagemKey?: string;
  imagemUrl?: string;
  resposta?: string;
  datcri: string;
  datresp?: string;
}
