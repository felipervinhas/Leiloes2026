export interface Usuario {
  id: number;
  nome: string;
  email: string;
  ativo: string;
  bloqueado: string | null;
  adm: string;
}

export interface Perfil {
  id: number;
  perfil: string;
  inserir: string;
  alterar: string;
  deletar: string;
}

export interface UsuarioComPerfil extends Usuario {
  perfis: Perfil[];
  controles: string[];
}

export interface LoginPayload {
  email: string;
  senha: string;
}
