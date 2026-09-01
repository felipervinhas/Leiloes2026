import { getPool, sql, BANCOS_PERMITIDOS } from '../config/database';
import { bancoStorage } from './bancoContext';

export async function executarMigracao() {
  for (const banco of BANCOS_PERMITIDOS) {
    await bancoStorage.run(banco, () => executarMigracaoBanco(banco));
  }
}

async function executarMigracaoBanco(banco: string) {
  try {
    const pool = await getPool();

    const queries = [
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'VER_COMISSOES')
       ALTER TABLE Clientes ADD VER_COMISSOES CHAR(1) DEFAULT 'S'`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'VER_VALORES_LIQUIDOS')
       ALTER TABLE Clientes ADD VER_VALORES_LIQUIDOS CHAR(1) DEFAULT 'S'`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'VER_INFO_FINANCEIRA')
       ALTER TABLE Clientes ADD VER_INFO_FINANCEIRA CHAR(1) DEFAULT 'S'`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'VER_TOP_COMPRADORES')
       ALTER TABLE Clientes ADD VER_TOP_COMPRADORES CHAR(1) DEFAULT 'S'`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'VER_TOP_VENDEDORES')
       ALTER TABLE Clientes ADD VER_TOP_VENDEDORES CHAR(1) DEFAULT 'S'`,
      `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Clientes' AND COLUMN_NAME = 'VER_VENCIMENTOS')
       ALTER TABLE Clientes ADD VER_VENCIMENTOS CHAR(1) DEFAULT 'S'`,
      // Movimento_Lote.LOTEXX era VARCHAR(10), mas Lotes.LOTEXX é VARCHAR(20) —
      // lotes com código mais longo (ex.: "07 - BOX 543") estouravam a coluna
      // e derrubavam o salvamento do step "Lote & Valores" em Vendas com erro
      // de truncamento silencioso (a UI não repassava a mensagem do SQL Server).
      `IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Movimento_Lote' AND COLUMN_NAME = 'LOTEXX' AND CHARACTER_MAXIMUM_LENGTH < 20)
       ALTER TABLE Movimento_Lote ALTER COLUMN LOTEXX VARCHAR(20) NULL`,
    ];

    for (const query of queries) {
      try {
        await pool.request().query(query);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.warn(`⚠ [${banco}] Aviso na migração:`, err.message);
        }
      }
    }

    console.log(`✓ [${banco}] Migrações de permissões completadas`);
  } catch (err) {
    console.error(`Erro ao executar migrações em [${banco}]:`, err);
  }
}
