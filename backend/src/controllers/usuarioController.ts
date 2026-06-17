import { Request, Response } from 'express';
import * as svc from '../services/usuarioService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarUsuarios(req.query.busca as string, req.query.tipo as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarUsuarioPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  res.status(201).json({ id: await svc.criarUsuario(req.body) });
};
export const atualizar = async (req: Request, res: Response) => {
  await svc.atualizarUsuario(Number(req.params.id), req.body);
  res.json({ ok: true });
};
export const deletar = async (req: Request, res: Response) => {
  await svc.deletarUsuario(Number(req.params.id));
  res.status(204).send();
};
export const getControles = async (req: Request, res: Response) => {
  res.json(await svc.listarControlesUsuario(Number(req.params.id)));
};
export const putControles = async (req: Request, res: Response) => {
  await svc.salvarControlesUsuario(Number(req.params.id), req.body.controles ?? []);
  res.json({ ok: true });
};
