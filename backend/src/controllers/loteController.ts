import { Request, Response } from 'express';
import * as svc from '../services/loteService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  const idLeilao = req.query.idLeilao ? Number(req.query.idLeilao) : undefined;
  const busca = req.query.busca as string;
  // page só é enviado pela tela de Lotes (que navega a base toda, ~17 mil
  // registros); as demais telas sempre filtram por idLeilao e continuam
  // recebendo o array simples de antes.
  if (req.query.page) {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 15;
    res.json(await svc.listarLotesPaginado(idLeilao, busca, page, pageSize));
  } else {
    res.json(await svc.listarLotes(idLeilao, busca));
  }
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
export const atualizarStatus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { vendido, publica } = req.body;
  await svc.atualizarStatusLote(id, { vendido, publica });
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
