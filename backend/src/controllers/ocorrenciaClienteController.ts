import { Request, Response } from 'express';
import * as svc from '../services/ocorrenciaClienteService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarOcorrencias(Number(req.params.idCli)));
};
export const criar = async (req: Request, res: Response) => {
  const idCliente = Number(req.params.idCli);
  const id = await svc.criarOcorrencia({ ...req.body, idCliente });
  await registrarLog((req as any).usuario, 'Inserir', 'Clientes', idCliente);
  res.status(201).json({ id });
};
export const atualizar = async (req: Request, res: Response) => {
  const idCliente = Number(req.params.idCli);
  await svc.atualizarOcorrencia(Number(req.params.id), req.body);
  await registrarLog((req as any).usuario, 'Alterar', 'Clientes', idCliente);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  const idCliente = Number(req.params.idCli);
  await svc.deletarOcorrencia(Number(req.params.id));
  await registrarLog((req as any).usuario, 'Deletar', 'Clientes', idCliente);
  res.status(204).send();
};
