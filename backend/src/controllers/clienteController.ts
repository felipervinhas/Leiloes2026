import { Request, Response } from 'express';
import * as svc from '../services/clienteService';
import { DuplicidadeError } from '../services/clienteService';
import { consultarVendas } from '../services/consultaVendasService';
import { buscarHistoricoLegado } from '../services/clienteLegadoService';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarClientes(req.query.busca as string, req.query.filtro as string, req.query.filtroValor as string, req.query.classificacoes as string));
};
export const listarFaturamento = async (req: Request, res: Response) => {
  res.json(await svc.listarClientesFaturamento(req.query.busca as string, req.query.filtro as string, req.query.filtroValor as string, req.query.classificacoes as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarClientePorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  try {
    const idUsuario = (req as any).usuario?.id ?? null;
    const id = await svc.criarCliente({ ...req.body, usucad: idUsuario });
    await registrarLog((req as any).usuario, 'Inserir', 'Clientes', id);
    res.status(201).json({ id });
  } catch (err) {
    if (err instanceof DuplicidadeError) return res.status(409).json({ error: err.message });
    throw err;
  }
};
export const atualizar = async (req: Request, res: Response) => {
  try {
    const idUsuario = (req as any).usuario?.id ?? null;
    const id = Number(req.params.id);
    await svc.atualizarCliente(id, { ...req.body, usualt: idUsuario });
    await registrarLog((req as any).usuario, 'Alterar', 'Clientes', id);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof DuplicidadeError) return res.status(409).json({ error: err.message });
    throw err;
  }
};
export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.deletarCliente(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Clientes', id);
  res.status(204).send();
};
export const alterarSenha = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.alterarSenhaCliente(id, req.body.senhax);
  await registrarLog((req as any).usuario, 'Alterar', 'Clientes', id);
  res.json({ ok: true });
};
export const listarPendentes = async (_req: Request, res: Response) => {
  res.json(await svc.listarClientesPendentes());
};
export const contarPendentes = async (_req: Request, res: Response) => {
  res.json({ total: await svc.contarClientesPendentes() });
};
export const aprovar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.aprovarCliente(id);
  await registrarLog((req as any).usuario, 'Alterar', 'Clientes', id);
  res.json({ ok: true });
};
export const recusar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.recusarCliente(id);
  await registrarLog((req as any).usuario, 'Alterar', 'Clientes', id);
  res.json({ ok: true });
};
export const analisar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await svc.analisarCliente(id);
  await registrarLog((req as any).usuario, 'Alterar', 'Clientes', id);
  res.json({ ok: true });
};
export const historico = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const compras = await consultarVendas({ idComprador: id });
    const vendas  = await consultarVendas({ idVendedor: id });
    console.log(`[historico] cliente=${id} compras=${compras.length} vendas=${vendas.length}`);
    res.json({ compras, vendas });
  } catch (err) {
    console.error('[historico] erro:', err);
    res.status(500).json({ error: String(err) });
  }
};

export const historicoLegado = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    res.json(await buscarHistoricoLegado(id));
  } catch (err) {
    console.error('[historicoLegado] erro:', err);
    res.status(500).json({ error: String(err) });
  }
};
