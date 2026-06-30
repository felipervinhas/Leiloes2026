import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import lacrePromissoria from '../assets/lacre_promissoria.png';
import { FaturaData } from './RelatorioFaturaCompra';

interface Props {
  dados: FaturaData;
  empresa?: string;
}

// ─── Valor por extenso ────────────────────────────────────────────────────────

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
                  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS  = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cem', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
                  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function bloco(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const cStr = c > 0 ? CENTENAS[c] : '';
  if (resto === 0) return cStr;
  if (resto < 20) return (cStr ? cStr + ' e ' : '') + UNIDADES[resto];
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const dStr = DEZENAS[d] + (u > 0 ? ' e ' + UNIDADES[u] : '');
  return (cStr ? cStr + ' e ' : '') + dStr;
}

function extensoInteiro(n: number): string {
  if (n === 0) return 'zero';
  const bi  = Math.floor(n / 1_000_000_000);
  const mi  = Math.floor((n % 1_000_000_000) / 1_000_000);
  const mil = Math.floor((n % 1_000_000) / 1_000);
  const res = n % 1_000;
  const p: string[] = [];
  if (bi  > 0) p.push(bloco(bi)  + (bi  === 1 ? ' bilhão'  : ' bilhões'));
  if (mi  > 0) p.push(bloco(mi)  + (mi  === 1 ? ' milhão'  : ' milhões'));
  if (mil > 0) p.push(mil === 1 ? 'mil' : bloco(mil) + ' mil');
  if (res > 0) p.push(bloco(res));
  return p.join(' e ');
}

