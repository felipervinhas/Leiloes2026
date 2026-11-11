import { getPool, sql } from '../../config/database';
import { CobrancaError, UsuarioCobranca } from './acessoService';
import { listarParcelas, registrarHistorico } from './parcelasService';
import { garantirTabelasCobranca } from './schema';

export interface ConfigLote {
  ativa: boolean;
  destino: 'MACEDO' | 'VENDEDOR';
  parcInicial: number | null;
  taxa: number | null;
}

const iso = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const r2 = (v: number) => Math.round(v * 100) / 100;
const destinoValido = (d: any): 'MACEDO' | 'VENDEDOR' => (d === 'MACEDO' ? 'MACEDO' : 'VENDEDOR');
const descreverConfig = (c: { DESTINO?: string; PARC_INICIAL?: number | null; TAXA?: number | null } | ConfigLote) => {
  const destino = 'destino' in c ? c.destino : c.DESTINO;
  const parc = 'parcInicial' in c ? c.parcInicial : c.PARC_INICIAL;
  const taxa = 'taxa' in c ? c.taxa : c.TAXA;
  return `conta ${destino === 'MACEDO' ? 'da leiloeira' : 'do vendedor'} · ${parc ? `a partir da ${parc}ª` : 'depois das do escritório'} · taxa ${taxa != null ? `${Number(taxa)}%` : 'padrão'}`;
};

/** Lotes do vendedor (vendidos ou não) com a marcação da cobrança e o resumo das parcelas. */
export async function lotesDoVendedor(idVendedor: number, f: { soVendidos?: boolean; idLeilao?: number } = {}) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const req = pool.request().input('v', sql.Int, idVendedor);
  if (f.idLeilao) req.input('lei', sql.Int, f.idLeilao);
  const r = await req.query(`
    SELECT LO.ID, LO.LOTEXX, LO.DESLOT, LO.IDLEILAO, LE.LEILAO, LE.DATLEI,
           S.VENDAS, S.TOTAL, S.QTDPAR, CL.ATIVA, CL.DESTINO, CL.PARC_INICIAL, CL.TAXA, CL.DATA AS DATA_COBR
    FROM LOTES LO
    LEFT JOIN LEILOES LE ON LE.ID = LO.IDLEILAO
    OUTER APPLY (SELECT COUNT(*) AS VENDAS, SUM(VLRTOT) AS TOTAL, MAX(QTDPAR) AS QTDPAR
                 FROM MOVIMENTO_LOTE WHERE IDLOTE = LO.ID) S
    LEFT JOIN COBR_LOTES CL ON CL.ID_LOTE = LO.ID
    WHERE (LO.CODVEN = @v OR EXISTS (SELECT 1 FROM MOVIMENTO_LOTE X WHERE X.IDLOTE = LO.ID AND TRY_CAST(X.CODVEN AS INT) = @v))
      ${f.soVendidos ? 'AND S.VENDAS > 0' : ''}
      ${f.idLeilao ? 'AND LO.IDLEILAO = @lei' : ''}
    ORDER BY LE.DATLEI DESC, LO.IDLEILAO DESC, TRY_CAST(LO.LOTEXX AS INT), LO.LOTEXX`);

  const parcelas = await listarParcelas({ idVendedor });
  const hoje = new Date().toISOString().slice(0, 10);
  const porLote = new Map<number, { emAberto: number; valorEmAberto: number; vencidas: number; pagas: number; total: number }>();
  for (const p of parcelas) {
    const a = porLote.get(p.idLote) || { emAberto: 0, valorEmAberto: 0, vencidas: 0, pagas: 0, total: 0 };
    a.total++;
    if (p.saldo > 0.009) { a.emAberto++; a.valorEmAberto = r2(a.valorEmAberto + p.saldo); if (p.vencimento && p.vencimento < hoje) a.vencidas++; }
    else a.pagas++;
    porLote.set(p.idLote, a);
  }
  return r.recordset.map((x: any) => ({
    idLote: x.ID, lote: x.LOTEXX ? String(x.LOTEXX).trim() : null, animal: x.DESLOT ? String(x.DESLOT).trim() : null,
    idLeilao: x.IDLEILAO, leilao: x.LEILAO, dataLeilao: iso(x.DATLEI),
    vendas: Number(x.VENDAS) || 0, total: Number(x.TOTAL) || 0, qtdParcelas: x.QTDPAR ? Number(x.QTDPAR) : null,
    cobranca: x.ATIVA === 'S'
      ? { ativa: true, destino: destinoValido(x.DESTINO), parcInicial: x.PARC_INICIAL ?? null, taxa: x.TAXA != null ? Number(x.TAXA) : null, desde: x.DATA_COBR }
      : null,
    parcelas: porLote.get(x.ID) || null,
  }));
}

