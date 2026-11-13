import crypto from 'crypto';
import { getPool, sql } from '../../config/database';
import { ehParcelaDaLeiloeira, existeTabela, SQL_COLUNAS_GRUPOS } from '../conciliacao/devidoService';
import { CobrancaError, statusPlano } from './acessoService';
import { ehDaCobranca } from './parcelasService';
import { garantirTabelasCobranca } from './schema';

// Painel do cliente (/:banco/cliente). Como vendedor (recebimentos): SÓ os lotes dele na
// intermediação de cobrança (decisão de 2026-11-11 depois de ver o painel com todas as vendas).
// Como comprador (pagamentos): TODAS as compras — o que ele compra raramente é de lote em cobrança
// (é de outro vendedor), e sem isso a aba ficava vazia. Cada parcela
// diz quem cobra: o escritório (as iniciais, o "2 + 2"), a leiloeira pela intermediação de
// cobrança, ou o próprio vendedor (fora da cobrança — aí a situação não é controlada aqui).

export type QuemCobra = 'ESCRITORIO' | 'COBRANCA' | 'VENDEDOR';

const r2 = (v: number) => Math.round(v * 100) / 100;
const iso = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const soDigitos = (s: any) => String(s || '').replace(/\D/g, '');

/** Login do painel: CPF/CNPJ (com ou sem pontuação) ou e-mail + a mesma senha do app/site. */
export async function autenticar(login: string, senha: string) {
  if (!login || !senha) throw new CobrancaError(400, 'Informe o CPF/CNPJ e a senha');
  const { ativa } = await statusPlano();
  if (!ativa) throw new CobrancaError(402, 'Painel indisponível para esta empresa');
  const pool = await getPool();
  const doc = soDigitos(login);
  const req = pool.request().input('email', sql.VarChar, login.trim().toLowerCase());
  let cond = 'LOWER(LTRIM(RTRIM(C.EMAILX))) = @email';
  if (doc.length === 11 || doc.length === 14) {
    req.input('doc', sql.VarChar, doc);
    cond += ` OR REPLACE(REPLACE(REPLACE(C.CPFXXX, '.', ''), '-', ''), '/', '') = @doc
              OR REPLACE(REPLACE(REPLACE(C.CNPJXX, '.', ''), '-', ''), '/', '') = @doc`;
  }
  const r = await req.query(`
    SELECT C.ID, C.NOMEXX, C.SENHAX, C.ATIVOX, C.BLOCLI, ISNULL(V.PORTAL, 'N') AS PORTAL
    FROM CLIENTES C LEFT JOIN COBR_VENDEDORES V ON V.ID_CLIENTE = C.ID
    WHERE ${cond}`);
  // senha vazia nunca entra (cliente sem senha cadastrada)
  const c = r.recordset.find((x: any) => x.SENHAX && x.SENHAX === senha);
  if (!c) throw new CobrancaError(401, 'CPF/CNPJ ou senha incorretos');
  if (c.BLOCLI === 'Sim' || c.ATIVOX === 'N') throw new CobrancaError(403, 'Cadastro bloqueado. Fale com a leiloeira.');
  if (c.PORTAL !== 'S') throw new CobrancaError(403, 'Seu acesso ao painel ainda não foi liberado. Fale com a leiloeira.');
  return { idCliente: c.ID as number, nome: c.NOMEXX as string };
}

/**
 * O cliente continua liberado? (conferido a cada requisição: a leiloeira pode bloquear a qualquer
 * hora). Sessão aberta pelo link (lk = começo do hash do link): vale só enquanto o link for o mesmo
 * — gerar outro ou revogar derruba quem entrou pelo anterior.
 */
export async function aindaLiberado(idCliente: number, lk?: string): Promise<boolean> {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idCliente).query(`
    SELECT C.BLOCLI, C.ATIVOX, V.PORTAL, V.LINK_HASH, (SELECT TOP 1 COBR_ATIVA FROM Configuracoes) AS ATIVA
    FROM CLIENTES C LEFT JOIN COBR_VENDEDORES V ON V.ID_CLIENTE = C.ID WHERE C.ID = @id`);
  const x = r.recordset[0];
  if (!x || x.ATIVA !== 'S' || x.PORTAL !== 'S' || x.BLOCLI === 'Sim' || x.ATIVOX === 'N') return false;
  return !lk || (!!x.LINK_HASH && String(x.LINK_HASH).startsWith(lk));
}

