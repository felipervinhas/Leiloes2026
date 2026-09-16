import { getPool, sql } from '../config/database';

export interface RelacaoCompradoresPropriedade {
  id: number;
  nomePropriedade?: string;
  cidade?: string;
  estado?: string;
  inscricao?: string;
  incra?: string;
}

export interface RelacaoCompradoresComprador {
  id: number;
  nomexx?: string;
  cpfxxx?: string;
  cnpjxx?: string;
  endere?: string;
  bairro?: string;
  cepxxx?: string;
  nomeCidade?: string;
  nomeEstado?: string;
  celu1?: string;
  celu2?: string;
  telcom?: string;
  telres?: string;
  emailx?: string;
  propriedades: RelacaoCompradoresPropriedade[];
}

export interface RelacaoCompradores {
  idLeilao: number;
  leilao?: string;
  datlei?: string;
  compradores: RelacaoCompradoresComprador[];
  totalPessoas: number;
  totalFazendas: number;
}

// A partir de MOVIMENTO_COMPRADOR.ID (mesmos ids já usados pela Fatura
// Unificada), resolve os compradores distintos e TODAS as propriedades
// cadastradas pra cada um — não só a vinculada àquela venda específica
// (ID_PROPRIEDADE), pois um comprador pode ter várias fazendas e o relatório
// (à imagem do usado por concorrentes) lista todas elas por comprador.
export async function dadosRelacaoCompradores(ids: number[]): Promise<RelacaoCompradores | null> {
  if (!ids.length) return null;
  const pool = await getPool();
  const req = pool.request();
  const placeholders = ids.map((id, i) => { req.input(`id${i}`, sql.Int, id); return `@id${i}`; });

  const rMc = await req.query(`
    SELECT DISTINCT M.IDLEILAO, LEI.LEILAO, LEI.DATLEI,
           C.ID AS ID_CLIENTE, C.NOMEXX, C.CPFXXX, C.CNPJXX, C.ENDERE, C.BAIRRO, C.CEPXXX,
           C.CELU_1, C.CELU_2, C.TELCOM, C.TELRES, C.EMAILX,
           CIDC.CIDADE AS NOMECIDADE, CIDC.ESTADO AS NOMEESTADO
    FROM MOVIMENTO_COMPRADOR MC
    LEFT JOIN MOVIMENTO M  ON M.ID  = MC.IDMOV
    LEFT JOIN LEILOES LEI  ON LEI.ID = M.IDLEILAO
    LEFT JOIN CLIENTES C   ON C.ID  = MC.IDCLI
    LEFT JOIN CIDADES CIDC ON CIDC.ID = C.CIDADE
    WHERE MC.ID IN (${placeholders.join(',')})
    ORDER BY C.NOMEXX
  `);
  if (!rMc.recordset.length) return null;

  const idsClientes = [...new Set(rMc.recordset.map((r: any) => r.ID_CLIENTE).filter((v: any) => v != null))];
  const propriedadesPorCliente: Record<number, RelacaoCompradoresPropriedade[]> = {};
  if (idsClientes.length) {
    const reqProp = pool.request();
    const phProp = idsClientes.map((id, i) => { reqProp.input(`c${i}`, sql.Int, id as number); return `@c${i}`; });
    const rProp = await reqProp.query(`
      SELECT ID, ID_CLIENTE, NOME_PROPRIEDADE, CIDADE, ESTADO, INSCRICAO, INCRA
      FROM CLIENTES_PROPRIEDADES
      WHERE ID_CLIENTE IN (${phProp.join(',')})
      ORDER BY NOME_PROPRIEDADE
    `);
    for (const p of rProp.recordset) {
      if (!propriedadesPorCliente[p.ID_CLIENTE]) propriedadesPorCliente[p.ID_CLIENTE] = [];
      propriedadesPorCliente[p.ID_CLIENTE].push({
        id: p.ID, nomePropriedade: p.NOME_PROPRIEDADE, cidade: p.CIDADE, estado: p.ESTADO,
        inscricao: p.INSCRICAO, incra: p.INCRA,
      });
    }
  }

  const primeira = rMc.recordset[0];
  const compradores: RelacaoCompradoresComprador[] = rMc.recordset.map((r: any) => ({
    id: r.ID_CLIENTE, nomexx: r.NOMEXX, cpfxxx: r.CPFXXX, cnpjxx: r.CNPJXX,
    endere: r.ENDERE, bairro: r.BAIRRO, cepxxx: r.CEPXXX,
    nomeCidade: r.NOMECIDADE, nomeEstado: r.NOMEESTADO,
    celu1: r.CELU_1, celu2: r.CELU_2, telcom: r.TELCOM, telres: r.TELRES, emailx: r.EMAILX,
    propriedades: propriedadesPorCliente[r.ID_CLIENTE] || [],
  }));

  return {
    idLeilao: primeira.IDLEILAO,
    leilao: primeira.LEILAO,
    datlei: primeira.DATLEI ? new Date(primeira.DATLEI).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined,
    compradores,
    totalPessoas: compradores.length,
    totalFazendas: compradores.reduce((a, c) => a + c.propriedades.length, 0),
  };
}
