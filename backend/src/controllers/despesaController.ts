import { Request, Response } from 'express';
import * as svc from '../services/despesaService';

export const listar = async (req: Request, res: Response) => {
  const { idLeilao, busca } = req.query;
  res.json(await svc.listarDespesas(idLeilao ? Number(idLeilao) : undefined, busca as string));
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarDespesa(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarDespesa(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarDespesa(Number(req.params.id));
  res.status(204).send();
};
