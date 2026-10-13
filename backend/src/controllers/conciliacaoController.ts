import { Request, Response, NextFunction } from 'express';
import { registrarLog } from '../services/logService';
import { ConciliacaoError, statusPlano, temAcessoConciliacao } from '../services/conciliacao/acessoService';
import * as contas from '../services/conciliacao/contasService';
import * as imp from '../services/conciliacao/importacaoService';

const usuarioDe = (req: Request) => (req as any).usuario;

/** Erros de regra (ConciliacaoError) viram resposta com o status e a mensagem; o resto segue para o errorHandler. */
const tratar = (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (e: any) {
      if (e instanceof ConciliacaoError) return res.status(e.status).json({ error: e.message, dados: e.dados });
      next(e);
    }
  };

/** Barra as rotas do Financeiro: empresa sem plano (402) ou usuário sem o controle (403). */
export async function exigirConciliacao(req: Request, res: Response, next: NextFunction) {
  try {
    const { ativa } = await statusPlano();
    if (!ativa) return res.status(402).json({ error: 'Conciliação bancária não contratada para esta empresa' });
    if (!temAcessoConciliacao(usuarioDe(req))) return res.status(403).json({ error: 'Usuário sem acesso à conciliação bancária' });
    next();
  } catch (e) { next(e); }
}

export const status = tratar(async (req, res) => {
  const s = await statusPlano();
  res.json({ ...s, acesso: temAcessoConciliacao(usuarioDe(req)) });
});

export const listarContas = tratar(async (_req, res) => { res.json(await contas.listarContas()); });

export const criarConta = tratar(async (req, res) => {
  const id = await contas.criarConta(req.body);
  await registrarLog(usuarioDe(req), 'Inserir', 'Conciliação - Contas', id);
  res.status(201).json({ id });
});

export const atualizarConta = tratar(async (req, res) => {
  const id = Number(req.params.id);
  await contas.atualizarConta(id, req.body);
  await registrarLog(usuarioDe(req), 'Alterar', 'Conciliação - Contas', id);
  res.json({ ok: true });
});

export const importar = tratar(async (req, res) => {
  const file = (req as any).file as { buffer: Buffer; originalname: string } | undefined;
  if (!file?.buffer?.length) throw new ConciliacaoError(400, 'Envie o arquivo OFX');
  const resumo = await imp.importarExtrato(file.buffer, file.originalname, usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Inserir', 'Conciliação - Importação', resumo.idImportacao);
  res.status(201).json(resumo);
});

export const listarImportacoes = tratar(async (req, res) => {
  res.json(await imp.listarImportacoes(req.query.idConta ? Number(req.query.idConta) : undefined));
});

export const listarLancamentos = tratar(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(await imp.listarLancamentos({
    idConta: q.idConta ? Number(q.idConta) : undefined,
    de: q.de, ate: q.ate,
    sentido: q.sentido === 'C' || q.sentido === 'D' ? q.sentido : undefined,
    situacao: q.situacao, busca: q.busca?.trim() || undefined,
  }));
});

export const resumo = tratar(async (_req, res) => { res.json(await imp.resumoPainel()); });
