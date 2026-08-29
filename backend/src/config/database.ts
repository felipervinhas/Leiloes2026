import sql from 'mssql';
import dotenv from 'dotenv';
import { getBanco } from './bancoContext';

dotenv.config();

const BANCOS_PERMITIDOS = ['knorr', 'MacedoLeiloes', 'LoteRural', 'G2', 'MacedoBkp'];

function buildConfig(database: string): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: Number(process.env.DB_PORT) || 1433,
    database,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    },
    // Algumas listagens sem filtro (ex.: Lotes, ~17 mil registros) já levam
    // uns 12s pela rede até o SQL Server na AWS — o padrão do driver (15s)
    // fica justo demais e derruba a query por timeout com qualquer variação
    // de latência.
    requestTimeout: 60_000,
    connectionTimeout: 30_000,
    // min:1 mantém sempre uma conexão física aberta por tenant — evita que o
    // primeiro clique depois de ~30s parado pague o custo de reconectar do
    // zero (TCP+TLS+auth) contra o SQL Server na AWS.
    pool: { max: 10, min: 1, idleTimeoutMillis: 30000 },
  };
}

const pools = new Map<string, sql.ConnectionPool>();

const KEEP_ALIVE_INTERVAL_MS = 20_000;

/** Ping leve periódico por tenant — segunda camada de proteção contra a conexão
 * cair por ociosidade (ex.: timeout do lado do SQL Server, não só do pool local). */
function iniciarKeepAlive(banco: string, pool: sql.ConnectionPool) {
  const timer = setInterval(() => {
    pool.request().query('SELECT 1').catch(err => {
      console.error(`[DB] keep-alive falhou (${banco}):`, err.message || err);
    });
  }, KEEP_ALIVE_INTERVAL_MS);
  timer.unref();
}

export async function getPool(): Promise<sql.ConnectionPool> {
  const banco = getBanco();
  if (!pools.has(banco)) {
    const p = await new sql.ConnectionPool(buildConfig(banco)).connect();
    console.log(`[DB] Conectado ao banco: ${banco}`);
    pools.set(banco, p);
    iniciarKeepAlive(banco, p);
  }
  return pools.get(banco)!;
}

export { sql, BANCOS_PERMITIDOS };
