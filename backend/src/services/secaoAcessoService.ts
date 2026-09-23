import { getPool, sql } from '../config/database';
import { getBanco } from '../config/bancoContext';

/**
 * No Delphi da Macedo o sistema tinha dois menus: "Área Interna/Cadastros" e
 * "Acesso Web". O menu usado definia o TIPO_SECAO do lote ('I' ou 'W'), se o
 * usuário podia marcar o lote como Público no site, se podia mexer em
 * Acesso App/Bloqueado do cliente e o SESSAO gravado no cliente novo.
 *
 * Aqui não há menus separados: a seção vem do tipo do usuário logado —
 * PISTEIRO é Web, qualquer outro é Interno. Só vale pra Macedo; nos demais
 * bancos retorna null e nada muda.
 */
export type TipoSecao = 'I' | 'W';

const BANCO_COM_SECAO = 'MacedoLeiloes';

export function usaSecaoInternaWeb(): boolean {
  return getBanco() === BANCO_COM_SECAO;
}

export async function tipoSecaoDoUsuario(idUsuario?: number): Promise<TipoSecao | null> {
  if (!usaSecaoInternaWeb() || !idUsuario) return null;
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idUsuario)
    .query(`SELECT TIPO_USUARIO FROM Clientes WHERE ID = @id`);
  const tipo = String(r.recordset[0]?.TIPO_USUARIO ?? '').trim().toUpperCase();
  return tipo === 'PISTEIRO' ? 'W' : 'I';
}

export const SESSAO_CLIENTE: Record<TipoSecao, string> = { I: 'AcessoInterno', W: 'AcessoWeb' };

export async function definirSessaoCliente(idCliente: number, tipo: TipoSecao): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, idCliente).input('sessao', sql.VarChar, SESSAO_CLIENTE[tipo])
    .query(`UPDATE Clientes SET SESSAO = @sessao WHERE ID = @id`);
}