/** Configuração do lote para a tela de Lotes (null = fora da cobrança). */
export async function configDoLote(idLote: number) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idLote)
    .query(`SELECT ATIVA, DESTINO, PARC_INICIAL, TAXA FROM COBR_LOTES WHERE ID_LOTE = @id`);
  const x = r.recordset[0];
  if (!x || x.ATIVA !== 'S') return null;
  return { ativa: true, destino: destinoValido(x.DESTINO), parcInicial: x.PARC_INICIAL ?? null, taxa: x.TAXA != null ? Number(x.TAXA) : null };
}

/** Marca, altera ou tira (ativa=false) lotes da cobrança, guardando o antes/depois no histórico. */
export async function salvarLotes(idLotes: number[], c: ConfigLote, usuario: UsuarioCobranca) {
  if (!idLotes?.length) throw new CobrancaError(400, 'Nenhum lote informado');
  if (c.taxa != null && (c.taxa < 0 || c.taxa > 100)) throw new CobrancaError(400, 'Taxa deve estar entre 0 e 100%');
  if (c.parcInicial != null && c.parcInicial < 1) throw new CobrancaError(400, 'Parcela inicial inválida');
  await garantirTabelasCobranca();
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const idLote of [...new Set(idLotes)]) {
      const atual = (await new sql.Request(tx).input('id', sql.Int, idLote)
        .query(`SELECT ATIVA, DESTINO, PARC_INICIAL, TAXA FROM COBR_LOTES WHERE ID_LOTE = @id`)).recordset[0];
      const estavaAtiva = atual?.ATIVA === 'S';
      if (!c.ativa && !estavaAtiva) continue;
      await new sql.Request(tx)
        .input('id', sql.Int, idLote).input('ativa', sql.Char(1), c.ativa ? 'S' : 'N')
        .input('dest', sql.VarChar(10), destinoValido(c.destino)).input('parc', sql.Int, c.parcInicial ?? null)
        .input('taxa', sql.Decimal(5, 2), c.taxa ?? null)
        .input('uid', sql.Int, usuario.id ?? null).input('unome', sql.VarChar(100), usuario.nome ?? null)
        .query(atual
          ? `UPDATE COBR_LOTES SET ATIVA=@ativa, DESTINO=@dest, PARC_INICIAL=@parc, TAXA=@taxa, ID_USUARIO=@uid, NOME_USUARIO=@unome,
               DATA = CASE WHEN ATIVA = 'S' THEN DATA ELSE GETDATE() END WHERE ID_LOTE=@id`
          : `INSERT INTO COBR_LOTES (ID_LOTE, ATIVA, DESTINO, PARC_INICIAL, TAXA, ID_USUARIO, NOME_USUARIO)
             VALUES (@id, @ativa, @dest, @parc, @taxa, @uid, @unome)`);
      const depois = descreverConfig(c);
      if (!c.ativa) await registrarHistorico({ idLote, acao: 'LOTE_REMOVIDO', antes: descreverConfig(atual), usuario }, tx);
      else if (!estavaAtiva) await registrarHistorico({ idLote, acao: 'LOTE_INCLUIDO', depois, usuario }, tx);
      else if (descreverConfig(atual) !== depois) await registrarHistorico({ idLote, acao: 'LOTE_ALTERADO', antes: descreverConfig(atual), depois, usuario }, tx);
    }
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }
}