// ─── link exclusivo (sem senha) ───────────────────────────────────────────────

const MAX_ERROS_LINK = 5;
const hashLink = (token: string) => crypto.createHash('sha256').update(String(token)).digest('hex');
const documentoDe = (x: { CNPJXX?: string; CPFXXX?: string }) => {
  const cnpj = soDigitos(x.CNPJXX);
  return cnpj.length === 14 ? { tipo: 'CNPJ' as const, digitos: cnpj } : { tipo: 'CPF' as const, digitos: soDigitos(x.CPFXXX) };
};

async function buscarPorLink(token: string) {
  if (!token || token.length < 30) return null;
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().input('h', sql.Char(64), hashLink(token)).query(`
    SELECT V.ID_CLIENTE, V.PORTAL, V.LINK_HASH, V.LINK_ERROS, C.NOMEXX, C.CPFXXX, C.CNPJXX, C.BLOCLI, C.ATIVOX
    FROM COBR_VENDEDORES V JOIN CLIENTES C ON C.ID = V.ID_CLIENTE WHERE V.LINK_HASH = @h`);
  return r.recordset[0] || null;
}

/** Gera (ou troca) o link do cliente e libera o painel. Devolve o token só agora: o banco guarda o hash. */
export async function gerarLink(idCliente: number): Promise<string> {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const c = await pool.request().input('id', sql.Int, idCliente).query(`SELECT CPFXXX, CNPJXX FROM CLIENTES WHERE ID = @id`);
  if (!c.recordset.length) throw new CobrancaError(404, 'Cliente não encontrado');
  if (documentoDe(c.recordset[0]).digitos.length < 11) throw new CobrancaError(400, 'O cadastro do cliente não tem CPF/CNPJ: é com ele que o cliente confirma o acesso.');
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.request().input('id', sql.Int, idCliente).input('h', sql.Char(64), hashLink(token)).query(`
    IF EXISTS (SELECT 1 FROM COBR_VENDEDORES WHERE ID_CLIENTE = @id)
      UPDATE COBR_VENDEDORES SET PORTAL = 'S', LINK_HASH = @h, LINK_CRIADO = GETDATE(), LINK_ERROS = 0, LINK_ULTIMO_ACESSO = NULL WHERE ID_CLIENTE = @id
    ELSE
      INSERT INTO COBR_VENDEDORES (ID_CLIENTE, PADRAO, DESTINO, PORTAL, LINK_HASH, LINK_CRIADO) VALUES (@id, 'N', 'VENDEDOR', 'S', @h, GETDATE())`);
  return token;
}

export async function revogarLink(idCliente: number) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  await pool.request().input('id', sql.Int, idCliente)
    .query(`UPDATE COBR_VENDEDORES SET LINK_HASH = NULL, LINK_CRIADO = NULL, LINK_ERROS = 0, LINK_ULTIMO_ACESSO = NULL WHERE ID_CLIENTE = @id`);
}

/** O que a tela do link precisa antes da confirmação: sem nome nem dado do cliente. */
export async function infoLink(token: string) {
  const x = await buscarPorLink(token);
  if (!x || x.PORTAL !== 'S') throw new CobrancaError(404, 'Este link não vale mais. Peça um novo à leiloeira.');
  if (x.LINK_ERROS >= MAX_ERROS_LINK) throw new CobrancaError(423, 'Este link foi bloqueado por tentativas erradas. Peça um novo à leiloeira.');
  return { tipo: documentoDe(x).tipo };
}

