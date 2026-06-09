import { getPool } from '../config/database';

// ── Inicialização da tabela ──────────────────────────────────────────────────

async function ensureTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CONTRATOS_TEMPLATES' AND xtype='U')
    CREATE TABLE CONTRATOS_TEMPLATES (
      ID       INT IDENTITY(1,1) PRIMARY KEY,
      NOME     VARCHAR(200)    NOT NULL,
      TIPO     VARCHAR(50)     NULL,
      CONTEUDO NVARCHAR(MAX)   NOT NULL,
      ATIVO    BIT             DEFAULT 1,
      DATCRI   DATETIME        DEFAULT GETDATE()
    )
  `);
}

// ── CRUD Templates ───────────────────────────────────────────────────────────

export async function listarTemplates() {
  await ensureTable();
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT ID, NOME, TIPO, ATIVO, FORMAT(DATCRI,'dd/MM/yyyy') AS DATCRI
    FROM CONTRATOS_TEMPLATES
    ORDER BY NOME
  `);
  return r.recordset.map((t: any) => ({
    id:    t.ID,
    nome:  t.NOME,
    tipo:  t.TIPO,
    ativo: t.ATIVO,
    datcri: t.DATCRI,
  }));
}

export async function buscarTemplate(id: number) {
  await ensureTable();
  const pool = await getPool();
  const r = await pool.request()
    .input('id', id)
    .query(`SELECT ID, NOME, TIPO, CONTEUDO, ATIVO FROM CONTRATOS_TEMPLATES WHERE ID = @id`);
  const t = r.recordset[0];
  if (!t) throw new Error('Template não encontrado');
  return { id: t.ID, nome: t.NOME, tipo: t.TIPO, conteudo: t.CONTEUDO, ativo: t.ATIVO };
}

export async function criarTemplate(nome: string, tipo: string | null, conteudo: string) {
  await ensureTable();
  const pool = await getPool();
  const r = await pool.request()
    .input('nome', nome)
    .input('tipo', tipo)
    .input('conteudo', conteudo)
    .query(`
      INSERT INTO CONTRATOS_TEMPLATES (NOME, TIPO, CONTEUDO)
      OUTPUT INSERTED.ID
      VALUES (@nome, @tipo, @conteudo)
    `);
  return { id: r.recordset[0].ID };
}

export async function atualizarTemplate(id: number, nome: string, tipo: string | null, conteudo: string) {
  const pool = await getPool();
  await pool.request()
    .input('id', id)
    .input('nome', nome)
    .input('tipo', tipo)
    .input('conteudo', conteudo)
    .query(`
      UPDATE CONTRATOS_TEMPLATES
      SET NOME=@nome, TIPO=@tipo, CONTEUDO=@conteudo
      WHERE ID=@id
    `);
}

export async function deletarTemplate(id: number) {
  const pool = await getPool();
  await pool.request()
    .input('id', id)
    .query(`DELETE FROM CONTRATOS_TEMPLATES WHERE ID=@id`);
}

// ── Geração de contrato ──────────────────────────────────────────────────────

