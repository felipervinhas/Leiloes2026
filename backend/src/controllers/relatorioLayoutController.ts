import { Request, Response } from 'express';
import {
  listarLayouts, buscarLayout, buscarLayoutAtivo,
  criarLayout, atualizarLayout, deletarLayout, ativarLayout,
} from '../services/relatorioLayoutService';

function ehAdmin(req: Request) {
  return (req as any).usuario?.adm === 'S';
}

export const listar = async (req: Request, res: Response) => {
  res.json(await listarLayouts(req.query.tipo as string | undefined));
};

export const buscar = async (req: Request, res: Response) => {
  res.json(await buscarLayout(Number(req.params.id)));
};

export const ativo = async (req: Request, res: Response) => {
  const layout = await buscarLayoutAtivo(req.params.tipo);
  res.json(layout);
};

export const criar = async (req: Request, res: Response) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  const { nome, tipo, conteudo } = req.body;
  res.json(await criarLayout(nome, tipo, conteudo));
};

export const atualizar = async (req: Request, res: Response) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  const { nome, conteudo } = req.body;
  await atualizarLayout(Number(req.params.id), nome, conteudo);
  res.json({ ok: true });
};

export const deletar = async (req: Request, res: Response) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  await deletarLayout(Number(req.params.id));
  res.json({ ok: true });
};

export const ativar = async (req: Request, res: Response) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  const { tipo } = req.body;
  await ativarLayout(Number(req.params.id), tipo);
  res.json({ ok: true });
};
