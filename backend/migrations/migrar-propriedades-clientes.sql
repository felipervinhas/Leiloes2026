-- Migra os campos legados de "endereço da propriedade" (PROPRI/ENDPRO/BAIPRO/CIDPRO/CEPPRO/CAIPRO)
-- da tabela Clientes para a tabela relacional CLIENTES_PROPRIEDADES.
-- PROPRI = campo "Estabelecimento" da seção "Dados Produtor Rural" do Delphi -> nome da propriedade.
-- Idempotente: só considera clientes que ainda não possuem nenhuma propriedade cadastrada.

-- ── 1) PREVIEW — rode primeiro para revisar o que será migrado ──────────────
SELECT
  C.ID                                   AS ID_CLIENTE,
  C.NOMEXX                               AS NOME_CLIENTE,
  NULLIF(LTRIM(RTRIM(C.PROPRI)), '')     AS NOME_PROPRIEDADE,
  CID.CIDADE                             AS CIDADE,
  LEFT(CID.ESTADO, 2)                    AS ESTADO,
  NULLIF(LTRIM(RTRIM(CONCAT(
    ISNULL(LTRIM(RTRIM(C.ENDPRO)), ''),
    CASE WHEN LTRIM(RTRIM(ISNULL(C.CAIPRO, ''))) <> '' THEN ' ' + LTRIM(RTRIM(C.CAIPRO)) ELSE '' END,
    CASE WHEN LTRIM(RTRIM(ISNULL(C.BAIPRO, ''))) <> '' THEN ' - ' + LTRIM(RTRIM(C.BAIPRO)) ELSE '' END,
    CASE WHEN LTRIM(RTRIM(ISNULL(C.CEPPRO, ''))) <> '' THEN ' - CEP ' + LTRIM(RTRIM(C.CEPPRO)) ELSE '' END
  ))), '')                               AS LOCALIDADE
FROM Clientes C
LEFT JOIN Cidades CID ON CID.ID = C.CIDPRO
WHERE
  NOT EXISTS (SELECT 1 FROM CLIENTES_PROPRIEDADES CP WHERE CP.ID_CLIENTE = C.ID)
  AND (
    LTRIM(RTRIM(ISNULL(C.ENDPRO, ''))) <> '' OR
    LTRIM(RTRIM(ISNULL(C.BAIPRO, ''))) <> '' OR
    C.CIDPRO IS NOT NULL OR
    LTRIM(RTRIM(ISNULL(C.CEPPRO, ''))) <> '' OR
    LTRIM(RTRIM(ISNULL(C.CAIPRO, ''))) <> '' OR
    LTRIM(RTRIM(ISNULL(C.PROPRI, ''))) <> ''
  );

-- ── 2) MIGRAÇÃO — só execute depois de revisar o preview acima ──────────────
-- INSERT INTO CLIENTES_PROPRIEDADES (ID_CLIENTE, NOME_PROPRIEDADE, CIDADE, ESTADO, LOCALIDADE)
-- SELECT
--   C.ID,
--   NULLIF(LTRIM(RTRIM(C.PROPRI)), ''),
--   CID.CIDADE,
--   LEFT(CID.ESTADO, 2),
--   NULLIF(LTRIM(RTRIM(CONCAT(
--     ISNULL(LTRIM(RTRIM(C.ENDPRO)), ''),
--     CASE WHEN LTRIM(RTRIM(ISNULL(C.CAIPRO, ''))) <> '' THEN ' ' + LTRIM(RTRIM(C.CAIPRO)) ELSE '' END,
--     CASE WHEN LTRIM(RTRIM(ISNULL(C.BAIPRO, ''))) <> '' THEN ' - ' + LTRIM(RTRIM(C.BAIPRO)) ELSE '' END,
--     CASE WHEN LTRIM(RTRIM(ISNULL(C.CEPPRO, ''))) <> '' THEN ' - CEP ' + LTRIM(RTRIM(C.CEPPRO)) ELSE '' END
--   ))), '')
-- FROM Clientes C
-- LEFT JOIN Cidades CID ON CID.ID = C.CIDPRO
-- WHERE
--   NOT EXISTS (SELECT 1 FROM CLIENTES_PROPRIEDADES CP WHERE CP.ID_CLIENTE = C.ID)
--   AND (
--     LTRIM(RTRIM(ISNULL(C.ENDPRO, ''))) <> '' OR
--     LTRIM(RTRIM(ISNULL(C.BAIPRO, ''))) <> '' OR
--     C.CIDPRO IS NOT NULL OR
--     LTRIM(RTRIM(ISNULL(C.CEPPRO, ''))) <> '' OR
--     LTRIM(RTRIM(ISNULL(C.CAIPRO, ''))) <> '' OR
--     LTRIM(RTRIM(ISNULL(C.PROPRI, ''))) <> ''
--   );