export async function gerarContrato(idMov: number, idCli: number, idTemplate: number) {
  const pool = await getPool();

  const [rTemplate, rDados, rParcelas] = await Promise.all([
    pool.request()
      .input('idTemplate', idTemplate)
      .query(`SELECT CONTEUDO FROM CONTRATOS_TEMPLATES WHERE ID=@idTemplate`),

    pool.request()
      .input('idMov', idMov)
      .input('idCli', idCli)
      .query(`
        SELECT
          MOV004.ID            AS CODCOMP,
          MOV004.IDMOVLOTE,
          FORMAT(MOV002.DATLAN,'dd/MM/yyyy')  AS DATLAN,
          FORMAT(GETDATE(),'dd/MM/yyyy')      AS HOJE,
          DATEPART(DAY,   GETDATE())          AS DIA,
          DATEPART(MONTH, GETDATE())          AS MES,
          DATEPART(YEAR,  GETDATE())          AS ANO,

          -- Comprador
          COMPRAD.NOMEXX   AS NOMCOM,
          COMPRAD.CPFXXX   AS CPFCOM,
          COMPRAD.CNPJXX   AS CNPJCOM,
          COMPRAD.ENDERE   AS ENDCOM,
          COMPRAD.BAIRRO   AS BAICOM,
          COMPRAD.CEPXXX   AS CEPCOM,
          COMPRAD.EMAILX   AS EMACOM,
          COMPRAD.TELCOM   AS COMCOM,
          COMPRAD.TELRES   AS RESCOM,
          COMPRAD.CELU_1   AS CL1COM,
          COMPRAD.ESTCIV,
          COMPRAD.PROFISS,
          COMPRAD.PAIXXX,
          COMPRAD.MAEXXX,
          CIDCOM.CIDADE    AS MUNCOM,
          CIDCOM.ESTADO    AS ESTCOM,

          -- Vendedor
          VENDED.NOMEXX    AS NOMVEN,
          VENDED.CPFXXX    AS CPFVEN,
          VENDED.CNPJXX    AS CNPJVEN,
          VENDED.ENDERE    AS ENDVEN,
          VENDED.BAIRRO    AS BAIVEN,
          VENDED.CEPXXX    AS CEPVEN,
          VENDED.TELCOM    AS COMVEN,
          VENDED.TELRES    AS RESVEN,
          VENDED.CELU_1    AS CL1VEN,
          CIDVEN.CIDADE    AS MUNVEN,
          CIDVEN.ESTADO    AS ESTVEN,

          -- Leilão
          CAD003.LEILAO,
          CAD003.LEILOE,
          FORMAT(CAD003.DATLEI,'dd/MM/yyyy') AS DATLEI,
          CIDLEI.CIDADE    AS CIDLEI,
          CIDLEI.ESTADO    AS ESTLEI,
          MOV001.CODNOT,

          -- Lote
          CAD002.DESLOT,
          CAD002.LOTEXX,
          CAD002.RPXXX,
          CAD002.SBBXXX,
          CAD002.CATEGO,
          CAD002.PELAGE,
          FORMAT(CAD002.DATNAS,'dd/MM/yyyy') AS DATNAS,
          CAD002.OBSLOT,
          ISNULL(CAD005.DESCRICAO,'')        AS DESRAC,

          -- Financeiro
          MOV004.VALORORIGINAL  AS VLRTOT,
          MOV004.VALORPAGAR     AS VLRLIQ,
          MOV002.VLRPAR,
          FIN002.DESFIN,
          FIN002.PARC01,
          FIN002.QTDPAR,

          -- Empresa
          (SELECT ISNULL(EMPRESA,'') FROM CONFIGURACOES) AS EMPRESA

        FROM MOVIMENTO_COMPRADOR MOV004
        JOIN MOVIMENTO           MOV001 ON MOV001.ID   = MOV004.IDMOV
        JOIN MOVIMENTO_LOTE      MOV002 ON MOV002.IDMOV = MOV001.ID
                                       AND MOV002.ID   = MOV004.IDMOVLOTE
        JOIN LEILOES             CAD003 ON CAD003.ID   = MOV001.IDLEILAO
        LEFT JOIN CIDADES        CIDLEI ON CIDLEI.ID   = CAD003.CODCID
        JOIN LOTES               CAD002 ON CAD002.ID   = MOV002.IDLOTE
        LEFT JOIN CLIENTES       VENDED ON VENDED.ID   = CAD002.CODVEN
        LEFT JOIN CIDADES        CIDVEN ON CIDVEN.ID   = VENDED.CIDADE
        LEFT JOIN CLIENTES       COMPRAD ON COMPRAD.ID = MOV004.IDCLI
        LEFT JOIN CIDADES        CIDCOM ON CIDCOM.ID   = COMPRAD.CIDADE
        LEFT JOIN RACAS          CAD005 ON CAD005.ID   = CAD002.RACAXX
        LEFT JOIN CONDICAOPAGTOS FIN002 ON FIN002.ID   = MOV004.IDCONDPAGTO
        WHERE MOV004.IDMOV = @idMov AND MOV004.IDCLI = @idCli
      `),

    pool.request()
      .input('idMov', idMov)
      .input('idCli', idCli)
      .query(`
        SELECT
          ORDXXX,
          FORMAT(DATVEN,'dd/MM/yyyy') AS DATVEN,
          VLRPAR,
          PRIPAR
        FROM MOVIMENTO_PARCELAMENTO
        WHERE IDMOV = @idMov AND IDCLI = @idCli
        ORDER BY ORDXXX
      `),
  ]);

  const tmpl = rTemplate.recordset[0];
  if (!tmpl) throw new Error('Template não encontrado');

  const d = rDados.recordset[0];
  if (!d) throw new Error('Dados do contrato não encontrados');

  const parcelas: any[] = rParcelas.recordset;
  const parcelasEntrada = parcelas.filter((p: any) => p.PRIPAR === 'S');
  const parcelasSaldo   = parcelas.filter((p: any) => p.PRIPAR !== 'S');

  const fmtR = (v?: number | null) =>
    v != null
      ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'R$ 0,00';

  const meses = ['','janeiro','fevereiro','março','abril','maio','junho',
                  'julho','agosto','setembro','outubro','novembro','dezembro'];

  const vars: Record<string, string> = {
    EMPRESA:       d.EMPRESA || '',
    LEILAO:        d.LEILAO  || '',
    LEILOE:        d.LEILOE  || '',
    CIDLEI:        d.CIDLEI  || '',
    ESTLEI:        d.ESTLEI  || '',
    DATLEI:        d.DATLEI  || '',
    DATLAN:        d.DATLAN  || '',
    DIA:           String(d.DIA),
    MES:           String(d.MES),
    MESEXTENSO:    meses[d.MES] || '',
    ANO:           String(d.ANO),

    NOMCOM:        d.NOMCOM  || '',
    CPFCOM:        d.CPFCOM  || d.CNPJCOM || '',
    ENDCOM:        d.ENDCOM  || '',
    BAICOM:        d.BAICOM  || '',
    CEPCOM:        d.CEPCOM  || '',
    MUNCOM:        d.MUNCOM  || '',
    ESTCOM:        d.ESTCOM  || '',
    EMACOM:        d.EMACOM  || '',
    FONCOM:        d.COMCOM  || d.RESCOM || d.CL1COM || '',
    ESTCIV:        d.ESTCIV  || '',
    PROFISS:       d.PROFISS || '',
    PAIXXX:        d.PAIXXX  || '',
    MAEXXX:        d.MAEXXX  || '',

    NOMVEN:        d.NOMVEN  || '',
    CPFVEN:        d.CPFVEN  || d.CNPJVEN || '',
    ENDVEN:        d.ENDVEN  || '',
    BAIVEN:        d.BAIVEN  || '',
    CEPVEN:        d.CEPVEN  || '',
    MUNVEN:        d.MUNVEN  || '',
    ESTVEN:        d.ESTVEN  || '',
    FONVEN:        d.COMVEN  || d.RESVEN || d.CL1VEN || '',

    LOTEXX:        String(d.LOTEXX || ''),
    DESLOT:        d.DESLOT  || '',
    RPXXXX:        d.RPXXX   || '',
    SBBXXX:        d.SBBXXX  || '',
    DATNAS:        d.DATNAS  || '',
    CATEGO:        d.CATEGO  || '',
    PELAGE:        d.PELAGE  || '',
    OBSLOT:        d.OBSLOT  || '',
    RACACOM:       d.DESRAC  || '',

    VLRTOT:        fmtR(d.VLRTOT),
    VLRLIQ:        fmtR(d.VLRLIQ),
    VLRPAR:        fmtR(d.VLRPAR),
    DESFIN:        d.DESFIN  || '',
    PARC01:        d.PARC01  ? `${d.PARC01}%` : '',
    QTDPARA:       String(d.QTDPAR || parcelasSaldo.length || ''),

    // Entrada
    PARCELAINICIAL: fmtR(parcelasEntrada.reduce((s: number, p: any) => s + Number(p.VLRPAR), 0) || null),
    EXTPRI:         '',
    PRIMEIRO_VENCIMENTO_DATA:  parcelasSaldo[0]?.DATVEN  || '',
    PRIMEIRO_VENCIMENTO_VALOR: fmtR(parcelasSaldo[0]?.VLRPAR),
    SALDOFINAL:    fmtR(parcelasSaldo.reduce((s: number, p: any) => s + Number(p.VLRPAR), 0) || null),

    CODNOT:        String(d.CODNOT || ''),
  };

  // Substituição
  let html: string = tmpl.CONTEUDO;
  for (const [k, v] of Object.entries(vars)) {
    html = html.split(`%${k}%`).join(v);
  }

  return { html, dados: vars };
}