function valorExtenso(valor: number): string {
  if (!valor || valor <= 0) return 'zero reais';
  const reais    = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);
  const rStr     = extensoInteiro(reais) + (reais === 1 ? ' real' : ' reais');
  if (centavos === 0) return rStr;
  return rStr + ' e ' + extensoInteiro(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

const fmtR = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

const MESES_EXT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Backend envia datas já em "DD/MM/YYYY". new Date() não parseia esse formato.
function parseDate(s?: string | null): Date | null {
  if (!s || s === '—') return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const fmtData = (iso?: string | null) => {
  if (!iso || iso === '—') return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso; // já formatado
  const d = parseDate(iso);
  return d ? d.toLocaleDateString('pt-BR') : '—';
};

const fmtDataExtenso = (iso?: string | null) => {
  const d = parseDate(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MESES_EXT[d.getMonth()]} ${d.getFullYear()}`;
};

const CATEGO: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

// ─── Paleta monocromática (safe para impressão P&B) ──────────────────────────

const PRETO  = '#000';
const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';
const CLARO  = '#f0f0f0';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: ESCURO,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: '#fff',
  },

  // ── Cabeçalho ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: PRETO,
    paddingBottom: 5,
    marginBottom: 6,
  },
  headerEsq: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  empresa: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRETO },
  empresaSub: { fontSize: 6, color: MEDIO, marginTop: 1 },
  headerDir: { alignItems: 'flex-end' },
  docTitulo: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: PRETO },
  docNota: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: ESCURO, marginTop: 1 },
  docData: { fontSize: 6.5, color: MEDIO, marginTop: 1 },

  // ── Bloco leilão ──
  leilaoBox: {
    backgroundColor: ESCURO,
    borderRadius: 3,
    padding: '4 8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  leilaoLabel: { fontSize: 5.5, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  leilaoNome:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff', marginTop: 1 },
  leilaoData:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ddd' },

  // ── Duas colunas: Lote + Vendedor ──
  duasColunas: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  colLote: {
    flex: 1.1, backgroundColor: CLARO, borderRadius: 3,
    padding: 6, borderWidth: 0.5, borderColor: CINZA,
  },
  colVendedor: {
    flex: 1, backgroundColor: CLARO, borderRadius: 3,
    padding: 6, borderWidth: 0.5, borderColor: CINZA,
  },
  secLabel: {
    fontSize: 5, fontFamily: 'Helvetica-Bold', color: ESCURO,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 3, paddingBottom: 2,
    borderBottomWidth: 0.5, borderBottomColor: CINZA,
  },
  secLabelOrange: {
    fontSize: 5, fontFamily: 'Helvetica-Bold', color: ESCURO,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 3, paddingBottom: 2,
    borderBottomWidth: 0.5, borderBottomColor: CINZA,
  },
  loteNum:  { fontSize: 12, fontFamily: 'Helvetica-Bold', color: PRETO },
  loteDes:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO, marginBottom: 1 },
  loteInfo: { fontSize: 6.5, color: MEDIO, marginBottom: 1 },
  nomeXX:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO, marginBottom: 1 },
  cpfXX:    { fontSize: 7, color: ESCURO, marginBottom: 1 },
  endereXX: { fontSize: 6.5, color: MEDIO, marginBottom: 1 },

  // ── Comprador ──
  compradorBox: {
    backgroundColor: CLARO, borderRadius: 3,
    borderWidth: 0.5, borderColor: CINZA,
    padding: 5, marginBottom: 5,
  },
  secLabelGreen: {
    fontSize: 5, fontFamily: 'Helvetica-Bold', color: ESCURO,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 3, paddingBottom: 2,
    borderBottomWidth: 0.5, borderBottomColor: CINZA,
  },
  comprRow: { flexDirection: 'row', gap: 12 },
  comprCol: { flex: 1 },

  // ── Acerto financeiro ──
  acertoBox: {
    backgroundColor: '#fafafa', borderRadius: 3,
    borderWidth: 0.5, borderColor: CINZA,
    padding: '4 6', marginBottom: 5,
    flexDirection: 'row', flexWrap: 'wrap', gap: 0,
  },
  acertoItem: { width: '25%', marginBottom: 3 },
  acertoLabel: { fontSize: 5.5, color: MEDIO, marginBottom: 1 },
  acertoVal:        { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO },
  acertoValBlue:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO },
  acertoValGreen:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO },
  acertoValOrange:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: ESCURO },

  // ── Tabela de parcelas (4 grupos por linha) ──
  tabelaBox: {
    borderRadius: 3, borderWidth: 0.5, borderColor: CINZA,
    marginBottom: 6, overflow: 'hidden',
  },
  tabelaHeader: {
    backgroundColor: ESCURO, flexDirection: 'row',
    paddingVertical: 2, paddingHorizontal: 4,
  },
  tabelaRow: {
    flexDirection: 'row', paddingVertical: 1.5, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: CLARO,
  },
  tabelaRowAlt: { backgroundColor: '#fafafa' },
  tabelaTotal: {
    backgroundColor: CLARO, flexDirection: 'row',
    paddingVertical: 3, paddingHorizontal: 4,
  },

  // grupo de 4 células dentro de uma linha
  cGrupo:    { flex: 1, flexDirection: 'row' },
  cGrupoSep: { borderLeftWidth: 0.5, borderLeftColor: CINZA, paddingLeft: 3 },
  cNum:  { width: 20 },
  cData: { flex: 1 },
  cValor:{ width: 56, textAlign: 'right' },

  th:      { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' },
  td:      { fontSize: 6.5, color: ESCURO },
  tdRight: { fontSize: 6.5, color: ESCURO, textAlign: 'right' },
  tdBold:  { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PRETO },
  tdBoldRight: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PRETO, textAlign: 'right' },

  // ── Promissória única ──
  promBox: {
    borderWidth: 1, borderColor: '#555', borderRadius: 3,
    padding: 8, marginTop: 2,
  },
  promTitulo: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRETO,
    textAlign: 'center', letterSpacing: 1,
    marginBottom: 5, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: PRETO,
  },
  // linha principal: lacre (esq, altura total) + conteúdo (dir)
  promBodyRow: {
    flexDirection: 'row', gap: 8,
  },
  promDecorBox: {
    width: 44, alignSelf: 'stretch', objectFit: 'contain',
  },
  promConteudo: { flex: 1 },
  // lote + valor dentro do conteúdo
  promHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 6,
  },
  promLoteLabel: { fontSize: 6.5, color: MEDIO },
  promLoteNum:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: PRETO },
  promValorGrande: {
    fontSize: 13, fontFamily: 'Helvetica-Bold', color: PRETO,
    textAlign: 'right',
  },
  // corpo
  promTexto: {
    fontSize: 8, lineHeight: 1.6, color: '#222',
    textAlign: 'justify', marginBottom: 5,
    fontFamily: 'Helvetica-Bold',
  },
  promLocalData: {
    fontSize: 7.5, color: '#222', textAlign: 'right',
    marginBottom: 6,
  },
  // linha inferior: dados do comprador (esq) + assinatura (dir)
  promRodape: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
  },
  promComprDados: {
    flex: 1,
  },
  promComprNome:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111' },
  promComprLinha: { fontSize: 7, color: '#444', marginTop: 1 },
  // assinatura
  promAssinItem: { alignItems: 'center', width: 190 },
  promAssinLinha: { borderTopWidth: 0.5, borderTopColor: '#333', width: '100%', marginBottom: 3 },
  promAssinNome: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#222', textAlign: 'center' },
  promAssinRole: { fontSize: 7, color: '#555', textAlign: 'center' },

  // ── Rodapé ──
  footer: {
    position: 'absolute', bottom: 10, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: CINZA, paddingTop: 3,
  },
  footerText: { fontSize: 6, color: '#bbb' },
});

// ─── Seções reutilizáveis ─────────────────────────────────────────────────────

function InfoItem({ label, value, style }: { label: string; value?: string | null; style?: any }) {
  return (
    <View style={s.acertoItem}>
      <Text style={s.acertoLabel}>{label}</Text>
      <Text style={style ?? s.acertoVal}>{value || '—'}</Text>
    </View>
  );
}

// ─── Documento ───────────────────────────────────────────────────────────────

function PromissoriaPDF({ dados, empresa }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  // Uma página por comprador (caso haja múltiplos compradores)
  return (
    <Document
      title={`Promissória — Nota ${dados.codnot || dados.id}`}
      author={nomeEmpresa}
    >
      {dados.compradores.map((comp, ci) => {
        const totalParcelas = comp.parcelas.reduce((a, p) => a + (p.vlrpar ?? 0), 0);
        const totalValor    = comp.valorPagar ?? totalParcelas;
        const extenso       = valorExtenso(totalValor).toUpperCase();
        const credor        = dados.lote?.nomeVendedor || nomeEmpresa;
        const cpfCredor     = dados.lote?.cpfVendedor;

        const endereVend = [
          dados.lote?.endereVendedor,
          dados.lote?.bairroVendedor,
          dados.lote?.cidadeVendedor,
          dados.lote?.estadoVendedor,
        ].filter(Boolean).join(', ');

        return (
          <Page key={ci} size="A4" style={s.page}>

            {/* ── CABEÇALHO ── */}
            <View style={s.header}>
              <View style={s.headerEsq}>
                <Image src={logotipoLocal} style={s.logo} />
                <View>
                  <Text style={s.empresa}>{nomeEmpresa}</Text>

                </View>
              </View>
              <View style={s.headerDir}>
                <Text style={s.docTitulo}>PROMISSÓRIA</Text>
                <Text style={s.docNota}>Nota de Leilão Nº {dados.codnot || String(dados.id)}</Text>
                <Text style={s.docData}>Emitido em {agora}</Text>
              </View>
            </View>

            {/* ── LEILÃO ── */}
            <View style={s.leilaoBox}>
              <View>
                <Text style={s.leilaoLabel}>Leilão</Text>
                <Text style={s.leilaoNome}>{dados.leilao || '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.leilaoLabel}>Data do Leilão</Text>
                <Text style={s.leilaoData}>{fmtData(dados.datlei)}</Text>
              </View>
            </View>

            {/* ── LOTE + VENDEDOR ── */}
            {dados.lote && (
              <View style={s.duasColunas}>
                {/* Lote */}
                <View style={s.colLote}>
                  <Text style={s.secLabel}>Lote</Text>
                  <Text style={s.loteNum}>{dados.lote.lotexx || '—'}</Text>
                  <Text style={s.loteDes}>{dados.lote.deslot || '—'}</Text>
                  {dados.lote.descricaoRaca ? (
                    <Text style={s.loteInfo}>{dados.lote.descricaoRaca}{dados.lote.especies ? ` / ${dados.lote.especies}` : ''}</Text>
                  ) : null}
                  {dados.lote.catego  ? <Text style={s.loteInfo}>Sexo: {CATEGO[dados.lote.catego] || dados.lote.catego}</Text> : null}
                  {dados.lote.rpxxx   ? <Text style={s.loteInfo}>RP: {dados.lote.rpxxx}</Text> : null}
                  {dados.lote.sbbxxx  ? <Text style={s.loteInfo}>SBB: {dados.lote.sbbxxx}</Text> : null}
                  {dados.lote.pesoxx  ? <Text style={s.loteInfo}>Peso: {dados.lote.pesoxx} kg</Text> : null}
                  {dados.lote.qtdxxx  ? (
                    <Text style={s.loteInfo}>
                      Qtd: {Number(dados.lote.qtdxxx).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} cabeças
                    </Text>
                  ) : null}
                </View>

                {/* Vendedor (Credor) */}
                <View style={s.colVendedor}>
                  <Text style={s.secLabelOrange}>Vendedor</Text>
                  <Text style={s.nomeXX}>{dados.lote.nomeVendedor || '—'}</Text>
                  <Text style={s.cpfXX}>CPF: {dados.lote.cpfVendedor || 'não informado'}</Text>
                  {endereVend ? <Text style={s.endereXX}>{endereVend}</Text> : null}
                  {dados.lote.cepVendedor ? <Text style={s.endereXX}>CEP {dados.lote.cepVendedor}</Text> : null}
                  {dados.lote.celularVendedor || dados.lote.telresVendedor ? (
                    <Text style={s.endereXX}>
                      Tel: {dados.lote.celularVendedor || dados.lote.telresVendedor}
                    </Text>
                  ) : null}
                  {dados.lote.emailVendedor ? (
                    <Text style={s.endereXX}>{dados.lote.emailVendedor}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ── COMPRADOR ── */}
            <View style={s.compradorBox}>
              <Text style={s.secLabelGreen}>
                Comprador{dados.compradores.length > 1 ? ` ${ci + 1}` : ''}
              </Text>
              <View style={s.comprRow}>
                <View style={s.comprCol}>
                  <Text style={s.nomeXX}>{comp.nomexx || '—'}</Text>
                  <Text style={s.cpfXX}>CPF: {comp.cpfxxx || 'não informado'}</Text>
                  {comp.endere  ? <Text style={s.endereXX}>{[comp.endere, comp.bairro].filter(Boolean).join(', ')}</Text> : null}
                  {comp.nomeCidade ? (
                    <Text style={s.endereXX}>
                      {comp.nomeCidade}{comp.nomeEstado ? `/${comp.nomeEstado}` : ''}
                      {comp.cepxxx ? `  CEP ${comp.cepxxx}` : ''}
                    </Text>
                  ) : null}
                  {comp.celu1   ? <Text style={s.endereXX}>Tel: {comp.celu1}</Text> : null}
                  {comp.emailx  ? <Text style={s.endereXX}>{comp.emailx}</Text> : null}
                </View>
                {comp.nomePropriedade ? (
                  <View style={s.comprCol}>
                    <Text style={[s.acertoLabel, { marginBottom: 2 }]}>Propriedade de Destino</Text>
                    <Text style={s.nomeXX}>{comp.nomePropriedade}</Text>
                    {comp.cidadeProp ? (
                      <Text style={s.endereXX}>
                        {comp.cidadeProp}{comp.estadoProp ? `/${comp.estadoProp}` : ''}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── ACERTO FINANCEIRO ── */}
            <View style={s.acertoBox}>
              <InfoItem label="Cond. de Pagamento"  value={comp.desfin} />

              <InfoItem label="Valor Total"         value={fmtR(comp.valorOriginal)} style={s.acertoValBlue} />
              <InfoItem label="Comissão Leiloeiro"  value={comp.comissao != null ? `${comp.comissao}%` : '—'} style={s.acertoValOrange} />
              <InfoItem label="Vlr. Comissão"       value={fmtR(comp.valorComissao)} style={s.acertoValOrange} />
              <InfoItem label="Desconto"            value={fmtR(comp.valorDesconto)} />
              <InfoItem label="Valor Líquido"       value={fmtR(comp.valorPagar)} style={s.acertoValGreen} />
              {comp.percen != null && comp.percen !== 100 ? (
                <InfoItem label="% do Lote" value={`${comp.percen}%`} />
              ) : null}
            </View>

            {/* ── TABELA DE PARCELAS (4 grupos por linha) ── */}
            {(() => {
              const parc = comp.parcelas;
              // agrupa em linhas de 4
              const linhas: (typeof parc[0] | null)[][] = [];
              for (let i = 0; i < parc.length; i += 4) {
                linhas.push([parc[i] ?? null, parc[i + 1] ?? null, parc[i + 2] ?? null, parc[i + 3] ?? null]);
              }
              return (
                <View style={s.tabelaBox}>
                  {/* Cabeçalho — 4 grupos */}
                  <View style={s.tabelaHeader}>
                    {[0, 1, 2, 3].map(g => (
                      <View key={g} style={[s.cGrupo, g > 0 ? s.cGrupoSep : {}]}>
                        <View style={s.cNum}><Text style={s.th}>#</Text></View>
                        <View style={s.cData}><Text style={s.th}>Vencimento</Text></View>
                        <View style={s.cValor}><Text style={s.thRight}>Valor</Text></View>
                      </View>
                    ))}
                  </View>

                  {parc.length === 0 ? (
                    <Text style={{ padding: 10, textAlign: 'center', fontSize: 7.5, color: '#aaa', fontStyle: 'italic' }}>
                      Parcelas ainda não geradas
                    </Text>
                  ) : (
                    linhas.map((linha, li) => (
                      <View key={li} wrap={false}
                        style={[s.tabelaRow, li % 2 === 1 ? s.tabelaRowAlt : {}]}>
                        {linha.map((p, gi) => (
                          <View key={gi} style={[s.cGrupo, gi > 0 ? s.cGrupoSep : {}]}>
                            {p ? (
                              <>
                                <View style={s.cNum}>
                                  <Text style={p.pripar === 'S' ? s.tdBold : s.td}>
                                    {p.ordxxx ?? String(li * 4 + gi + 1).padStart(2, '0')}
                                  </Text>
                                </View>
                                <View style={s.cData}>
                                  <Text style={p.pripar === 'S' ? s.tdBold : s.td}>
                                    {fmtData(p.datven)}
                                  </Text>
                                </View>
                                <View style={s.cValor}>
                                  <Text style={p.pripar === 'S' ? s.tdBoldRight : s.tdRight}>
                                    {fmtR(p.vlrpar)}
                                  </Text>
                                </View>
                              </>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ))
                  )}

                  {/* Total */}
                  {parc.length > 0 && (
                    <View style={s.tabelaTotal}>
                      <Text style={{ flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>
                        {(() => {
                          const qtd = comp.qtdparCond ?? parc.length;
                          return `TOTAL — ${qtd} parcela${qtd !== 1 ? 's' : ''}`;
                        })()}
                      </Text>
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO }}>
                        {fmtR(totalParcelas)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* ── NOTA PROMISSÓRIA ÚNICA ── */}
            {(() => {
              const dataExtenso = fmtDataExtenso(dados.datlei || dados.datlan);
              const praça = [
                dados.lote?.cidadeVendedor?.toUpperCase(),
                dados.lote?.estadoVendedor?.toUpperCase(),
              ].filter(Boolean).join('/') || '___';
              const localEmissao = comp.nomeCidade?.toUpperCase() || '___';

              return (
                <View style={s.promBox} wrap={false}>
                  {/* Título — largura total */}
                  <Text style={s.promTitulo}>NOTA PROMISSÓRIA ÚNICA</Text>

                  {/* Corpo principal: lacre (esq, altura total) | conteúdo (dir) */}
                  <View style={s.promBodyRow}>
                    <Image src={lacrePromissoria} style={s.promDecorBox} />

                    <View style={s.promConteudo}>
                      {/* Lote + valor */}
                      <View style={s.promHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.promLoteLabel}>Lote:</Text>
                          <Text style={s.promLoteNum}>{dados.lote?.lotexx || '—'}</Text>
                        </View>
                        <Text style={s.promValorGrande}>{fmtR(totalValor)}</Text>
                      </View>

                      {/* Texto */}
                      <Text style={s.promTexto}>
                        {`AO(S) ${dataExtenso} PAGAREI POR ESTA NOTA PROMISSÓRIA ÚNICA A ${(credor).toUpperCase()}${cpfCredor ? ` CPF: ${cpfCredor}` : ''} OU A SUA ORDEM A QUANTIA DE (${extenso}) EM MOEDA CORRENTE DO PAÍS NA PRAÇA DE ${praça} PELA COMPRA QUE LHE FIZE(MOS).`}
                      </Text>

                      {/* Local + Data */}
                      <Text style={s.promLocalData}>
                        {`${localEmissao} ${dataExtenso}`}
                      </Text>

                      {/* Dados comprador (esq) + assinatura (dir) */}
                      <View style={s.promRodape}>
                        <View style={s.promComprDados}>
                          <Text style={s.promComprNome}>{comp.nomexx?.toUpperCase() || '___'}</Text>
                          {comp.cpfxxx     ? <Text style={s.promComprLinha}>{comp.cpfxxx}</Text> : null}
                          {comp.endere     ? <Text style={s.promComprLinha}>{[comp.endere, comp.bairro].filter(Boolean).join('   ')}</Text> : null}
                          {comp.nomeCidade ? <Text style={s.promComprLinha}>{comp.nomeCidade?.toUpperCase()}{comp.nomeEstado ? ` ${comp.nomeEstado.toUpperCase()}` : ''}</Text> : null}
                          {comp.cepxxx     ? <Text style={s.promComprLinha}>{comp.cepxxx}</Text> : null}
                          {comp.celu1      ? <Text style={s.promComprLinha}>{comp.celu1}</Text> : null}
                          {comp.emailx     ? <Text style={s.promComprLinha}>{comp.emailx}</Text> : null}
                        </View>
                        <View style={s.promAssinItem}>
                          <View style={s.promAssinLinha} />
                          <Text style={s.promAssinNome}>{comp.nomexx?.toUpperCase() || 'COMPRADOR'}</Text>
                          {comp.cpfxxx ? <Text style={s.promAssinRole}>{comp.cpfxxx}</Text> : null}
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* ── RODAPÉ ── */}
            <View style={s.footer} fixed>
              <Text style={s.footerText}>{nomeEmpresa} — Nota de Leilão Nº {dados.codnot || dados.id}</Text>
              <Text style={s.footerText}>Emitido em {agora}</Text>
              <Text
                style={s.footerText}
                render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
              />
            </View>

          </Page>
        );
      })}
    </Document>
  );
}

export default PromissoriaPDF;
