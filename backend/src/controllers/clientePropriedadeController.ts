import { Request, Response } from 'express';
import * as svc from '../services/clientePropriedadeService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarPropriedades(Number(req.params.idCli)));
};
export const criar = async (req: Request, res: Response) => {
  const idCliente = Number(req.params.idCli);
  res.status(201).json({ id: await svc.criarPropriedade({ ...req.body, idCliente }) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarPropriedade(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarPropriedade(Number(req.params.id));
  res.status(204).send();
};
