import { Request, Response } from 'express';
import * as svc from '../services/despesaService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  const { idLeilao, busca, idCliente } = req.query;
  res.json(await svc.listarDespesas(
    idLeilao ? Number(idLeilao) : undefined,
    busca as string,
    idCliente ? Number(idCliente) : undefined,
  ));
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarDespesa(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Despesas', id);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.atualizarDespesa(id, req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Despesas', id);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarDespesa(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Despesas', id);
  res.status(204).send();
};
