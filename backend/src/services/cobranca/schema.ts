import { getPool } from '../../config/database';
import { getBanco } from '../../config/bancoContext';

// Tabelas da Intermediação de Cobrança (prefixo COBR_). A leiloeira cobra, como serviço,
// as parcelas do vendedor que vêm depois das que ficam com o escritório (o "2 + 2"), nos
// lotes marcados. Criadas sob demanda como as CONC_; nenhuma tabela legada é alterada,
// só Configuracoes ganha as colunas do plano. Ativação: UPDATE Configuracoes SET COBR_ATIVA = 'S'
const prontos = new Set<string>();

const DDL = `
IF COL_LENGTH('Configuracoes', 'COBR_ATIVA') IS NULL
  ALTER TABLE Configuracoes ADD COBR_ATIVA CHAR(1) NULL;
IF COL_LENGTH('Configuracoes', 'COBR_TAXA_PADRAO') IS NULL
  ALTER TABLE Configuracoes ADD COBR_TAXA_PADRAO DECIMAL(5,2) NULL;

-- Padrão por vendedor: lotes novos dele já vêm marcados (PADRAO='S'), com este destino e taxa.
IF OBJECT_ID('COBR_VENDEDORES') IS NULL
CREATE TABLE COBR_VENDEDORES (
  ID_CLIENTE   INT PRIMARY KEY,
  PADRAO       CHAR(1)      NOT NULL DEFAULT 'N',
  DESTINO      VARCHAR(10)  NOT NULL DEFAULT 'VENDEDOR',
  TAXA         DECIMAL(5,2) NULL,
  ID_USUARIO   INT          NULL,
  NOME_USUARIO VARCHAR(100) NULL,
  DATA         DATETIME     NOT NULL DEFAULT GETDATE()
);

-- Lote em cobrança (LOTES.ID — vale para todas as vendas do lote, via MOVIMENTO_LOTE.IDLOTE).
-- PARC_INICIAL NULL = logo depois das parcelas do escritório (grupos da condição).
-- TAXA NULL = taxa do vendedor, ou a padrão da empresa.
IF OBJECT_ID('COBR_LOTES') IS NULL
CREATE TABLE COBR_LOTES (
  ID_LOTE      INT PRIMARY KEY,
  ATIVA        CHAR(1)      NOT NULL DEFAULT 'S',
  DESTINO      VARCHAR(10)  NOT NULL DEFAULT 'VENDEDOR',
  PARC_INICIAL INT          NULL,
  TAXA         DECIMAL(5,2) NULL,
  ID_USUARIO   INT          NULL,
  NOME_USUARIO VARCHAR(100) NULL,
  DATA         DATETIME     NOT NULL DEFAULT GETDATE()
);

-- Baixas feitas na Cobrança (as do extrato ficam em CONC_BAIXAS e também contam).
-- ORIGEM: MANUAL (recebimento informado) | ANTERIOR (quitada antes de entrar na cobrança, sem taxa).
-- RECEBIDO_EM: MACEDO | VENDEDOR — onde o dinheiro caiu (decide se a taxa é retida ou cobrada).
IF OBJECT_ID('COBR_BAIXAS') IS NULL
BEGIN
  CREATE TABLE COBR_BAIXAS (
    ID                INT IDENTITY(1,1) PRIMARY KEY,
    ID_PARCELA        INT           NOT NULL,
    DATA_PAGAMENTO    DATE          NOT NULL,
    VALOR             DECIMAL(18,2) NOT NULL,
    ORIGEM            VARCHAR(10)   NOT NULL,
    RECEBIDO_EM       VARCHAR(10)   NOT NULL,
    OBSERVACAO        VARCHAR(255)  NULL,
    ID_USUARIO        INT           NULL,
    NOME_USUARIO      VARCHAR(100)  NULL,
    DATA              DATETIME      NOT NULL DEFAULT GETDATE(),
    DESFEITA          CHAR(1)       NOT NULL DEFAULT 'N',
    ID_USUARIO_DESFEZ INT           NULL,
    DATA_DESFEITA     DATETIME      NULL
  );
  CREATE INDEX IX_COBR_BAIXAS_PARC ON COBR_BAIXAS (ID_PARCELA);
END

-- Tudo o que muda numa parcela ou num lote da cobrança: quem (Macedo ou o próprio
-- vendedor, pelo painel), quando, o valor de antes e o de depois.
IF OBJECT_ID('COBR_HISTORICO') IS NULL
BEGIN
  CREATE TABLE COBR_HISTORICO (
    ID           INT IDENTITY(1,1) PRIMARY KEY,
    ID_PARCELA   INT           NULL,
    ID_LOTE      INT           NULL,
    ACAO         VARCHAR(30)   NOT NULL,
    ANTES        VARCHAR(255)  NULL,
    DEPOIS       VARCHAR(255)  NULL,
    MOTIVO       VARCHAR(255)  NULL,
    AUTOR        VARCHAR(10)   NOT NULL DEFAULT 'MACEDO',
    ID_USUARIO   INT           NULL,
    NOME_USUARIO VARCHAR(100)  NULL,
    DATA         DATETIME      NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_COBR_HIST_PARC ON COBR_HISTORICO (ID_PARCELA);
  CREATE INDEX IX_COBR_HIST_LOTE ON COBR_HISTORICO (ID_LOTE);
END

-- Fechamento mensal por vendedor: parcelas recebidas no mês × taxa. SALDO > 0 = a
-- leiloeira repassa ao vendedor; SALDO < 0 = o vendedor paga a taxa à leiloeira.
IF OBJECT_ID('COBR_FECHAMENTOS') IS NULL
BEGIN
  CREATE TABLE COBR_FECHAMENTOS (
    ID                INT IDENTITY(1,1) PRIMARY KEY,
    ID_VENDEDOR       INT           NOT NULL,
    COMPETENCIA       CHAR(7)       NOT NULL,
    QTD_PARCELAS      INT           NOT NULL DEFAULT 0,
    RECEBIDO_MACEDO   DECIMAL(18,2) NOT NULL DEFAULT 0,
    RECEBIDO_VENDEDOR DECIMAL(18,2) NOT NULL DEFAULT 0,
    TAXA_RETIDA       DECIMAL(18,2) NOT NULL DEFAULT 0,
    TAXA_A_COBRAR     DECIMAL(18,2) NOT NULL DEFAULT 0,
    SALDO             DECIMAL(18,2) NOT NULL DEFAULT 0,
    SITUACAO          VARCHAR(10)   NOT NULL DEFAULT 'FECHADO',
    OBSERVACAO        VARCHAR(255)  NULL,
    DATA_FECHAMENTO   DATETIME      NOT NULL DEFAULT GETDATE(),
    DATA_COBRANCA     DATETIME      NULL,
    DATA_PAGAMENTO    DATETIME      NULL,
    ID_USUARIO        INT           NULL,
    NOME_USUARIO      VARCHAR(100)  NULL
  );
  CREATE UNIQUE INDEX UX_COBR_FECH ON COBR_FECHAMENTOS (ID_VENDEDOR, COMPETENCIA);
END

-- Cada baixa entra em um fechamento só (índice único por origem + baixa).
IF OBJECT_ID('COBR_FECHAMENTO_ITENS') IS NULL
BEGIN
  CREATE TABLE COBR_FECHAMENTO_ITENS (
    ID             INT IDENTITY(1,1) PRIMARY KEY,
    ID_FECHAMENTO  INT           NOT NULL,
    ORIGEM         VARCHAR(4)    NOT NULL,
    ID_BAIXA       INT           NOT NULL,
    ID_PARCELA     INT           NOT NULL,
    ID_LOTE        INT           NULL,
    RECEBIDO_EM    VARCHAR(10)   NOT NULL,
    DATA_PAGAMENTO DATE          NOT NULL,
    VALOR          DECIMAL(18,2) NOT NULL,
    TAXA_PERC      DECIMAL(5,2)  NOT NULL,
    TAXA_VALOR     DECIMAL(18,2) NOT NULL
  );
  CREATE UNIQUE INDEX UX_COBR_FECH_ITEM ON COBR_FECHAMENTO_ITENS (ORIGEM, ID_BAIXA);
  CREATE INDEX IX_COBR_FECH_ITEM_F ON COBR_FECHAMENTO_ITENS (ID_FECHAMENTO);
END

-- Fase 2: painel do cliente (/:banco/cliente) liberado pela leiloeira, por cliente.
IF COL_LENGTH('COBR_VENDEDORES', 'PORTAL') IS NULL
  ALTER TABLE COBR_VENDEDORES ADD PORTAL CHAR(1) NOT NULL CONSTRAINT DF_COBR_VEND_PORTAL DEFAULT 'N';

-- Link exclusivo do painel (sem senha): guarda só o hash SHA-256 do link; gerar outro ou
-- revogar invalida o anterior e as sessões abertas com ele. LINK_ERROS: confirmações erradas
-- dos dígitos do CPF/CNPJ (5 bloqueiam o link).
IF COL_LENGTH('COBR_VENDEDORES', 'LINK_HASH') IS NULL
  ALTER TABLE COBR_VENDEDORES ADD LINK_HASH CHAR(64) NULL, LINK_CRIADO DATETIME NULL,
    LINK_ERROS INT NOT NULL CONSTRAINT DF_COBR_VEND_LINK_ERROS DEFAULT 0, LINK_ULTIMO_ACESSO DATETIME NULL;
`;

export async function garantirTabelasCobranca(): Promise<void> {
  const banco = getBanco();
  if (prontos.has(banco)) return;
  const pool = await getPool();
  await pool.request().batch(DDL);
  prontos.add(banco);
}

/** As tabelas já existem neste banco? (sem criar — para quem só lê, como a conciliação) */
export async function existeCobranca(): Promise<boolean> {
  const banco = getBanco();
  if (prontos.has(banco)) return true;
  const pool = await getPool();
  const r = await pool.request().query(`SELECT OBJECT_ID('COBR_LOTES') AS X`);
  return r.recordset[0].X != null;
}
