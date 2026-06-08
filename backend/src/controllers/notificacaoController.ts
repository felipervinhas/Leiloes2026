import { Request, Response } from 'express';
import * as svc from '../services/notificacaoService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarNotificacoes(req.query.busca as string));
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarNotificacao(req.body) });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarNotificacao(Number(req.params.id));
  res.status(204).send();
};
export const enviar = async (req: Request, res: Response) => {
  const { titulo, mensagem, idCliente } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ error: 'titulo e mensagem são obrigatórios' });
  const result = await svc.enviarPush(titulo, mensagem, idCliente ? Number(idCliente) : undefined);
  res.json(result);
};
