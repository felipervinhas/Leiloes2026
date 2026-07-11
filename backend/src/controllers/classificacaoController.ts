import { Request, Response } from 'express';
import * as svc from '../services/classificacaoService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarClassificacoes(req.query.busca as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarClassificacaoPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarClassificacao(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarClassificacao(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarClassificacao(Number(req.params.id));
  res.status(204).send();
};
