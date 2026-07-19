import { Request, Response } from 'express';
import * as svc from '../services/classificacaoService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarClassificacoes(req.query.busca as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarClassificacaoPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarClassificacao(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Classificações', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarClassificacao(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Classificações', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarClassificacao(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Classificações', id);
  res.status(204).send();
};
