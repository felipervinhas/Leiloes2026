import { Request, Response } from 'express';
import {
  listarLayouts, buscarLayout, buscarLayoutAtivo,
  criarLayout, atualizarLayout, deletarLayout, ativarLayout,
} from '../services/relatorioLayoutService';
import { registrarLog } from '../services/logService';

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
  const resultado = await criarLayout(nome, tipo, conteudo);
  await registrarLog((req as any).usuario, 'Inserir', 'Editor de Relatórios', resultado.id);
  res.json(resultado);
};

export const atualizar = async (req: Request, res: Response) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  const id = Number(req.params.id);
  const { nome, conteudo } = req.body;
  await atualizarLayout(id, nome, conteudo);
  await registrarLog((req as any).usuario, 'Alterar', 'Editor de Relatórios', id);
  res.json({ ok: true });
};

export const deletar = async (req: Request, res: Response) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  const id = Number(req.params.id);
  await deletarLayout(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Editor de Relatórios', id);
  res.json({ ok: true });
};

export const ativar = async (req: Request, res: Response) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  const id = Number(req.params.id);
  const { tipo } = req.body;
  await ativarLayout(id, tipo);
  await registrarLog((req as any).usuario, 'Alterar', 'Editor de Relatórios', id);
  res.json({ ok: true });
};
