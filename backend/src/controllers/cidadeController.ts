import { Request, Response } from 'express';
import * as svc from '../services/cidadeService';
import { registrarLog } from '../services/logService';

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
  await registrarLog((req as any).usuario, 'Inserir', 'Cidades', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarCidade(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Cidades', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarCidade(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Cidades', id);
  res.status(204).send();
};
