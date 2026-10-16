import { getPool, sql } from '../../config/database';
import { garantirTabelasConciliacao } from './schema';

/** Nome do controle (Clientes_Perfil.CONTROLE) que libera a área Financeiro. */
export const CONTROLE_CONCILIACAO = 'Conciliação Bancária';

export class ConciliacaoError extends Error {
  constructor(public status: number, message: string, public dados?: any) {
    super(message);
  }
}

export interface StatusConciliacao {
  ativa: boolean;
  plano: string | null;
}

export async function statusPlano(): Promise<StatusConciliacao> {
  await garantirTabelasConciliacao();
  const pool = await getPool();
  const r = await pool.request().query(`SELECT TOP 1 CONC_ATIVA, CONC_PLANO FROM Configuracoes`);
  const c = r.recordset[0] || {};
  return { ativa: c.CONC_ATIVA === 'S', plano: c.CONC_PLANO || null };
}

/**
 * Diferente do menu do sistema de leilões (lista de controles vazia = acesso a tudo),
 * o Financeiro só abre para administrador ou para quem tem o controle marcado
 * de propósito — usuário comum sem controles não pode ver extrato e repasses.
 */
export function temAcessoConciliacao(usuario: { adm?: string; controles?: string[] } | undefined): boolean {
  if (!usuario) return false;
  return usuario.adm === 'S' || (usuario.controles || []).includes(CONTROLE_CONCILIACAO);
}
