import { getPool, sql } from '../config/database';

export async function executarMigracao() {
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
    ];

    for (const query of queries) {
      try {
        await pool.request().query(query);
        console.log('✓ Migração executada:', query.substring(0, 50) + '...');
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.warn('⚠ Aviso na migração:', err.message);
        }
      }
    }

    console.log('✓ Migrações de permissões completadas');
  } catch (err) {
    console.error('Erro ao executar migrações:', err);
  }
}