// ─── padrão por vendedor ──────────────────────────────────────────────────────

export async function listarVendedores() {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT V.ID_CLIENTE, C.NOMEXX, V.PADRAO, V.DESTINO, V.TAXA, V.PORTAL, V.NOME_USUARIO, V.DATA,
           CASE WHEN ISNULL(C.SENHAX, '') = '' THEN 0 ELSE 1 END AS TEM_SENHA,
           (SELECT COUNT(*) FROM COBR_LOTES CL JOIN LOTES LO ON LO.ID = CL.ID_LOTE
            WHERE CL.ATIVA = 'S' AND LO.CODVEN = V.ID_CLIENTE) AS LOTES
    FROM COBR_VENDEDORES V LEFT JOIN CLIENTES C ON C.ID = V.ID_CLIENTE
    ORDER BY C.NOMEXX`);
  return r.recordset.map((x: any) => ({
    idCliente: x.ID_CLIENTE, nome: x.NOMEXX, padrao: x.PADRAO === 'S', destino: destinoValido(x.DESTINO),
    taxa: x.TAXA != null ? Number(x.TAXA) : null, lotes: Number(x.LOTES) || 0, usuario: x.NOME_USUARIO, data: x.DATA,
    portal: x.PORTAL === 'S', temSenha: !!x.TEM_SENHA,
  }));
}

export async function padraoDoVendedor(idCliente: number) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idCliente)
    .query(`SELECT PADRAO, DESTINO, TAXA FROM COBR_VENDEDORES WHERE ID_CLIENTE = @id`);
  const x = r.recordset[0];
  if (!x) return null;
  return { padrao: x.PADRAO === 'S', destino: destinoValido(x.DESTINO), taxa: x.TAXA != null ? Number(x.TAXA) : null };
}

export async function salvarVendedor(idCliente: number, d: { padrao: boolean; destino: string; taxa: number | null }, usuario: UsuarioCobranca) {
  if (!idCliente) throw new CobrancaError(400, 'Informe o vendedor');
  if (d.taxa != null && (d.taxa < 0 || d.taxa > 100)) throw new CobrancaError(400, 'Taxa deve estar entre 0 e 100%');
  await garantirTabelasCobranca();
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, idCliente).input('padrao', sql.Char(1), d.padrao ? 'S' : 'N')
    .input('dest', sql.VarChar(10), destinoValido(d.destino)).input('taxa', sql.Decimal(5, 2), d.taxa ?? null)
    .input('uid', sql.Int, usuario.id ?? null).input('unome', sql.VarChar(100), usuario.nome ?? null)
    .query(`
      IF EXISTS (SELECT 1 FROM COBR_VENDEDORES WHERE ID_CLIENTE = @id)
        UPDATE COBR_VENDEDORES SET PADRAO=@padrao, DESTINO=@dest, TAXA=@taxa, ID_USUARIO=@uid, NOME_USUARIO=@unome, DATA=GETDATE() WHERE ID_CLIENTE=@id
      ELSE
        INSERT INTO COBR_VENDEDORES (ID_CLIENTE, PADRAO, DESTINO, TAXA, ID_USUARIO, NOME_USUARIO) VALUES (@id, @padrao, @dest, @taxa, @uid, @unome)`);
}

export async function excluirVendedor(idCliente: number) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  await pool.request().input('id', sql.Int, idCliente).query(`DELETE FROM COBR_VENDEDORES WHERE ID_CLIENTE = @id`);
}

export async function salvarTaxaPadrao(taxa: number) {
  if (!(taxa >= 0 && taxa <= 100)) throw new CobrancaError(400, 'Taxa deve estar entre 0 e 100%');
  await garantirTabelasCobranca();
  const pool = await getPool();
  await pool.request().input('t', sql.Decimal(5, 2), taxa).query(`UPDATE Configuracoes SET COBR_TAXA_PADRAO = @t`);
}
