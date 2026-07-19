import { Request, Response } from 'express';
import * as svc from '../services/leilaoService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarLeiloes(req.query.busca as string, req.query.ativo as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarLeilaoPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarLeilao(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Leilões', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarLeilao(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Leilões', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarLeilao(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Leilões', id);
  res.status(204).send();
};
