import { Request, Response } from 'express';
import * as svc from '../services/cidadeService';

export const listar = async (req: Request, res: Response) => {
  const data = await svc.listarCidades(req.query.busca as string);
  res.json(data);
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarCidadePorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarCidade(req.body);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarCidade(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarCidade(Number(req.params.id));
  res.status(204).send();
};
