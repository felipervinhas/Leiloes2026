import { Request, Response, NextFunction } from 'express';
import { registrarLog } from '../services/logService';
import { CobrancaError, statusPlano, temAcessoCobranca } from '../services/cobranca/acessoService';
import * as parc from '../services/cobranca/parcelasService';
import * as lotes from '../services/cobranca/lotesService';
import * as fech from '../services/cobranca/fechamentoService';

const usuarioDe = (req: Request) => (req as any).usuario;
const num = (v: any) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const txt = (v: any) => (v === undefined || v === null || v === '' ? undefined : String(v));
const CONTROLE = 'Intermediação de Cobrança';

const tratar = (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (e: any) {
      if (e instanceof CobrancaError) return res.status(e.status).json({ error: e.message, dados: e.dados });
      next(e);
    }
  };

/** Empresa sem o plano (402) ou usuário sem o controle (403). */
export async function exigirCobranca(req: Request, res: Response, next: NextFunction) {
  try {
    const { ativa } = await statusPlano();
    if (!ativa) return res.status(402).json({ error: 'Intermediação de cobrança não contratada para esta empresa' });
    if (!temAcessoCobranca(usuarioDe(req))) return res.status(403).json({ error: 'Usuário sem acesso à intermediação de cobrança' });
    next();
  } catch (e) { next(e); }
}

export const status = tratar(async (req, res) => {
  const s = await statusPlano();
  res.json({ ...s, acesso: temAcessoCobranca(usuarioDe(req)) });
});

export const resumo = tratar(async (req, res) => {
  res.json(await parc.resumo({ idVendedor: num(req.query.idVendedor) }));
});

export const listarParcelas = tratar(async (req, res) => {
  const q = req.query;
  res.json(await parc.listarParcelas({
    idVendedor: num(q.idVendedor), idComprador: num(q.idComprador), idLeilao: num(q.idLeilao), idLote: num(q.idLote),
    situacao: txt(q.situacao), vencDe: txt(q.vencDe), vencAte: txt(q.vencAte), todas: q.todas === 'S',
  }));
});

export const baixasDaParcela = tratar(async (req, res) => { res.json(await parc.listarBaixas(Number(req.params.id))); });
export const historicoDaParcela = tratar(async (req, res) => { res.json(await parc.historico({ idParcela: Number(req.params.id) })); });
export const historicoDoLote = tratar(async (req, res) => { res.json(await parc.historico({ idLote: Number(req.params.id) })); });

export const baixar = tratar(async (req, res) => {
  const b = req.body || {};
  const r = await parc.baixar({ ids: (b.ids || []).map(Number), dataPagamento: b.dataPagamento, valor: num(b.valor), recebidoEm: b.recebidoEm, observacao: b.observacao }, usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Inserir', `${CONTROLE} - Baixa`, (b.ids || []).join(','));
  res.json(r);
});

export const desfazerBaixa = tratar(async (req, res) => {
  await parc.desfazerBaixa(Number(req.params.id), usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Deletar', `${CONTROLE} - Baixa`, req.params.id);
  res.json({ ok: true });
});

export const renegociar = tratar(async (req, res) => {
  const b = req.body || {};
  await parc.renegociar(Number(req.params.id), { vencimento: txt(b.vencimento), valor: num(b.valor), motivo: txt(b.motivo) }, usuarioDe(req), 'MACEDO');
  await registrarLog(usuarioDe(req), 'Alterar', `${CONTROLE} - Renegociação`, req.params.id);
  res.json({ ok: true });
});

export const quitarAnteriores = tratar(async (req, res) => {
  const b = req.body || {};
  const r = await parc.quitarAnteriores({ idLotes: b.idLotes?.map(Number), ate: txt(b.ate), ids: b.ids?.map(Number) }, usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Inserir', `${CONTROLE} - Quitação anterior`, (b.idLotes || b.ids || []).join(','));
  res.json(r);
});

export const lotesDoVendedor = tratar(async (req, res) => {
  res.json(await lotes.lotesDoVendedor(Number(req.params.id), { soVendidos: req.query.soVendidos === 'S', idLeilao: num(req.query.idLeilao) }));
});

export const configDoLote = tratar(async (req, res) => { res.json(await lotes.configDoLote(Number(req.params.id))); });

export const salvarLotes = tratar(async (req, res) => {
  const b = req.body || {};
  await lotes.salvarLotes((b.idLotes || []).map(Number), {
    ativa: b.ativa !== false, destino: b.destino, parcInicial: num(b.parcInicial) ?? null, taxa: num(b.taxa) ?? null,
  }, usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Alterar', `${CONTROLE} - Lotes`, (b.idLotes || []).join(','));
  res.json({ ok: true });
});

export const listarVendedores = tratar(async (_req, res) => { res.json(await lotes.listarVendedores()); });
export const padraoDoVendedor = tratar(async (req, res) => { res.json(await lotes.padraoDoVendedor(Number(req.params.id))); });

export const salvarVendedor = tratar(async (req, res) => {
  const b = req.body || {};
  await lotes.salvarVendedor(Number(req.params.id), { padrao: !!b.padrao, destino: b.destino, taxa: num(b.taxa) ?? null }, usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Alterar', `${CONTROLE} - Vendedores`, req.params.id);
  res.json({ ok: true });
});

export const excluirVendedor = tratar(async (req, res) => {
  await lotes.excluirVendedor(Number(req.params.id));
  await registrarLog(usuarioDe(req), 'Deletar', `${CONTROLE} - Vendedores`, req.params.id);
  res.json({ ok: true });
});

export const salvarTaxaPadrao = tratar(async (req, res) => {
  await lotes.salvarTaxaPadrao(Number(req.body?.taxa));
  await registrarLog(usuarioDe(req), 'Alterar', `${CONTROLE} - Taxa padrão`, String(req.body?.taxa));
  res.json({ ok: true });
});

export const competencia = tratar(async (req, res) => {
  res.json(await fech.competencia(String(req.params.comp), num(req.query.idVendedor)));
});

export const previa = tratar(async (req, res) => {
  res.json(await fech.previaVendedor(String(req.query.competencia), Number(req.query.idVendedor)));
});

export const fechar = tratar(async (req, res) => {
  const b = req.body || {};
  const r = await fech.fechar(String(b.competencia), Number(b.idVendedor), txt(b.observacao), usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Inserir', `${CONTROLE} - Fechamento`, r.id);
  res.json(r);
});

export const listarFechamentos = tratar(async (req, res) => {
  const q = req.query;
  res.json(await fech.listar({ idVendedor: num(q.idVendedor), situacao: txt(q.situacao), de: txt(q.de), ate: txt(q.ate) }));
});

export const detalheFechamento = tratar(async (req, res) => { res.json(await fech.detalhe(Number(req.params.id))); });

export const reabrirFechamento = tratar(async (req, res) => {
  await fech.reabrir(Number(req.params.id));
  await registrarLog(usuarioDe(req), 'Deletar', `${CONTROLE} - Fechamento`, req.params.id);
  res.json({ ok: true });
});

export const situacaoFechamento = tratar(async (req, res) => {
  await fech.mudarSituacao(Number(req.params.id), String(req.body?.situacao));
  await registrarLog(usuarioDe(req), 'Alterar', `${CONTROLE} - Fechamento`, req.params.id);
  res.json({ ok: true });
});