/** Confirma os 4 primeiros dígitos do CPF/CNPJ do dono do link. */
export async function confirmarLink(token: string, digitos: string) {
  const { ativa } = await statusPlano();
  if (!ativa) throw new CobrancaError(402, 'Painel indisponível para esta empresa');
  const x = await buscarPorLink(token);
  if (!x || x.PORTAL !== 'S') throw new CobrancaError(404, 'Este link não vale mais. Peça um novo à leiloeira.');
  if (x.LINK_ERROS >= MAX_ERROS_LINK) throw new CobrancaError(423, 'Este link foi bloqueado por tentativas erradas. Peça um novo à leiloeira.');
  if (x.BLOCLI === 'Sim' || x.ATIVOX === 'N') throw new CobrancaError(403, 'Cadastro bloqueado. Fale com a leiloeira.');
  const pool = await getPool();
  const doc = documentoDe(x);
  if (soDigitos(digitos).length !== 4 || doc.digitos.slice(0, 4) !== soDigitos(digitos)) {
    await pool.request().input('id', sql.Int, x.ID_CLIENTE).query(`UPDATE COBR_VENDEDORES SET LINK_ERROS = LINK_ERROS + 1 WHERE ID_CLIENTE = @id`);
    const restam = MAX_ERROS_LINK - x.LINK_ERROS - 1;
    throw new CobrancaError(restam > 0 ? 401 : 423, restam > 0
      ? `Dígitos não conferem. ${restam === 1 ? 'Resta 1 tentativa' : `Restam ${restam} tentativas`}.`
      : 'Dígitos errados demais: o link foi bloqueado. Peça um novo à leiloeira.');
  }
  await pool.request().input('id', sql.Int, x.ID_CLIENTE)
    .query(`UPDATE COBR_VENDEDORES SET LINK_ERROS = 0, LINK_ULTIMO_ACESSO = GETDATE() WHERE ID_CLIENTE = @id`);
  return { idCliente: x.ID_CLIENTE as number, nome: x.NOMEXX as string, lk: String(x.LINK_HASH).slice(0, 16) };
}

export interface ParcelaPortal {
  id: number;
  idMovLote: number;
  idLeilao: number | null;
  leilao: string | null;
  dataLeilao: string | null;
  lote: string | null;
  animal: string | null;
  vendedor: string | null;
  comprador: string | null;
  ordxxx: string;
  vencimento: string | null;
  valor: number;
  pago: number;
  saldo: number;
  dataPagamento: string | null;
  quemCobra: QuemCobra;
  /** onde pagar / onde cai o dinheiro, quando é a leiloeira que cobra */
  destino: 'MACEDO' | 'VENDEDOR' | null;
  /** situação controlada só na cobrança (no escritório, só "paga" quando há baixa); null = sem controle aqui */
  situacao: 'ABERTA' | 'VENCIDA' | 'PARCIAL' | 'PAGA' | 'QUITADA_ANTERIOR' | null;
  podeRenegociar: boolean;
}

