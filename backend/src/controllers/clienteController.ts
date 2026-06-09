import { Request, Response } from 'express';
import * as svc from '../services/clienteService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarClientes(req.query.busca as string, req.query.filtro as string));
};
export const listarFaturamento = async (req: Request, res: Response) => {
  res.json(await svc.listarClientesFaturamento(req.query.busca as string, req.query.filtro as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarClientePorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarCliente(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarCliente(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarCliente(Number(req.params.id));
  res.status(204).send();
};
export const alterarSenha = async (req: Request, res: Response) => {
  await svc.alterarSenhaCliente(Number(req.params.id), req.body.senhax);
  res.json({ ok: true });
};
export const listarPendentes = async (_req: Request, res: Response) => {
  res.json(await svc.listarClientesPendentes());
};
export const contarPendentes = async (_req: Request, res: Response) => {
  res.json({ total: await svc.contarClientesPendentes() });
};
export const aprovar = async (req: Request, res: Response) => {
  await svc.aprovarCliente(Number(req.params.id));
  res.json({ ok: true });
};
export const recusar = async (req: Request, res: Response) => {
  await svc.recusarCliente(Number(req.params.id));
  res.json({ ok: true });
};
