import { getPool } from '../../config/database';
import { garantirTabelasCobranca } from './schema';

/** Controle (Clientes_Perfil.CONTROLE) que libera a área Cobrança. */
export const CONTROLE_COBRANCA = 'Intermediação de Cobrança';

export class CobrancaError extends Error {
  constructor(public status: number, message: string, public dados?: any) {
    super(message);
  }
}

export interface UsuarioCobranca { id?: number; nome?: string; adm?: string; controles?: string[] }

export async function statusPlano(): Promise<{ ativa: boolean; taxaPadrao: number }> {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().query(`SELECT TOP 1 COBR_ATIVA, COBR_TAXA_PADRAO FROM Configuracoes`);
  const c = r.recordset[0] || {};
  return { ativa: c.COBR_ATIVA === 'S', taxaPadrao: Number(c.COBR_TAXA_PADRAO) || 0 };
}

/** Como o Financeiro: só administrador ou quem tem o controle marcado de propósito. */
export function temAcessoCobranca(u: UsuarioCobranca | undefined): boolean {
  if (!u) return false;
  return u.adm === 'S' || (u.controles || []).includes(CONTROLE_COBRANCA);
}
