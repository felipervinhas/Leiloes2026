import { Request, Response } from 'express';
import * as svc from '../services/perfilService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarPerfis());
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarPerfilPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarPerfil(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarPerfil(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarPerfil(Number(req.params.id));
  res.status(204).send();
};
