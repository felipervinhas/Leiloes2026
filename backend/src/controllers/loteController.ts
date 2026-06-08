import { Request, Response } from 'express';
import * as svc from '../services/loteService';

export const listar = async (req: Request, res: Response) => {
  const idLeilao = req.query.idLeilao ? Number(req.query.idLeilao) : undefined;
  res.json(await svc.listarLotes(idLeilao, req.query.busca as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarLotePorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarLote(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarLote(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarLote(Number(req.params.id));
  res.status(204).send();
};
export const duplicar = async (req: Request, res: Response) => {
  try {
    const novoId = await svc.duplicarLote(Number(req.params.id));
    res.status(201).json({ id: novoId });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};