/** Todas as parcelas do cliente como vendedor (lado = 'VENDEDOR') ou como comprador. */
export async function parcelasDoCliente(idCliente: number, lado: 'VENDEDOR' | 'COMPRADOR'): Promise<ParcelaPortal[]> {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const comGrupos = await existeTabela('CONC_CONDICAO_GRUPOS');
  const comConc = await existeTabela('CONC_BAIXAS');
  const r = await pool.request().input('c', sql.Int, idCliente).query(`
    SELECT P.ID, P.IDMOVLOTE, P.ORDXXX, P.VLRPAR, P.DATVEN, M.IDLEILAO, LE.LEILAO, LE.DATLEI,
           COALESCE(NULLIF(LTRIM(RTRIM(P.LOTEXX)), ''), LTRIM(RTRIM(ML.LOTEXX))) AS LOTEXX, LO.DESLOT,
           CV.NOMEXX AS VENDEDOR, CC.NOMEXX AS COMPRADOR,
           CL.ATIVA AS COBR_ATIVA, CL.DESTINO, CL.PARC_INICIAL,
           ISNULL(CB.VALOR, 0) AS PAGO_COBR, ISNULL(CB.ANTERIOR, 0) AS PAGO_ANTERIOR, CB.DATA AS DATA_COBR,
           ${comConc ? 'ISNULL(KB.VALOR, 0)' : '0'} AS PAGO_CONC, ${comConc ? 'KB.DATA' : 'NULL'} AS DATA_CONC,
           ${SQL_COLUNAS_GRUPOS(comGrupos)}
    FROM MOVIMENTO_PARCELAMENTO P
    JOIN MOVIMENTO_LOTE ML          ON ML.ID = P.IDMOVLOTE
    JOIN MOVIMENTO M                ON M.ID = P.IDMOV
    LEFT JOIN LEILOES LE            ON LE.ID = M.IDLEILAO
    LEFT JOIN LOTES LO              ON LO.ID = ML.IDLOTE
    LEFT JOIN CLIENTES CV           ON CV.ID = TRY_CAST(ML.CODVEN AS INT)
    LEFT JOIN CLIENTES CC           ON CC.ID = P.IDCLI
    LEFT JOIN COBR_LOTES CL         ON CL.ID_LOTE = ML.IDLOTE AND CL.ATIVA = 'S'
    LEFT JOIN MOVIMENTO_COMPRADOR MC ON MC.IDMOVLOTE = P.IDMOVLOTE AND MC.IDCLI = P.IDCLI
    LEFT JOIN CONDICAOPAGTOS CP     ON CP.ID = MC.IDCONDPAGTO
    ${comGrupos ? 'LEFT JOIN CONC_CONDICAO_GRUPOS G ON G.ID_CONDPAGTO = MC.IDCONDPAGTO' : ''}
    LEFT JOIN (SELECT ID_PARCELA, SUM(VALOR) AS VALOR, MAX(DATA_PAGAMENTO) AS DATA,
                      SUM(CASE WHEN ORIGEM = 'ANTERIOR' THEN VALOR ELSE 0 END) AS ANTERIOR
               FROM COBR_BAIXAS WHERE DESFEITA = 'N' GROUP BY ID_PARCELA) CB ON CB.ID_PARCELA = P.ID
    ${comConc ? `LEFT JOIN (SELECT B.ID_PARCELA, SUM(B.VALOR) AS VALOR, MAX(LC.DATA) AS DATA
               FROM CONC_BAIXAS B JOIN CONC_LANCAMENTOS LC ON LC.ID = B.ID_LANCAMENTO
               WHERE B.DESFEITA = 'N' AND B.TIPO_ALVO = 'PARCELA' GROUP BY B.ID_PARCELA) KB ON KB.ID_PARCELA = P.ID` : ''}
    WHERE ${lado === 'VENDEDOR' ? 'TRY_CAST(ML.CODVEN AS INT) = @c' : 'P.IDCLI = @c'}
      ${lado === 'VENDEDOR' ? 'AND CL.ID_LOTE IS NOT NULL' : ''}
    ORDER BY P.DATVEN, P.ID`);

  const hoje = new Date().toISOString().slice(0, 10);
  return r.recordset.map((x: any) => {
    const emCobranca = x.COBR_ATIVA === 'S' && ehDaCobranca(x);
    const doEscritorio = !emCobranca && ehParcelaDaLeiloeira({ ...x, PAGO_PARA: null });
    const quemCobra: QuemCobra = emCobranca ? 'COBRANCA' : doEscritorio ? 'ESCRITORIO' : 'VENDEDOR';
    const valor = r2(Number(x.VLRPAR) || 0);
    const pago = r2(Number(x.PAGO_COBR) + Number(x.PAGO_CONC));
    const saldo = r2(Math.max(0, valor - pago));
    const vencimento = iso(x.DATVEN);
    let situacao: ParcelaPortal['situacao'] = null;
    if (saldo <= 0.009) situacao = Number(x.PAGO_ANTERIOR) >= pago - 0.009 && pago > 0 ? 'QUITADA_ANTERIOR' : 'PAGA';
    else if (pago > 0.009) situacao = 'PARCIAL';
    // "em aberto/vencida" só para a cobrança, controlada de ponta a ponta. O escritório só tem
    // baixa do que foi conciliado no extrato (desde set/2026): sem baixa, não dá para dizer que está vencida.
    else if (quemCobra === 'COBRANCA') situacao = vencimento && vencimento < hoje ? 'VENCIDA' : 'ABERTA';
    const datas = [iso(x.DATA_COBR), iso(x.DATA_CONC)].filter(Boolean) as string[];
    return {
      id: x.ID, idMovLote: x.IDMOVLOTE, idLeilao: x.IDLEILAO, leilao: x.LEILAO, dataLeilao: iso(x.DATLEI),
      lote: x.LOTEXX || null, animal: x.DESLOT ? String(x.DESLOT).trim() : null,
      vendedor: x.VENDEDOR, comprador: x.COMPRADOR, ordxxx: String(x.ORDXXX || '').trim(), vencimento,
      valor, pago, saldo, dataPagamento: datas.sort().pop() || null, quemCobra,
      destino: emCobranca ? (x.DESTINO === 'MACEDO' ? 'MACEDO' : 'VENDEDOR') : doEscritorio ? 'MACEDO' : null,
      situacao,
      // só o vendedor renegocia, e só parcela em cobrança ainda com saldo
      podeRenegociar: lado === 'VENDEDOR' && emCobranca && saldo > 0.009,
    };
  });
}

