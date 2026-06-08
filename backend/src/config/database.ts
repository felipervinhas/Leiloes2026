import sql from 'mssql';
import dotenv from 'dotenv';
import { getBanco } from './bancoContext';

dotenv.config();

const BANCOS_PERMITIDOS = ['knorr', 'MacedoLeiloes', 'LoteRural', 'G2'];

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
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

const pools = new Map<string, sql.ConnectionPool>();

export async function getPool(): Promise<sql.ConnectionPool> {
  const banco = getBanco();
  if (!pools.has(banco)) {
    const p = await new sql.ConnectionPool(buildConfig(banco)).connect();
    console.log(`[DB] Conectado ao banco: ${banco}`);
    pools.set(banco, p);
  }
  return pools.get(banco)!;
}

export { sql, BANCOS_PERMITIDOS };
