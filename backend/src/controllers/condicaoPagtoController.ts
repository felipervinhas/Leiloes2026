import { Request, Response } from 'express';
import * as svc from '../services/condicaoPagtoService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarCondicoes(req.query.busca as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarCondicaoPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarCondicao(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Condições de Pagamento', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarCondicao(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Condições de Pagamento', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarCondicao(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Condições de Pagamento', id);
  res.status(204).send();
};
