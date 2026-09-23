import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { buscarUsuarioPorLogin } from '../services/authService';
import { tipoSecaoDoUsuario } from '../services/secaoAcessoService';

export async function login(req: Request, res: Response) {
  const { cpf, senha } = req.body;

  if (!cpf || !senha) {
    return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
  }

  const usuario = await buscarUsuarioPorLogin(cpf, senha);

  if (!usuario) {
    return res.status(401).json({ error: 'CPF, senha inválidos ou usuário sem acesso' });
  }

  // Só na Macedo: 'W' (pisteiro) ou 'I' (demais). Nos outros bancos fica null.
  const tipoSecao = await tipoSecaoDoUsuario(usuario.id);

  const token = jwt.sign(
    { 
      id: usuario.id, 
      nome: usuario.nome, 
      email: usuario.email, 
      adm: usuario.adm,
      perfis: usuario.perfis, 
      controles: usuario.controles,
      tipoSecao,
    },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '4h') as any }
  );

  return res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      adm: usuario.adm,
      perfis: usuario.perfis,
      controles: usuario.controles,
      tipoSecao,
    },
  });
}

export async function me(req: Request, res: Response) {
  return res.json({ usuario: (req as any).usuario });
}
