import { Request, Response } from 'express';
import {
  listarTemplates, buscarTemplate, criarTemplate, atualizarTemplate,
  deletarTemplate, gerarContrato, VARIAVEIS_DISPONIVEIS,
} from '../services/contratoService';
import { registrarLog } from '../services/logService';

export const listar  = async (_req: Request, res: Response) => res.json(await listarTemplates());

export const buscar  = async (req: Request, res: Response) => {
  const t = await buscarTemplate(Number(req.params.id));
  res.json(t);
};

export const criar   = async (req: Request, res: Response) => {
  const { nome, tipo, conteudo } = req.body;
  const resultado = await criarTemplate(nome, tipo ?? null, conteudo);
  await registrarLog((req as any).usuario, 'Inserir', 'Contratos', resultado.id);
  res.json(resultado);
};

export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { nome, tipo, conteudo } = req.body;
  await atualizarTemplate(id, nome, tipo ?? null, conteudo);
  await registrarLog((req as any).usuario, 'Alterar', 'Contratos', id);
  res.json({ ok: true });
};

export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deletarTemplate(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Contratos', id);
  res.json({ ok: true });
};

export const gerar   = async (req: Request, res: Response) => {
  const { idMov, idCli, idTemplate } = req.params;
  const result = await gerarContrato(Number(idMov), Number(idCli), Number(idTemplate));
  res.json(result);
};

export const variaveis = (_req: Request, res: Response) =>
  res.json(VARIAVEIS_DISPONIVEIS);
