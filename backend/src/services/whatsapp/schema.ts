import { getPool } from '../../config/database';
import { getBanco } from '../../config/bancoContext';

// Tabelas do envio de WhatsApp (prefixo WPP_). Criadas sob demanda em cada banco,
// como a Conciliação faz — nenhuma tabela existente é alterada, só Configuracoes
// ganha WPP_ATIVA (o módulo é ligado por nós, direto no banco:
// UPDATE Configuracoes SET WPP_ATIVA = 'S').
const prontos = new Set<string>();

const DDL = `
IF COL_LENGTH('Configuracoes', 'WPP_ATIVA') IS NULL
  ALTER TABLE Configuracoes ADD WPP_ATIVA CHAR(1) NULL;

IF OBJECT_ID('WPP_CONFIG') IS NULL
CREATE TABLE WPP_CONFIG (
  ID               INT IDENTITY(1,1) PRIMARY KEY,
  PHONE_NUMBER_ID  VARCHAR(40)   NULL,
  WABA_ID          VARCHAR(40)   NULL,
  TOKEN            VARCHAR(1000) NULL,
  APP_SECRET       VARCHAR(100)  NULL,
  VERIFY_TOKEN     VARCHAR(100)  NULL,
  API_VERSION      VARCHAR(10)   NOT NULL DEFAULT 'v25.0',
  LIMITE_DIARIO    INT           NOT NULL DEFAULT 250,
  MSGS_POR_MINUTO  INT           NOT NULL DEFAULT 60,
  PRECO_MARKETING  DECIMAL(9,4)  NOT NULL DEFAULT 0.35,
  PRECO_UTILIDADE  DECIMAL(9,4)  NOT NULL DEFAULT 0.04,
  MSG_OPTOUT       NVARCHAR(500) NULL,
  ATUALIZADO_EM    DATETIME      NULL,
  ATUALIZADO_POR   VARCHAR(100)  NULL
);

IF OBJECT_ID('WPP_CAMPANHAS') IS NULL
CREATE TABLE WPP_CAMPANHAS (
  ID                 INT IDENTITY(1,1) PRIMARY KEY,
  NOME               NVARCHAR(150) NOT NULL,
  TEMPLATE_NOME      VARCHAR(512)  NOT NULL,
  TEMPLATE_IDIOMA    VARCHAR(15)   NOT NULL,
  TEMPLATE_CATEGORIA VARCHAR(20)   NULL,
  TEMPLATE_TEXTO     NVARCHAR(MAX) NULL,
  PUBLICO_JSON       NVARCHAR(MAX) NULL,
  MAPEAMENTO_JSON    NVARCHAR(MAX) NULL,
  ID_LEILAO          INT           NULL,
  STATUS             VARCHAR(20)   NOT NULL,
  AGENDADA_PARA      DATETIME      NULL,
  TOTAL              INT           NOT NULL DEFAULT 0,
  CUSTO_ESTIMADO     DECIMAL(12,2) NULL,
  ULTIMO_ERRO        NVARCHAR(500) NULL,
  CRIADA_EM          DATETIME      NOT NULL DEFAULT GETUTCDATE(),
  CRIADA_POR         VARCHAR(100)  NULL,
  ID_USUARIO         INT           NULL,
  INICIADA_EM        DATETIME      NULL,
  CONCLUIDA_EM       DATETIME      NULL
);

IF OBJECT_ID('WPP_ENVIOS') IS NULL
BEGIN
  CREATE TABLE WPP_ENVIOS (
    ID                BIGINT IDENTITY(1,1) PRIMARY KEY,
    ID_CAMPANHA       INT           NOT NULL,
    ID_CLIENTE        INT           NULL,
    NOME              NVARCHAR(150) NULL,
    TELEFONE          VARCHAR(20)   NOT NULL,
    CHAVE             VARCHAR(20)   NOT NULL,
    COMPONENTES       NVARCHAR(MAX) NULL,
    STATUS            VARCHAR(20)   NOT NULL,
    TENTATIVAS        INT           NOT NULL DEFAULT 0,
    PROXIMA_TENTATIVA DATETIME      NULL,
    WAMID             VARCHAR(100)  NULL,
    ERRO_CODIGO       INT           NULL,
    ERRO              NVARCHAR(500) NULL,
    ENVIADO_EM        DATETIME      NULL,
    ENTREGUE_EM       DATETIME      NULL,
    LIDO_EM           DATETIME      NULL,
    ATUALIZADO_EM     DATETIME      NULL
  );
  CREATE INDEX IX_WPP_ENVIOS_CAMPANHA ON WPP_ENVIOS (ID_CAMPANHA, STATUS);
  CREATE INDEX IX_WPP_ENVIOS_FILA     ON WPP_ENVIOS (STATUS, PROXIMA_TENTATIVA);
  CREATE INDEX IX_WPP_ENVIOS_WAMID    ON WPP_ENVIOS (WAMID);
  CREATE INDEX IX_WPP_ENVIOS_CHAVE    ON WPP_ENVIOS (CHAVE, ENVIADO_EM);
END

IF OBJECT_ID('WPP_MENSAGENS') IS NULL
BEGIN
  -- Conversa: E = recebida do cliente, S = resposta enviada pela tela
  CREATE TABLE WPP_MENSAGENS (
    ID           BIGINT IDENTITY(1,1) PRIMARY KEY,
    DIRECAO      CHAR(1)       NOT NULL,
    WAMID        VARCHAR(100)  NULL,
    CHAVE        VARCHAR(20)   NOT NULL,
    TELEFONE     VARCHAR(20)   NOT NULL,
    NOME_PERFIL  NVARCHAR(150) NULL,
    ID_CLIENTE   INT           NULL,
    TIPO         VARCHAR(20)   NULL,
    TEXTO        NVARCHAR(MAX) NULL,
    DATA_HORA    DATETIME      NOT NULL DEFAULT GETUTCDATE(),
    LIDA         CHAR(1)       NOT NULL DEFAULT 'N',
    USUARIO      VARCHAR(100)  NULL
  );
  CREATE INDEX IX_WPP_MENSAGENS_CHAVE ON WPP_MENSAGENS (CHAVE, DATA_HORA);
  CREATE INDEX IX_WPP_MENSAGENS_WAMID ON WPP_MENSAGENS (WAMID);
END

IF OBJECT_ID('WPP_OPTOUT') IS NULL
CREATE TABLE WPP_OPTOUT (
  CHAVE       VARCHAR(20)   NOT NULL PRIMARY KEY,
  TELEFONE    VARCHAR(20)   NOT NULL,
  ID_CLIENTE  INT           NULL,
  NOME        NVARCHAR(150) NULL,
  ORIGEM      VARCHAR(20)   NOT NULL,
  MOTIVO      NVARCHAR(300) NULL,
  DATA        DATETIME      NOT NULL DEFAULT GETUTCDATE()
);
`;

export async function garantirTabelasWhatsapp(): Promise<void> {
  const banco = getBanco();
  if (prontos.has(banco)) return;
  const pool = await getPool();
  await pool.request().batch(DDL);
  prontos.add(banco);
}

/** Usado pela fila: não cria nada, só diz se o banco já tem o módulo instalado. */
export async function whatsappInstalado(): Promise<boolean> {
  const banco = getBanco();
  if (prontos.has(banco)) return true;
  const pool = await getPool();
  const r = await pool.request().query(`SELECT CASE WHEN OBJECT_ID('WPP_ENVIOS') IS NULL THEN 0 ELSE 1 END AS OK`);
  return r.recordset[0]?.OK === 1;
}
