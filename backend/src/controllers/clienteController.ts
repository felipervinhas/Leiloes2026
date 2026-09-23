import { Request, Response } from 'express';
import * as svc from '../services/clienteService';
import { DuplicidadeError } from '../services/clienteService';
import { consultarVendas } from '../services/consultaVendasService';
import { buscarHistoricoLegado } from '../services/clienteLegadoService';
import { registrarLog } from '../services/logService';
import { tipoSecaoDoUsuario, definirSessaoCliente } from '../services/secaoAcessoService';

const filtrosDaQuery = (req: Request): svc.FiltrosCliente => ({
  nome: req.query.nome as string, cpf: req.query.cpf as string,
  cnpj: req.query.cnpj as string, cidade: req.query.cidade as string,
  estado: req.query.estado as string, situacao: req.query.situacao as string,
  propriedade: req.query.propriedade as string,
});

export const listar = async (req: Request, res: Response) => {
  const filtros = filtrosDaQuery(req);
  const filtroValor = req.query.filtroValor as string;
  const classificacoes = req.query.classificacoes as string;
  // page só é enviado pela tela de Clientes (que navega a base toda, +11 mil
  // registros); outros consumidores (ex.: Select de vendedor em Lotes)
  // continuam recebendo o array simples de antes.
  if (req.query.page) {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    res.json(await svc.listarClientesPaginado(filtros, filtroValor, classificacoes, page, pageSize));
  } else {
    res.json(await svc.listarClientes(filtros, filtroValor, classificacoes));
  }
};
export const listarFaturamento = async (req: Request, res: Response) => {
  res.json(await svc.listarClientesFaturamento(filtrosDaQuery(req), req.query.filtroValor as string, req.query.classificacoes as string));
};
export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarClientePorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};
export const criar = async (req: Request, res: Response) => {
  try {
    const idUsuario = (req as any).usuario?.id ?? null;
    const dados = { ...req.body, usucad: idUsuario };
    const tipoSecao = await tipoSecaoDoUsuario(idUsuario);
    // Macedo: usuário interno não define Acesso App/Bloqueado (travados no Delphi); vale o padrão do cadastro novo
    if (tipoSecao === 'I') { dados.acessoApp = '2 - Bloqueado'; dados.blocli = 'Não'; }
    const id = await svc.criarCliente(dados);
    if (tipoSecao) await definirSessaoCliente(id, tipoSecao);
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
    const dados = { ...req.body, usualt: idUsuario };
    if (await tipoSecaoDoUsuario(idUsuario) === 'I') {
      const atual = await svc.buscarClientePorId(id);
      dados.acessoApp = atual?.acessoApp ?? null;
      dados.blocli = atual?.blocli ?? 'Não';
    }
    await svc.atualizarCliente(id, dados);
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