// ── Variáveis disponíveis (para referência no editor) ────────────────────────

export const VARIAVEIS_DISPONIVEIS = [
  { grupo: 'Empresa',     vars: ['EMPRESA'] },
  { grupo: 'Leilão',      vars: ['LEILAO','LEILOE','CIDLEI','ESTLEI','DATLEI'] },
  { grupo: 'Data',        vars: ['DATLAN','DIA','MES','MESEXTENSO','ANO'] },
  { grupo: 'Comprador',   vars: ['NOMCOM','CPFCOM','ENDCOM','BAICOM','CEPCOM','MUNCOM','ESTCOM','EMACOM','FONCOM','ESTCIV','PROFISS','PAIXXX','MAEXXX'] },
  { grupo: 'Vendedor',    vars: ['NOMVEN','CPFVEN','ENDVEN','BAIVEN','CEPVEN','MUNVEN','ESTVEN','FONVEN'] },
  { grupo: 'Lote',        vars: ['LOTEXX','DESLOT','RACACOM','RPXXXX','SBBXXX','DATNAS','CATEGO','PELAGE','OBSLOT'] },
  { grupo: 'Financeiro',  vars: ['VLRTOT','VLRLIQ','VLRPAR','DESFIN','PARC01','QTDPARA'] },
  { grupo: 'Parcelas',    vars: ['PARCELAINICIAL','PRIMEIRO_VENCIMENTO_DATA','PRIMEIRO_VENCIMENTO_VALOR','SALDOFINAL'] },
];
