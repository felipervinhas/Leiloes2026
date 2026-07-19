import { Request, Response } from 'express';
import * as svc from '../services/perfilService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarPerfis());
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarPerfilPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarPerfil(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Perfis', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarPerfil(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Perfis', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarPerfil(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Perfis', id);
  res.status(204).send();
};
