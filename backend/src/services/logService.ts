import { getPool, sql } from '../config/database';

export type TipoAcaoLog = 'Inserir' | 'Alterar' | 'Deletar';

const TIPO_GERUNDIO: Record<TipoAcaoLog, string> = {
  Inserir: 'Inserindo',
  Alterar: 'Alterando',
  Deletar: 'Deletando',
};

interface UsuarioLog {
  id?: number;
  nome?: string;
}

/**
 * Grava na tabela LOG (mesma tabela usada pelo sistema Delphi legado, com
 * ~450 mil registros já gravados) no formato "Usuário X acessou (Inserindo)
 * o Controle de Y no registro: Z" — mantém compatibilidade com quem já lê
 * esse histórico. Nunca lança erro: uma falha ao gravar o log não deve
 * derrubar a ação principal do usuário.
 *
 * Fire-and-forget: o INSERT roda em segundo plano e a Promise retornada já
 * vem resolvida, para que os ~76 pontos de chamada (`await registrarLog(...)`
 * antes de responder ao cliente) não fiquem bloqueados esperando essa escrita
 * de auditoria — ela não faz parte do resultado que o usuário está esperando.
 */
export function registrarLog(
  usuario: UsuarioLog | null | undefined,
  tipo: TipoAcaoLog,
  controle: string,
  registroId: number | string
): Promise<void> {
  const nome = usuario?.nome || 'Desconhecido';
  const mensagem = `Log: Usuário ${nome} acessou (${TIPO_GERUNDIO[tipo]}) o Controle de ${controle} no registro: ${registroId}`;
  (async () => {
    try {
      const pool = await getPool();
      await pool.request()
        .input('log', sql.VarChar, mensagem)
        .input('dataHora', sql.SmallDateTime, new Date())
        .input('idClientes', sql.Int, usuario?.id ?? null)
        .query(`INSERT INTO LOG (LOG, DATA_HORA, ID_CLIENTES) VALUES (@log, @dataHora, @idClientes)`);
    } catch (err) {
      console.error('[logService] falha ao gravar log:', err);
    }
  })();
  return Promise.resolve();
}
