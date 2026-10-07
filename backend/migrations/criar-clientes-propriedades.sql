-- Cria CLIENTES_PROPRIEDADES nos bancos que ainda não têm (ex.: G2), com a mesma
-- estrutura da Knorr/Macedo. Sem ela, Consulta de Vendas, Fatura Unificada e o
-- cadastro de propriedades do cliente quebram ("Invalid object name").
-- Idempotente. Depois rodar migrar-insest-propri-para-propriedades.sql.

IF OBJECT_ID('CLIENTES_PROPRIEDADES') IS NULL
BEGIN
  CREATE TABLE CLIENTES_PROPRIEDADES (
    ID                 INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ID_CLIENTE         INT          NULL,
    INSCRICAO          VARCHAR(50)  NULL,
    NOME_PROPRIEDADE   VARCHAR(300) NULL,
    CIDADE             VARCHAR(200) NULL,
    ESTADO             VARCHAR(2)   NULL,
    LOCALIDADE         VARCHAR(400) NULL,
    CODIGO_PROPRIEDADE VARCHAR(20)  NULL,
    CEP                VARCHAR(9)   NULL,
    INCRA              VARCHAR(20)  NULL
  );
  PRINT 'Criada tabela CLIENTES_PROPRIEDADES';
END
GO
