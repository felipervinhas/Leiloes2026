import { Request, Response } from 'express';
import * as svc from '../services/loteService';
import { registrarLog } from '../services/logService';

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
  const id = await svc.criarLote(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Lotes', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarLote(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Lotes', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarLote(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Lotes', id);
  res.status(204).send();
};
export const salvarOrdens = async (req: Request, res: Response) => {
  const { lotes } = req.body;
  if (!Array.isArray(lotes)) return res.status(400).json({ error: 'lotes deve ser um array' });
  await svc.salvarOrdensLotes(lotes);
  await registrarLog((req as any).usuario, 'Alterar', 'Ordem de Entrada', lotes.map((l: any) => l.id).join(','));
  res.json({ ok: true });
};

export const duplicar = async (req: Request, res: Response) => {
  try {
    const novoId = await svc.duplicarLote(Number(req.params.id));
    await registrarLog((req as any).usuario, 'Inserir', 'Lotes', novoId);
    res.status(201).json({ id: novoId });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};
