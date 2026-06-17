import { Request, Response } from 'express';
import * as svc from '../services/vendaService';

export const listar = async (req: Request, res: Response) => {
  const { busca, tipoBusca, idLeilao } = req.query;
  res.json(await svc.listarVendas({
    busca:     busca     as string | undefined,
    tipoBusca: tipoBusca as string | undefined,
    idLeilao:  idLeilao  ? Number(idLeilao) : undefined,
  }));
};

export const criar = async (req: Request, res: Response) => {
  const { idLeilao, codnot } = req.body;
  if (!idLeilao) return res.status(400).json({ error: 'idLeilao obrigatório' });
  const id = await svc.criarMovimento({ idLeilao: Number(idLeilao), codnot: codnot || '' });
  res.status(201).json({ id });
};

export const atualizar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { idLeilao, codnot } = req.body;
  await svc.atualizarMovimento(id, { idLeilao: Number(idLeilao), codnot });
  res.json({ ok: true });
};

export const buscar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const venda = await svc.buscarMovimento(id);
  if (!venda) return res.status(404).json({ error: 'Não encontrado' });
  res.json(venda);
};

export const excluir = async (req: Request, res: Response) => {
  await svc.excluirVenda(Number(req.params.id));
  res.json({ ok: true });
};

// ─── lotes ──────────────────────────────────────────────────────────────────

export const lotesDisponiveis = async (req: Request, res: Response) => {
  const idLeilao = Number(req.params.idLeilao);
  if (!idLeilao) return res.status(400).json({ error: 'idLeilao obrigatório' });
  res.json(await svc.lotesDisponiveis(idLeilao));
};

export const buscarLote = async (req: Request, res: Response) => {
  const idMov = Number(req.params.id);
  const lote = await svc.buscarLoteMovimento(idMov);
  res.json(lote ?? null);
};

export const salvarLote = async (req: Request, res: Response) => {
  const idMov = Number(req.params.id);
  const { idLote, qtdxxx, vlrpar, vlrtot, vlrdes, qtdpar,
          comiss, comissVendedor, datlan } = req.body;
  if (!idLote) return res.status(400).json({ error: 'idLote obrigatório' });
  const id = await svc.salvarLote(idMov, {
    idLote: Number(idLote), qtdxxx: Number(qtdxxx) || 1,
    vlrpar: Number(vlrpar) || 0, vlrtot: Number(vlrtot) || 0,
    vlrdes: Number(vlrdes) || 0, qtdpar: Number(qtdpar) || 1,
    comiss: Number(comiss) || 0, comissVendedor: Number(comissVendedor) || 0,
  }, datlan || new Date().toISOString().split('T')[0]);
  res.json({ id });
};

// ─── compradores ─────────────────────────────────────────────────────────────

export const listarCompradores = async (req: Request, res: Response) => {
  res.json(await svc.listarCompradores(Number(req.params.id)));
};

export const adicionarComprador = async (req: Request, res: Response) => {
  const idMov = Number(req.params.id);
  const { idCli, idCondPagto, percen, formaPagamento, idPropriedade, idPisteiro } = req.body;
  if (!idCli || !idCondPagto) {
    return res.status(400).json({ error: 'idCli e idCondPagto são obrigatórios' });
  }

  // Buscar dados do lote e do movimento
  const mov  = await svc.buscarMovimento(idMov);
  const lote = await svc.buscarLoteMovimento(idMov);
  if (!mov || !lote) return res.status(404).json({ error: 'Movimento ou lote não encontrado' });

  const id = await svc.salvarComprador(idMov, lote.id, {
    vlrtot: lote.vlrtot, vlrdes: lote.vlrdes ?? 0,
    comiss: lote.comiss ?? 0, comissVendedor: lote.comissVendedor ?? 0,
    lotexx: lote.lotexx, datlan: String(lote.datlan ?? ''), qtdxxx: lote.qtdxxx,
  }, {
    idCli: Number(idCli), idCondPagto: Number(idCondPagto),
    percen: Number(percen) || 100, formaPagamento: formaPagamento || 'PROMISSORIA',
    idPropriedade: idPropriedade ? Number(idPropriedade) : null,
    idPisteiro: idPisteiro ? Number(idPisteiro) : null,
  }, {
    id: mov.idLeilao, comcom: mov.comcom ?? 0, comven: mov.comven ?? 0,
    condic: mov.condic ?? 0, codnot: mov.codnot,
  });
  res.status(201).json({ id });
};

export const excluirComprador = async (req: Request, res: Response) => {
  const idMov  = Number(req.params.id);
  const idComp = Number(req.params.idComp);
  const lote   = await svc.buscarLoteMovimento(idMov);
  await svc.excluirComprador(idMov, idComp, lote?.qtdxxx ?? 1);
  res.json({ ok: true });
};

// ─── parcelas ────────────────────────────────────────────────────────────────

export const listarParcelas = async (req: Request, res: Response) => {
  const idMov = Number(req.params.id);
  const idCli = req.query.idCli ? Number(req.query.idCli) : undefined;
  res.json(await svc.listarParcelas(idMov, idCli));
};

export const gerarParcelas = async (req: Request, res: Response) => {
  const idMov  = Number(req.params.id);
  const idComp = Number(req.params.idComp);
  const { dataBase, invertQtd, invertValor } = req.body;

  const mov  = await svc.buscarMovimento(idMov);
  const lote = await svc.buscarLoteMovimento(idMov);
  const comps = await svc.listarCompradores(idMov);
  const comp  = comps.find(c => c.id === idComp);

  if (!mov || !lote || !comp) {
    return res.status(404).json({ error: 'Dados não encontrados' });
  }

  const datalei = mov.datlei
    ? new Date(mov.datlei).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  await svc.gerarParcelas({
    pMovimento:       idMov,
    pCliente:         comp.idCli,
    pCondicaoPagto:   comp.idCondPagto,
    pLeilao:          mov.idLeilao,
    pClienteVendedor: lote.codven,
    pLote:            lote.idLote,
    pLoteNumero:      lote.lotexx || '',
    pDataBase:        dataBase || datalei,
    pDataLeilao:      datalei,
    pValorOriginal:   comp.valorOriginal,
    pPercentual:      comp.percen,
    pValorDesconto:   comp.valorDesconto,
    pValorPagar:      comp.valorPagar,
    pInvertQtd:       Number(invertQtd)   || 0,
    pInvertValor:     Number(invertValor) || 0,
  });

  res.json({ ok: true });
};

export const atualizarParcela = async (req: Request, res: Response) => {
  const id = Number(req.params.idParc);
  const { datven, vlrpar } = req.body;
  await svc.atualizarParcela(
    id,
    datven   !== undefined ? String(datven)   : undefined,
    vlrpar   !== undefined ? Number(vlrpar)   : undefined,
  );
  res.json({ ok: true });
};

// ─── propriedades ────────────────────────────────────────────────────────────

export const fatura = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const dados = await svc.dadosFatura(id);
  if (!dados) return res.status(404).json({ error: 'Não encontrado' });
  res.json(dados);
};

export const listarPropriedades = async (req: Request, res: Response) => {
  res.json(await svc.listarPropriedades(Number(req.params.idCli)));
};

export const salvarPropriedade = async (req: Request, res: Response) => {
  const idMov  = Number(req.params.id);
  const idComp = Number(req.params.idComp);
  const { idCli, idPropriedade } = req.body;
  await svc.salvarPropriedadeComprador(idMov, Number(idCli), Number(idPropriedade));
  res.json({ ok: true });
};
