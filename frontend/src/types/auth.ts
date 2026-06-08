export interface Perfil {
  id: number;
  perfil: string;
  inserir: string;
  alterar: string;
  deletar: string;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfis: Perfil[];
  controles: string[];
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
