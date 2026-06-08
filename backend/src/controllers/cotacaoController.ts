import { Request, Response } from 'express';
import * as svc from '../services/cotacaoService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarCotacoes(req.query.busca as string));
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarCotacao(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarCotacao(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarCotacao(Number(req.params.id));
  res.status(204).send();
};
