import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
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

const fmtData = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
};

const CATEGO: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

// ─── Cores e estilos ──────────────────────────────────────────────────────────

const AZUL   = '#001529';
const AZUL2  = '#1677ff';
const CINZA  = '#d9d9d9';
const VERDE  = '#52c41a';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#222',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
  },

  // ── Cabeçalho ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: AZUL,
    paddingBottom: 8,
    marginBottom: 10,
  },
  headerEsq: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 38, height: 38, objectFit: 'contain' },
  empresa: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: AZUL },
  empresaSub: { fontSize: 6.5, color: '#666', marginTop: 2 },
  headerDir: { alignItems: 'flex-end' },
  docTitulo: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: AZUL },
  docNota: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL2, marginTop: 2 },
  docData: { fontSize: 7, color: '#666', marginTop: 1 },

  // ── Bloco leilão ──
  leilaoBox: {
    backgroundColor: AZUL,
    borderRadius: 3,
    padding: '6 10',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leilaoLabel: { fontSize: 6, color: '#a0b4c8', textTransform: 'uppercase', letterSpacing: 0.5 },
  leilaoNome:  { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#fff', marginTop: 2 },
  leilaoData:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffc53d' },

  // ── Duas colunas: Lote + Vendedor ──
  duasColunas: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  colLote: {
    flex: 1.1, backgroundColor: '#f0f6ff', borderRadius: 3,
    padding: 8, borderWidth: 0.5, borderColor: '#91caff',
  },
  colVendedor: {
    flex: 1, backgroundColor: '#fff7e6', borderRadius: 3,
    padding: 8, borderWidth: 0.5, borderColor: '#ffd591',
  },
  secLabel: {
    fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: AZUL2,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 4, paddingBottom: 2,
    borderBottomWidth: 0.5, borderBottomColor: '#c8deff',
  },
  secLabelOrange: {
    fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: '#d46b08',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 4, paddingBottom: 2,
    borderBottomWidth: 0.5, borderBottomColor: '#ffd591',
  },
  loteNum:  { fontSize: 13, fontFamily: 'Helvetica-Bold', color: AZUL },
  loteDes:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 2 },
  loteInfo: { fontSize: 7, color: '#555', marginBottom: 1 },
  nomeXX:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 2 },
  cpfXX:    { fontSize: 7.5, color: '#444', marginBottom: 2 },
  endereXX: { fontSize: 7, color: '#666', marginBottom: 1 },

  // ── Comprador ──
  compradorBox: {
    backgroundColor: '#f6ffed', borderRadius: 3,
    borderWidth: 0.5, borderColor: '#b7eb8f',
    padding: 8, marginBottom: 8,
  },
  secLabelGreen: {
    fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: '#389e0d',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 4, paddingBottom: 2,
    borderBottomWidth: 0.5, borderBottomColor: '#b7eb8f',
  },
  comprRow: { flexDirection: 'row', gap: 16 },
  comprCol: { flex: 1 },

  // ── Acerto financeiro ──
  acertoBox: {
    backgroundColor: '#fafafa', borderRadius: 3,
    borderWidth: 0.5, borderColor: CINZA,
    padding: '6 8', marginBottom: 8,
    flexDirection: 'row', flexWrap: 'wrap', gap: 0,
  },
  acertoItem: { width: '25%', marginBottom: 4 },
  acertoLabel: { fontSize: 6, color: '#888', marginBottom: 1 },
  acertoVal:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111' },
  acertoValBlue:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: AZUL2 },
  acertoValGreen:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: VERDE },
  acertoValOrange: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#d46b08' },

  // ── Tabela de parcelas (3 grupos por linha) ──
  tabelaBox: {
    borderRadius: 3, borderWidth: 0.5, borderColor: CINZA,
    marginBottom: 10, overflow: 'hidden',
  },
  tabelaHeader: {
    backgroundColor: AZUL, flexDirection: 'row',
    paddingVertical: 3, paddingHorizontal: 6,
  },
  tabelaRow: {
    flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 6,
    borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0',
  },
  tabelaRowAlt: { backgroundColor: '#fafafa' },
  tabelaTotal: {
    backgroundColor: '#f0f0f0', flexDirection: 'row',
    paddingVertical: 4, paddingHorizontal: 6,
  },

  // grupo de 3 células dentro de uma linha
  cGrupo:    { flex: 1, flexDirection: 'row' },
  cGrupoSep: { borderLeftWidth: 0.5, borderLeftColor: '#d0d0d0', paddingLeft: 4 },
  cNum:  { width: 26 },
  cData: { flex: 1 },
  cValor:{ width: 70, textAlign: 'right' },

  th:      { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' },
  td:      { fontSize: 7, color: '#333' },
  tdRight: { fontSize: 7, color: '#333', textAlign: 'right' },
  tdBold:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: VERDE },
  tdBoldRight: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: VERDE, textAlign: 'right' },

  // ── Promissória única ──
  promBox: {
    borderWidth: 1, borderColor: '#555', borderRadius: 3,
    padding: 10, marginTop: 2,
  },
  promTitulo: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', color: AZUL,
    textAlign: 'center', letterSpacing: 1,
    marginBottom: 6, paddingBottom: 5,
    borderBottomWidth: 1, borderBottomColor: AZUL,
  },
  promTexto: {
    fontSize: 8, lineHeight: 1.65, color: '#222',
    textAlign: 'justify', marginBottom: 10,
  },
  promAssinRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
  },
  promAssinItem: { alignItems: 'center', flex: 1, marginHorizontal: 8 },
  promAssinLinha: { borderTopWidth: 0.5, borderTopColor: '#333', width: '90%', marginBottom: 3 },
  promAssinNome: { fontSize: 7, color: '#444', textAlign: 'center' },
  promAssinRole: { fontSize: 6, color: '#888', textAlign: 'center' },

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

        const endereComp = [comp.endere, comp.bairro, comp.nomeCidade, comp.nomeEstado]
          .filter(Boolean).join(', ');
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
                  <Text style={s.empresaSub}>Sistema de Gestão de Leilões</Text>
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
                  <Text style={s.secLabelOrange}>Vendedor / Credor</Text>
                  <Text style={s.nomeXX}>{dados.lote.nomeVendedor || '—'}</Text>
                  <Text style={s.cpfXX}>CPF: {dados.lote.cpfVendedor || 'não informado'}</Text>
                  {endereVend ? <Text style={s.endereXX}>{endereVend}</Text> : null}
                  {dados.lote.cepVendedor ? <Text style={s.endereXX}>CEP {dados.lote.cepVendedor}</Text> : null}
                  {dados.lote.celularVendedor || dados.lote.telresVendedor ? (
                    <Text style={s.endereXX}>
                      Tel: {dados.lote.celularVendedor || dados.lote.telresVendedor}
                    </Text>
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
                  {comp.celu1 ? <Text style={s.endereXX}>Tel: {comp.celu1}</Text> : null}
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
              <InfoItem label="Forma de Pagamento"  value={comp.formaPagamento} />
              <InfoItem label="Valor Total"         value={fmtR(comp.valorOriginal)} style={s.acertoValBlue} />
              <InfoItem label="Comissão Leiloeiro"  value={comp.comissao != null ? `${comp.comissao}%` : '—'} style={s.acertoValOrange} />
              <InfoItem label="Vlr. Comissão"       value={fmtR(comp.valorComissao)} style={s.acertoValOrange} />
              <InfoItem label="Desconto"            value={fmtR(comp.valorDesconto)} />
              <InfoItem label="Valor Líquido"       value={fmtR(comp.valorPagar)} style={s.acertoValGreen} />
              {comp.percen != null && comp.percen !== 100 ? (
                <InfoItem label="% do Lote" value={`${comp.percen}%`} />
              ) : null}
            </View>

            {/* ── TABELA DE PARCELAS (3 grupos por linha) ── */}
            {(() => {
              const parc = comp.parcelas;
              // agrupa em linhas de 3
              const linhas: (typeof parc[0] | null)[][] = [];
              for (let i = 0; i < parc.length; i += 3) {
                linhas.push([parc[i] ?? null, parc[i + 1] ?? null, parc[i + 2] ?? null]);
              }
              return (
                <View style={s.tabelaBox}>
                  {/* Cabeçalho — 3 grupos */}
                  <View style={s.tabelaHeader}>
                    {[0, 1, 2].map(g => (
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
                                    {p.ordxxx ?? String(li * 3 + gi + 1).padStart(2, '0')}
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
                        TOTAL — {parc.length} parcela{parc.length !== 1 ? 's' : ''}
                      </Text>
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: VERDE }}>
                        {fmtR(totalParcelas)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* ── PROMISSÓRIA ÚNICA ── */}
            <View style={s.promBox} wrap={false}>
              <Text style={s.promTitulo}>PROMISSÓRIA</Text>

              <Text style={s.promTexto}>
                {'      '}Pelo presente título de PROMISSÓRIA, eu{' '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{comp.nomexx || '_______________'}</Text>
                {comp.cpfxxx ? `, CPF ${comp.cpfxxx},` : ','}{' '}
                residente em {endereComp || '_______________'},{' '}
                DEVO e PAGAREI ao(à) credor(a){' '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{credor}</Text>
                {cpfCredor ? `, CPF ${cpfCredor},` : ','} ou à sua ordem,{' '}
                a importância total de{' '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmtR(totalValor)}</Text>
                {' '}({extenso}),{' '}
                referente à aquisição do Lote{' '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                  {dados.lote?.lotexx} — {dados.lote?.deslot}
                </Text>
                , conforme parcelas acima discriminadas, no Leilão{' '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{dados.leilao}</Text>
                {dados.datlei ? `, realizado em ${fmtData(dados.datlei)}` : ''},{' '}
                Nota de Leilão Nº{' '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{dados.codnot || String(dados.id)}</Text>.{' '}
                Esta promissória é válida para todos os efeitos legais, nos termos da lei.
              </Text>

              <Text style={{ fontSize: 7, color: '#666', marginBottom: 10, textAlign: 'center' }}>
                {comp.nomeCidade || '_______________'}, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>

              <View style={s.promAssinRow}>
                <View style={s.promAssinItem}>
                  <View style={s.promAssinLinha} />
                  <Text style={s.promAssinNome}>{comp.nomexx || 'Comprador'}</Text>
                  {comp.cpfxxx ? <Text style={s.promAssinRole}>CPF: {comp.cpfxxx}</Text> : null}
                  <Text style={s.promAssinRole}>Devedor</Text>
                </View>
                <View style={s.promAssinItem}>
                  <View style={s.promAssinLinha} />
                  <Text style={s.promAssinNome}>{credor}</Text>
                  {cpfCredor ? <Text style={s.promAssinRole}>CPF: {cpfCredor}</Text> : null}
                  <Text style={s.promAssinRole}>Credor / Vendedor</Text>
                </View>
                <View style={s.promAssinItem}>
                  <View style={s.promAssinLinha} />
                  <Text style={s.promAssinNome}>{nomeEmpresa}</Text>
                  <Text style={s.promAssinRole}>Leiloeiro / Testemunha</Text>
                </View>
              </View>
            </View>

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
