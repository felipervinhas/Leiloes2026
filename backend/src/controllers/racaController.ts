import { Request, Response } from 'express';
import * as svc from '../services/racaService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarRacas(req.query.busca as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarRacaPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarRaca(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarRaca(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarRaca(Number(req.params.id));
  res.status(204).send();
};
