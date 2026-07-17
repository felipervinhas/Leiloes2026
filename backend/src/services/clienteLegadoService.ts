import { getPool, sql } from '../config/database';

export interface TotalLegadoPorLeilao {
  id: number;
  leilao: string;
  totalVendas: number;
  totalCompras: number;
}

export interface BoletoLegado {
  key: number;
  remate: number;
  boleto: number;
  leilao: string;
  nomeVendedor: string;
  nomeComprador: string;
  quantidade: number;
  total: number;
  valorLiquido: number;
  desconto: number;
  lote1: string;
  lote2: string;
  lote3: string;
  peso: number;
  comissaoVenda: number;
  comissaoCompra: number;
  valorDesconto: number;
  valorComissaoCompra: number;
  valorComissaoVenda: number;
  descricao: string;
  codVend: number;
  codComp: number;
}

/**
 * Histórico do sistema legado Delphi (pré-migração), replicando a aba "Legado" de
 * unClientes_Negocios.pas: totais por leilão (Boletos agrupados por Leiloes) e o
 * detalhe dos boletos do cliente (VW_BOLETOS_LEGADO), filtrável por leilão no frontend.
 */
export async function buscarHistoricoLegado(idCliente: number) {
  const pool = await getPool();

  const totais = await pool.request().input('id', sql.Int, idCliente).query(`
    SELECT
      Leiloes.ID,
      Leiloes.leilao,
      (SELECT SUM(Total) FROM Boletos WHERE Boletos.CODVEND = @id AND Boletos.Remate = Leiloes.ID) AS TotalVendas,
      (SELECT SUM(Total) FROM Boletos WHERE Boletos.CODCOMP = @id AND Boletos.Remate = Leiloes.ID) AS TotalCompras
    FROM Leiloes
    LEFT JOIN Boletos ON Boletos.Remate = Leiloes.ID
    GROUP BY Leiloes.ID, Leiloes.leilao
    HAVING
      SUM(CASE WHEN Boletos.CODVEND = @id THEN Boletos.Total ELSE 0 END) > 0 OR
      SUM(CASE WHEN Boletos.CODCOMP = @id THEN Boletos.Total ELSE 0 END) > 0
    ORDER BY Leiloes.leilao
  `);

  const boletos = await pool.request().input('id', sql.Int, idCliente).query(`
    SELECT Remate, Boleto, LEILAO, NomeVendedor, NomeComprador, Quantidade, Total,
      Valor_Liquido, Desconto, Lote_1, Lote_2, Lote_3, Peso, Comissao_Venda, Comissao_Compra,
      Valor_Desconto, Valor_Comissao_Compra, Valor_Comissao_Venda, DESCRICAO, CodVend, CodComp
    FROM VW_BOLETOS_LEGADO
    WHERE CodVend = @id OR CodComp = @id
  `);

  const totalPorLeilao: TotalLegadoPorLeilao[] = totais.recordset.map((r: any) => ({
    id: r.ID, leilao: r.leilao, totalVendas: r.TotalVendas || 0, totalCompras: r.TotalCompras || 0,
  }));

  const boletosLegado: BoletoLegado[] = boletos.recordset.map((r: any, i: number) => ({
    key: i, remate: r.Remate, boleto: r.Boleto, leilao: r.LEILAO,
    nomeVendedor: r.NomeVendedor, nomeComprador: r.NomeComprador,
    quantidade: r.Quantidade, total: r.Total, valorLiquido: r.Valor_Liquido, desconto: r.Desconto,
    lote1: r.Lote_1, lote2: r.Lote_2, lote3: r.Lote_3, peso: r.Peso,
    comissaoVenda: r.Comissao_Venda, comissaoCompra: r.Comissao_Compra,
    valorDesconto: r.Valor_Desconto, valorComissaoCompra: r.Valor_Comissao_Compra,
    valorComissaoVenda: r.Valor_Comissao_Venda, descricao: r.DESCRICAO,
    codVend: r.CodVend, codComp: r.CodComp,
  }));

  return { totalPorLeilao, boletos: boletosLegado };
}
