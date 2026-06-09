import { getPool, sql } from '../config/database';

export interface PermissaoDashboard {
  idUsuario: number;
  verComissoes: string;
  verValoresLiquidos: string;
  verInfoFinanceira: string;
  verTopCompradores: string;
  verTopVendedores: string;
  verVencimentos: string;
}

export async function obterPermissoes(idUsuario: number): Promise<PermissaoDashboard> {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idUsuario)
    .query(`
      SELECT 
        ID,
        ISNULL(VER_COMISSOES, 'S') AS VER_COMISSOES,
        ISNULL(VER_VALORES_LIQUIDOS, 'S') AS VER_VALORES_LIQUIDOS,
        ISNULL(VER_INFO_FINANCEIRA, 'S') AS VER_INFO_FINANCEIRA,
        ISNULL(VER_TOP_COMPRADORES, 'S') AS VER_TOP_COMPRADORES,
        ISNULL(VER_TOP_VENDEDORES, 'S') AS VER_TOP_VENDEDORES,
        ISNULL(VER_VENCIMENTOS, 'S') AS VER_VENCIMENTOS
      FROM Clientes 
      WHERE ID = @id AND ADM = 'S'
    `);
  
  if (!r.recordset.length) {
    // Se coluna não existe ou usuário não encontrado, retornar padrão
    return {
      idUsuario,
      verComissoes: 'S',
      verValoresLiquidos: 'S',
      verInfoFinanceira: 'S',
      verTopCompradores: 'S',
      verTopVendedores: 'S',
      verVencimentos: 'S',
    };
  }
  
  const p = r.recordset[0];
  return {
    idUsuario: p.ID,
    verComissoes: p.VER_COMISSOES || 'S',
    verValoresLiquidos: p.VER_VALORES_LIQUIDOS || 'S',
    verInfoFinanceira: p.VER_INFO_FINANCEIRA || 'S',
    verTopCompradores: p.VER_TOP_COMPRADORES || 'S',
    verTopVendedores: p.VER_TOP_VENDEDORES || 'S',
    verVencimentos: p.VER_VENCIMENTOS || 'S',
  };
}

export async function atualizarPermissoes(idUsuario: number, permissoes: PermissaoDashboard): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, idUsuario)
    .input('verComissoes', sql.Char, permissoes.verComissoes)
    .input('verValoresLiquidos', sql.Char, permissoes.verValoresLiquidos)
    .input('verInfoFinanceira', sql.Char, permissoes.verInfoFinanceira)
    .input('verTopCompradores', sql.Char, permissoes.verTopCompradores)
    .input('verTopVendedores', sql.Char, permissoes.verTopVendedores)
    .input('verVencimentos', sql.Char, permissoes.verVencimentos)
    .query(`
      UPDATE Clientes SET 
        VER_COMISSOES = @verComissoes,
        VER_VALORES_LIQUIDOS = @verValoresLiquidos,
        VER_INFO_FINANCEIRA = @verInfoFinanceira,
        VER_TOP_COMPRADORES = @verTopCompradores,
        VER_TOP_VENDEDORES = @verTopVendedores,
        VER_VENCIMENTOS = @verVencimentos,
        DATALT = GETDATE()
      WHERE ID = @id AND ADM = 'S'
    `);
}
