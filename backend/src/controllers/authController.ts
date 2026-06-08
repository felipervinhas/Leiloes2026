import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { buscarUsuarioPorLogin } from '../services/authService';

export async function login(req: Request, res: Response) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const usuario = await buscarUsuarioPorLogin(email, senha);

  if (!usuario) {
    return res.status(401).json({ error: 'Email, senha inválidos ou usuário sem acesso' });
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
