-- Migra INSEST (Inscrição Estadual) e PROPRI (nome da propriedade), campos legados
-- da tabela Clientes, para a tabela relacional CLIENTES_PROPRIEDADES.
-- Esses campos na tabela Clientes não são mais usados pelo novo layout.
-- Idempotente.

-- ── 1) Clientes SEM nenhuma propriedade cadastrada: cria uma linha nova ─────
-- (mesma lógica de migrar-propriedades-clientes.sql, agora incluindo INSCRICAO)
INSERT INTO CLIENTES_PROPRIEDADES (ID_CLIENTE, NOME_PROPRIEDADE, CIDADE, ESTADO, LOCALIDADE, INSCRICAO)
SELECT
  C.ID,
  NULLIF(LTRIM(RTRIM(C.PROPRI)), ''),
  CID.CIDADE,
  LEFT(CID.ESTADO, 2),
  NULLIF(LTRIM(RTRIM(CONCAT(
    ISNULL(LTRIM(RTRIM(C.ENDPRO)), ''),
    CASE WHEN LTRIM(RTRIM(ISNULL(C.CAIPRO, ''))) <> '' THEN ' ' + LTRIM(RTRIM(C.CAIPRO)) ELSE '' END,
    CASE WHEN LTRIM(RTRIM(ISNULL(C.BAIPRO, ''))) <> '' THEN ' - ' + LTRIM(RTRIM(C.BAIPRO)) ELSE '' END,
    CASE WHEN LTRIM(RTRIM(ISNULL(C.CEPPRO, ''))) <> '' THEN ' - CEP ' + LTRIM(RTRIM(C.CEPPRO)) ELSE '' END
  ))), ''),
  NULLIF(LTRIM(RTRIM(C.INSEST)), '')
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
    LTRIM(RTRIM(ISNULL(C.PROPRI, ''))) <> '' OR
    LTRIM(RTRIM(ISNULL(C.INSEST, ''))) <> ''
  );

-- ── 2) Clientes que JÁ têm exatamente 1 propriedade cadastrada: só preenche
-- a INSCRICAO se ainda estiver vazia (não mexe em nome/endereço já digitados
-- manualmente no novo layout).
UPDATE CP
SET CP.INSCRICAO = LTRIM(RTRIM(C.INSEST))
FROM CLIENTES_PROPRIEDADES CP
JOIN Clientes C ON C.ID = CP.ID_CLIENTE
WHERE LTRIM(RTRIM(ISNULL(C.INSEST, ''))) <> ''
  AND LTRIM(RTRIM(ISNULL(CP.INSCRICAO, ''))) = ''
  AND (SELECT COUNT(*) FROM CLIENTES_PROPRIEDADES CP2 WHERE CP2.ID_CLIENTE = C.ID) = 1;
