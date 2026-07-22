import { Request, Response } from 'express';
import * as svc from '../services/reciboService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  const { busca } = req.query;
  res.json(await svc.listarRecibos(busca as string));
};
export const criar = async (req: Request, res: Response) => {
  if (!req.body.pagador) return res.status(400).json({ error: 'Informe o pagador' });
  const id = await svc.criarRecibo(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'RecibosAvulsos', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  if (!req.body.pagador) return res.status(400).json({ error: 'Informe o pagador' });
  const id = Number(req.params.id);
  await svc.atualizarRecibo(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'RecibosAvulsos', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarRecibo(id);
  await registrarLog((req as any).usuario, 'Deletar', 'RecibosAvulsos', id);
  res.status(204).send();
};
