import { Request, Response } from 'express';
import {
  listarTemplates, buscarTemplate, criarTemplate, atualizarTemplate,
  deletarTemplate, gerarContrato, VARIAVEIS_DISPONIVEIS,
  buscarTestemunhas, salvarTestemunhas,
} from '../services/contratoService';
import { registrarLog } from '../services/logService';

export const listar  = async (_req: Request, res: Response) => res.json(await listarTemplates());

export const buscar  = async (req: Request, res: Response) => {
  const t = await buscarTemplate(Number(req.params.id));
  res.json(t);
};

export const criar   = async (req: Request, res: Response) => {
  const { nome, tipo, conteudo, imagemTopo, imagemRodape } = req.body;
  const resultado = await criarTemplate(nome, tipo ?? null, conteudo, imagemTopo ?? null, imagemRodape ?? null);
  await registrarLog((req as any).usuario, 'Inserir', 'Contratos', resultado.id);
  res.json(resultado);
};

export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { nome, tipo, conteudo, imagemTopo, imagemRodape } = req.body;
  await atualizarTemplate(id, nome, tipo ?? null, conteudo, imagemTopo ?? null, imagemRodape ?? null);
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
  const result = await gerarContrato(Number(idMov), Number(idCli), Number(idTemplate), {
    avalista1: req.query.avalista1 as string | undefined,
    avalista2: req.query.avalista2 as string | undefined,
  });
  res.json(result);
};

export const testemunhas = async (_req: Request, res: Response) => res.json(await buscarTestemunhas());

export const salvarTestemunhasCtrl = async (req: Request, res: Response) => {
  const { testemunha1, testemunha2 } = req.body;
  await salvarTestemunhas(testemunha1 || '', testemunha2 || '');
  await registrarLog((req as any).usuario, 'Alterar', 'Contratos', 'testemunhas');
  res.json({ ok: true });
};

export const variaveis = (_req: Request, res: Response) =>
  res.json(VARIAVEIS_DISPONIVEIS);
