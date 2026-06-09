import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { buscarUsuarioPorLogin } from '../services/authService';

export async function login(req: Request, res: Response) {
  const { cpf, senha } = req.body;

  if (!cpf || !senha) {
    return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
  }

  const usuario = await buscarUsuarioPorLogin(cpf, senha);

  if (!usuario) {
    return res.status(401).json({ error: 'CPF, senha inválidos ou usuário sem acesso' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, perfis: usuario.perfis, controles: usuario.controles },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfis: usuario.perfis,
      controles: usuario.controles,
    },
  });
}

export async function me(req: Request, res: Response) {
  return res.json({ usuario: (req as any).usuario });
}
