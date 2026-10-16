import { getPool } from '../../config/database';
import { getBanco } from '../../config/bancoContext';

// Tabelas da Conciliação Bancária (prefixo CONC_). Criadas sob demanda em cada
// banco, como o resto do sistema faz — nenhuma tabela existente é alterada,
// só Configuracoes ganha as colunas do plano (CONC_ATIVA / CONC_PLANO).
const prontos = new Set<string>();

const DDL = `
IF COL_LENGTH('Configuracoes', 'CONC_ATIVA') IS NULL
  ALTER TABLE Configuracoes ADD CONC_ATIVA CHAR(1) NULL;
IF COL_LENGTH('Configuracoes', 'CONC_PLANO') IS NULL
  ALTER TABLE Configuracoes ADD CONC_PLANO VARCHAR(20) NULL;

IF OBJECT_ID('CONC_CONTAS') IS NULL
CREATE TABLE CONC_CONTAS (
  ID           INT IDENTITY(1,1) PRIMARY KEY,
  BANCO        VARCHAR(10)  NOT NULL,
  AGENCIA      VARCHAR(20)  NULL,
  CONTA        VARCHAR(30)  NULL,
  ACCTID       VARCHAR(40)  NOT NULL,
  CNPJ_TITULAR VARCHAR(20)  NULL,
  DESCRICAO    VARCHAR(100) NULL,
  ATIVA        CHAR(1)      NOT NULL DEFAULT 'S',
  DATA_INCLUSAO DATETIME    NOT NULL DEFAULT GETDATE()
);

IF OBJECT_ID('CONC_IMPORTACOES') IS NULL
CREATE TABLE CONC_IMPORTACOES (
  ID               INT IDENTITY(1,1) PRIMARY KEY,
  ID_CONTA         INT          NOT NULL,
  ARQUIVO          VARCHAR(255) NULL,
  HASH_ARQUIVO     CHAR(64)     NOT NULL,
  DT_INICIO        DATE         NULL,
  DT_FIM           DATE         NULL,
  SALDO_FINAL      DECIMAL(18,2) NULL,
  QTD_LANCAMENTOS  INT          NOT NULL DEFAULT 0,
  QTD_NOVOS        INT          NOT NULL DEFAULT 0,
  ID_USUARIO       INT          NULL,
  NOME_USUARIO     VARCHAR(100) NULL,
  DATA             DATETIME     NOT NULL DEFAULT GETDATE()
);

IF OBJECT_ID('CONC_LANCAMENTOS') IS NULL
BEGIN
  CREATE TABLE CONC_LANCAMENTOS (
    ID               INT IDENTITY(1,1) PRIMARY KEY,
    ID_CONTA         INT          NOT NULL,
    ID_IMPORTACAO    INT          NOT NULL,
    FITID            VARCHAR(60)  NOT NULL,
    DATA             DATE         NOT NULL,
    VALOR            DECIMAL(18,2) NOT NULL,
    SENTIDO          CHAR(1)      NOT NULL,
    MEMO             VARCHAR(255) NULL,
    DOC_CONTRAPARTE  VARCHAR(14)  NULL,
    NOME_CONTRAPARTE VARCHAR(120) NULL,
    ID_CLIENTE       INT          NULL,
    SITUACAO         VARCHAR(12)  NOT NULL DEFAULT 'PENDENTE',
    CATEGORIA        VARCHAR(60)  NULL
  );
  CREATE UNIQUE INDEX UX_CONC_LANC_FITID ON CONC_LANCAMENTOS (ID_CONTA, FITID);
  CREATE INDEX IX_CONC_LANC_DATA ON CONC_LANCAMENTOS (ID_CONTA, DATA);
END

IF OBJECT_ID('CONC_BAIXAS') IS NULL
BEGIN
  CREATE TABLE CONC_BAIXAS (
    ID                INT IDENTITY(1,1) PRIMARY KEY,
    ID_LANCAMENTO     INT          NOT NULL,
    TIPO_ALVO         VARCHAR(20)  NOT NULL,
    ID_PARCELA        INT          NULL,
    ID_MOV_COMPRADOR  INT          NULL,
    ID_VENDEDOR       INT          NULL,
    ID_LEILAO         INT          NULL,
    VALOR             DECIMAL(18,2) NOT NULL,
    REGRA             VARCHAR(20)  NOT NULL,
    ID_USUARIO        INT          NULL,
    NOME_USUARIO      VARCHAR(100) NULL,
    DATA              DATETIME     NOT NULL DEFAULT GETDATE(),
    DESFEITA          CHAR(1)      NOT NULL DEFAULT 'N',
    ID_USUARIO_DESFEZ INT          NULL,
    DATA_DESFEITA     DATETIME     NULL
  );
  CREATE INDEX IX_CONC_BAIXAS_LANC ON CONC_BAIXAS (ID_LANCAMENTO);
END

IF OBJECT_ID('CONC_PAGADORES') IS NULL
CREATE TABLE CONC_PAGADORES (
  ID         INT IDENTITY(1,1) PRIMARY KEY,
  DOC        VARCHAR(14)  NOT NULL,
  NOME       VARCHAR(120) NULL,
  ID_CLIENTE INT          NOT NULL,
  ID_USUARIO INT          NULL,
  DATA       DATETIME     NOT NULL DEFAULT GETDATE()
);

IF OBJECT_ID('CONC_IGNORAR') IS NULL
CREATE TABLE CONC_IGNORAR (
  ID           INT IDENTITY(1,1) PRIMARY KEY,
  DOC          VARCHAR(14)  NULL,
  PADRAO_MEMO  VARCHAR(100) NULL,
  CATEGORIA    VARCHAR(60)  NOT NULL,
  ID_USUARIO   INT          NULL,
  DATA         DATETIME     NOT NULL DEFAULT GETDATE()
);

-- etapa 2: sugestão do casamento guardada no lançamento e baixa de repasse ligada
-- ao lançamento de fechamento (DESPESAS tipo F) do Acerto do Vendedor
IF COL_LENGTH('CONC_LANCAMENTOS', 'SUGESTAO') IS NULL
  ALTER TABLE CONC_LANCAMENTOS ADD SUGESTAO VARCHAR(MAX) NULL;
IF COL_LENGTH('CONC_BAIXAS', 'ID_DESPESA') IS NULL
  ALTER TABLE CONC_BAIXAS ADD ID_DESPESA INT NULL;

-- Despesas da empresa (débito do extrato que não é de venda nem de cliente: aluguel de
-- veículo, seguro, telefone...). Categorias são da empresa; as iniciais vêm prontas.
IF OBJECT_ID('CONC_CATEGORIAS') IS NULL
BEGIN
  CREATE TABLE CONC_CATEGORIAS (
    ID    INT IDENTITY(1,1) PRIMARY KEY,
    NOME  VARCHAR(60) NOT NULL,
    ATIVA CHAR(1)     NOT NULL DEFAULT 'S'
  );
  INSERT INTO CONC_CATEGORIAS (NOME) VALUES
    ('Aluguel de veículos'), ('Telefone e internet'), ('Seguros'), ('Tarifas bancárias'),
    ('Gráfica e impressos'), ('Associações e entidades'), ('Impostos e taxas'),
    ('Combustível e viagens'), ('Outras despesas');
END

IF OBJECT_ID('CONC_DESPESAS_EMPRESA') IS NULL
BEGIN
  CREATE TABLE CONC_DESPESAS_EMPRESA (
    ID             INT IDENTITY(1,1) PRIMARY KEY,
    ID_LANCAMENTO  INT          NULL,
    ID_CATEGORIA   INT          NOT NULL,
    FORNECEDOR     VARCHAR(120) NULL,
    DOC_FORNECEDOR VARCHAR(14)  NULL,
    DATA           DATE         NOT NULL,
    VALOR          DECIMAL(18,2) NOT NULL,
    ID_LEILAO      INT          NULL,
    OBSERVACAO     VARCHAR(255) NULL,
    ID_USUARIO     INT          NULL,
    NOME_USUARIO   VARCHAR(100) NULL,
    DATA_INCLUSAO  DATETIME     NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_CONC_DESP_EMP_DATA ON CONC_DESPESAS_EMPRESA (DATA);
END

-- regra aprendida que já classifica como despesa da empresa (e não só "não é venda")
IF COL_LENGTH('CONC_IGNORAR', 'ID_CATEGORIA') IS NULL
  ALTER TABLE CONC_IGNORAR ADD ID_CATEGORIA INT NULL;

IF OBJECT_ID('CONC_CONDICAO_GRUPOS') IS NULL
CREATE TABLE CONC_CONDICAO_GRUPOS (
  ID_CONDPAGTO     INT PRIMARY KEY,
  GRUPOS_LEILOEIRA INT NOT NULL
);
`;

export async function garantirTabelasConciliacao(): Promise<void> {
  const banco = getBanco();
  if (prontos.has(banco)) return;
  const pool = await getPool();
  await pool.request().batch(DDL);
  prontos.add(banco);
}
