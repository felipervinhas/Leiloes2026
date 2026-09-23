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
  adm?: string;
  perfis: Perfil[];
  controles: string[];
  /** Só na Macedo: 'W' (pisteiro, acesso web) ou 'I' (interno). null/ausente nos demais bancos. */
  tipoSecao?: 'I' | 'W' | null;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
