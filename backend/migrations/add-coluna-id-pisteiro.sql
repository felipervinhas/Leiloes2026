-- Coluna do pisteiro no comprador da venda (MOVIMENTO_COMPRADOR.ID_PISTEIRO).
-- O backend a cria sozinho, mas até a correção de 13/10/2026 a criação era
-- marcada como feita para todos os bancos de uma vez: LoteRural (AgendaRemates)
-- e G2 ficaram sem a coluna e o "Adicionar comprador" da tela de Vendas falhava.
-- Rodar em LoteRural e G2 (nos outros não faz nada). Idempotente.

IF COL_LENGTH('MOVIMENTO_COMPRADOR', 'ID_PISTEIRO') IS NULL
BEGIN
  ALTER TABLE MOVIMENTO_COMPRADOR ADD ID_PISTEIRO INT NULL;
  PRINT 'Criada a coluna MOVIMENTO_COMPRADOR.ID_PISTEIRO';
END
ELSE
  PRINT 'Coluna MOVIMENTO_COMPRADOR.ID_PISTEIRO já existe';
GO
