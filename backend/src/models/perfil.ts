export interface Perfil {
  id: number;
  perfil: string;
  inserir?: string;
  alterar?: string;
  deletar?: string;
}

export interface ClientePerfil {
  id: number;
  idPerfil: number;
  idCliente: number;
  controle?: string;
  dataCadastro?: Date;
}
