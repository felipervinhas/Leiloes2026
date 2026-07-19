import { Request, Response } from 'express';
import * as svc from '../services/racaService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarRacas(req.query.busca as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarRacaPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarRaca(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Raças', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarRaca(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Raças', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarRaca(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Raças', id);
  res.status(204).send();
};
