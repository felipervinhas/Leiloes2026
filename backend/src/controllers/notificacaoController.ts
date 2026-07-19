import { Request, Response } from 'express';
import * as svc from '../services/notificacaoService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarNotificacoes(req.query.busca as string));
};
export const criar = async (req: Request, res: Response) => {
  const id = await svc.criarNotificacao(req.body);
  await registrarLog((req as any).usuario, 'Inserir', 'Notificações', id);
  res.status(201).json({ id });
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarNotificacao(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Notificações', id);
  res.status(204).send();
};
export const enviar = async (req: Request, res: Response) => {
  const { titulo, mensagem, idCliente } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ error: 'titulo e mensagem são obrigatórios' });
  const result = await svc.enviarPush(titulo, mensagem, idCliente ? Number(idCliente) : undefined);
  res.json(result);
};