/** A parcela é do cliente (como vendedor ou comprador)? Para o histórico e a renegociação. */
export async function exigirParcelaDoCliente(idParcela: number, idCliente: number, lado?: 'VENDEDOR' | 'COMPRADOR') {
  const pool = await getPool();
  const r = await pool.request().input('p', sql.Int, idParcela).query(`
    SELECT P.IDCLI, TRY_CAST(ML.CODVEN AS INT) AS ID_VENDEDOR FROM MOVIMENTO_PARCELAMENTO P
    JOIN MOVIMENTO_LOTE ML ON ML.ID = P.IDMOVLOTE WHERE P.ID = @p`);
  const x = r.recordset[0];
  const ehVendedor = x && x.ID_VENDEDOR === idCliente;
  const ehComprador = x && Number(x.IDCLI) === idCliente;
  if (lado === 'VENDEDOR' ? !ehVendedor : lado === 'COMPRADOR' ? !ehComprador : !(ehVendedor || ehComprador)) {
    throw new CobrancaError(404, 'Parcela não encontrada');
  }
}

/** Fechamento do vendedor logado (nunca o de outro). */
export async function exigirFechamentoDoCliente(idFechamento: number, idCliente: number) {
  const pool = await getPool();
  const r = await pool.request().input('f', sql.Int, idFechamento).query(`SELECT ID_VENDEDOR FROM COBR_FECHAMENTOS WHERE ID = @f`);
  if (r.recordset[0]?.ID_VENDEDOR !== idCliente) throw new CobrancaError(404, 'Fechamento não encontrado');
}

// ─── administração do acesso (área Cobrança) ─────────────────────────────────

/** Libera ou bloqueia o painel do cliente e, se informada, grava a senha (a mesma do app/site). */
export async function configurarAcesso(idCliente: number, d: { liberado: boolean; senha?: string }) {
  if (!idCliente) throw new CobrancaError(400, 'Informe o cliente');
  if (d.senha != null && d.senha.length > 0 && d.senha.length < 6) throw new CobrancaError(400, 'A senha precisa ter pelo menos 6 caracteres');
  await garantirTabelasCobranca();
  const pool = await getPool();
  const c = await pool.request().input('id', sql.Int, idCliente).query(`SELECT SENHAX FROM CLIENTES WHERE ID = @id`);
  if (!c.recordset.length) throw new CobrancaError(404, 'Cliente não encontrado');
  await pool.request().input('id', sql.Int, idCliente).input('p', sql.Char(1), d.liberado ? 'S' : 'N').query(`
    IF EXISTS (SELECT 1 FROM COBR_VENDEDORES WHERE ID_CLIENTE = @id)
      UPDATE COBR_VENDEDORES SET PORTAL = @p WHERE ID_CLIENTE = @id
    ELSE
      INSERT INTO COBR_VENDEDORES (ID_CLIENTE, PADRAO, DESTINO, PORTAL) VALUES (@id, 'N', 'VENDEDOR', @p)`);
  if (d.senha) {
    await pool.request().input('id', sql.Int, idCliente).input('s', sql.VarChar, d.senha)
      .query(`UPDATE CLIENTES SET SENHAX = @s WHERE ID = @id`);
  }
}

export async function statusAcesso(idCliente: number) {
  await garantirTabelasCobranca();
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, idCliente).query(`
    SELECT C.NOMEXX, C.CPFXXX, C.CNPJXX, C.EMAILX, C.CELU_1, C.CELU_2, CASE WHEN ISNULL(C.SENHAX, '') = '' THEN 0 ELSE 1 END AS TEM_SENHA,
           ISNULL(V.PORTAL, 'N') AS PORTAL, V.LINK_HASH, V.LINK_CRIADO, ISNULL(V.LINK_ERROS, 0) AS LINK_ERROS, V.LINK_ULTIMO_ACESSO
    FROM CLIENTES C LEFT JOIN COBR_VENDEDORES V ON V.ID_CLIENTE = C.ID WHERE C.ID = @id`);
  const x = r.recordset[0];
  if (!x) throw new CobrancaError(404, 'Cliente não encontrado');
  return {
    nome: x.NOMEXX, documento: x.CNPJXX || x.CPFXXX || null, email: x.EMAILX || null, celular: x.CELU_1 || x.CELU_2 || null,
    temSenha: !!x.TEM_SENHA, liberado: x.PORTAL === 'S',
    link: x.LINK_HASH ? { criado: x.LINK_CRIADO, bloqueado: x.LINK_ERROS >= MAX_ERROS_LINK, ultimoAcesso: x.LINK_ULTIMO_ACESSO } : null,
  };
}
