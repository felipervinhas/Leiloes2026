import { Request, Response } from 'express';
import * as svc from '../services/cotacaoService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarCotacoes(req.query.busca as string));
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarCotacao(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Cotações', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarCotacao(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Cotações', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarCotacao(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Cotações', id);
  res.status(204).send();
};
