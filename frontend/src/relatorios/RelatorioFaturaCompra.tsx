import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

export interface FaturaData {
  id: number;
  codnot?: string;
  datlan: string;
  leilao?: string;
  datlei?: string;
  lote?: {
    lotexx?: string;
    deslot?: string;
    rpxxx?: string;
    sbbxxx?: string;
    pesoxx?: number;
    catego?: string;
    descricaoRaca?: string;
    especies?: string;
    qtdxxx?: number;
    vlrpar?: number;
    vlrtot?: number;
    vlrdes?: number;
    comiss?: number;
    nomeVendedor?: string;
    cpfVendedor?: string;
    endereVendedor?: string;
    bairroVendedor?: string;
    cepVendedor?: string;
    celularVendedor?: string;
    telresVendedor?: string;
    cidadeVendedor?: string;
    estadoVendedor?: string;
  };
  compradores: Array<{
    id: number;
    nomexx?: string;
    cpfxxx?: string;
    endere?: string;
    bairro?: string;
    cepxxx?: string;
    celu1?: string;
    nomeCidade?: string;
    nomeEstado?: string;
    percen?: number;
    valorOriginal?: number;
    valorPagar?: number;
    valorDesconto?: number;
    valorComissao?: number;
    comissao?: number;
    formaPagamento?: string;
    desfin?: string;
    nomePropriedade?: string;
    cidadeProp?: string;
    estadoProp?: string;
    parcelas: Array<{
      ordxxx?: string;
      datven?: string;
      vlrpar?: number;
      pripar?: string;
    }>;
  }>;
}

interface Props {
  dados: FaturaData;
  empresa?: string;
}

const AZUL    = '#001529';
const AZUL2   = '#1677ff';
const VERDE   = '#52c41a';
const LARANJA = '#fa8c16';
const CINZA   = '#d9d9d9';
const CATEGO: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

const fmtR = (v?: number | null) =>
  v != null && v !== 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '—';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#222',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },

  // ── Cabeçalho do documento ──
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: AZUL,
    borderBottomWidth: 2,
    paddingBottom: 7,
    marginBottom: 8,
  },
  docHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docLogo: { width: 40, height: 40, objectFit: 'contain' },
  docEmpresa: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: AZUL },
  docHeaderRight: { alignItems: 'flex-end' },
  docTitulo: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: AZUL, letterSpacing: 0.5 },
  docNumero: { fontSize: 9, color: AZUL2, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  docData: { fontSize: 7.5, color: '#666', marginTop: 2 },

  // ── Leilão ──
  leilaoBox: {
    backgroundColor: AZUL,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  leilaoLabel: { fontSize: 6.5, color: '#a0b4c8', textTransform: 'uppercase', letterSpacing: 0.5 },
  leilaoNome:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#fff', marginTop: 2 },
  leilaoData:  { fontSize: 8, color: '#ffc53d', fontFamily: 'Helvetica-Bold' },

  // ── Duas colunas ──
  duasColunas: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 7,
  },
  colLote:    { flex: 1.1, backgroundColor: '#f0f6ff', borderRadius: 4, padding: 8, borderColor: '#91caff', borderWidth: 1 },
  colVendedor:{ flex: 1,   backgroundColor: '#fff7e6', borderRadius: 4, padding: 8, borderColor: '#ffd591', borderWidth: 1 },

  secLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: AZUL2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomColor: '#c8deff',
    borderBottomWidth: 0.5,
  },
  secLabelOrange: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: LARANJA,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomColor: '#ffd591',
    borderBottomWidth: 0.5,
  },
  loteNum:   { fontSize: 14, fontFamily: 'Helvetica-Bold', color: AZUL, marginBottom: 2 },
  loteDes:   { fontSize: 9,  fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 2 },
  loteInfo:  { fontSize: 7.5, color: '#555', marginBottom: 1 },
  loteRaca:  { fontSize: 7, color: '#888', marginBottom: 1 },
  nomeXX:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 2 },
  cpfXX:     { fontSize: 8, color: '#444', marginBottom: 2 },
  endereco:  { fontSize: 7.5, color: '#555', marginBottom: 2 },
  telefone:  { fontSize: 7.5, color: '#777', marginTop: 3 },

  // ── Comprador ──
  compradorBox: {
    backgroundColor: '#f6ffed',
    borderRadius: 4,
    borderColor: '#b7eb8f',
    borderWidth: 1,
    padding: 8,
    marginBottom: 7,
  },
  compradorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  compradorEsq: { flex: 1 },
  compradorDir: { alignItems: 'flex-end' },
  percTag: {
    backgroundColor: '#52c41a',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  percText: { fontSize: 7, color: '#fff', fontFamily: 'Helvetica-Bold' },
  comprLabelGreen: {
    fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#389e0d',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 3, paddingBottom: 2,
    borderBottomColor: '#b7eb8f', borderBottomWidth: 0.5,
  },

  // ── Acerto ──
  acertoBox: {
    backgroundColor: '#fafafa',
    borderRadius: 4,
    borderColor: CINZA,
    borderWidth: 1,
    padding: 8,
    marginBottom: 7,
  },
  acertoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  acertoItem: { width: '33%', marginBottom: 4 },
  acertoLabel:{ fontSize: 6.5, color: '#888', marginBottom: 1 },
  acertoValor:{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111' },
  acertoValorBlue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL2 },
  acertoValorGreen:{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: VERDE },
  acertoValorOrange:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: LARANJA },
  acertoValorRed:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ff4d4f' },

  // ── Parcelas (3 colunas) ──
  parcelasBox: {
    borderRadius: 4,
    borderColor: CINZA,
    borderWidth: 1,
    marginBottom: 7,
    overflow: 'hidden',
  },
  parcelasHeader: {
    backgroundColor: AZUL,
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  thP: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thPRight: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },

  // linha de 3 grupos
  parcRow3: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 0.5,
  },
  parcRowAlt: { backgroundColor: '#fafafa' },
  // grupo de 3 células (# | data | valor)
  cGrupo:    { flex: 1, flexDirection: 'row' },
  cGrupoSep: { borderLeftColor: '#d0d0d0', borderLeftWidth: 0.5, paddingLeft: 4 },
  cNumP:  { width: 30 },
  cDatP:  { flex: 1 },
  cVlrP:  { width: 66, textAlign: 'right' as const },

  tdP:      { fontSize: 7 },
  tdPRight: { fontSize: 7, textAlign: 'right' as const },
  tdPBold:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: VERDE },
  semParcelas: { padding: 12, textAlign: 'center' as const, fontSize: 8, color: '#aaa', fontStyle: 'italic' },

  parcelasTotal: {
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },

  // ── Propriedade ──
  propBox: {
    backgroundColor: '#f9f0ff',
    borderRadius: 3,
    borderColor: '#d3adf7',
    borderWidth: 0.5,
    padding: 6,
    marginTop: 6,
  },
  propLabel: { fontSize: 6, color: '#722ed1', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
  propText:  { fontSize: 7.5, color: '#555', marginBottom: 1 },

  // ── Assinaturas ──
  assinaturas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopColor: CINZA,
    borderTopWidth: 0.5,
  },
  assinaturaItem: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  assinaturaLinha: { borderTopColor: '#333', borderTopWidth: 0.5, width: '80%', marginBottom: 4 },
  assinaturaNome: { fontSize: 7, color: '#444', textAlign: 'center' as const },
  assinaturaRole: { fontSize: 6.5, color: '#888', textAlign: 'center' as const },

  // ── Rodapé ──
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: CINZA,
    borderTopWidth: 0.5,
    paddingTop: 3,
  },
  footerText: { fontSize: 6, color: '#aaa' },
});

function InfoItem({ label, value, style }: { label: string; value?: string | null; style?: any }) {
  return (
    <View style={s.acertoItem}>
      <Text style={s.acertoLabel}>{label}</Text>
      <Text style={style || s.acertoValor}>{value || '—'}</Text>
    </View>
  );
}

function SecaoVendedor({ lote }: { lote: NonNullable<FaturaData['lote']> }) {
  const ende = [lote.endereVendedor, lote.bairroVendedor].filter(Boolean).join(', ');
  const cid  = [lote.cidadeVendedor, lote.estadoVendedor].filter(Boolean).join(' — ');
  const tel  = lote.celularVendedor || lote.telresVendedor;
  const temEndereco = !!(ende || cid || tel);
  return (
    <View style={s.colVendedor}>
      <Text style={s.secLabelOrange}>Vendedor</Text>
      <Text style={s.nomeXX}>{lote.nomeVendedor || '—'}</Text>
      <Text style={s.cpfXX}>CPF: {lote.cpfVendedor || 'não informado'}</Text>
      {temEndereco ? (
        <>
          {ende ? <Text style={s.endereco}>{ende}</Text> : null}
          {cid  ? <Text style={s.endereco}>{cid}{lote.cepVendedor ? `  CEP ${lote.cepVendedor}` : ''}</Text> : null}
          {tel  ? <Text style={s.telefone}>Tel: {tel}</Text> : null}
        </>
      ) : (
        <Text style={{ fontSize: 7, color: '#bbb', fontStyle: 'italic', marginTop: 4 }}>
          Endereço não cadastrado
        </Text>
      )}
    </View>
  );
}

function SecaoLote({ lote }: { lote: NonNullable<FaturaData['lote']> }) {
  return (
    <View style={s.colLote}>
      <Text style={s.secLabel}>Lote</Text>
      <Text style={s.loteNum}>{lote.lotexx || '—'}</Text>
      <Text style={s.loteDes}>{lote.deslot || '—'}</Text>
      <Text style={s.loteRaca}>{[lote.descricaoRaca, lote.especies].filter(Boolean).join(' / ') || ''}</Text>
      {lote.rpxxx   ? <Text style={s.loteInfo}>RP: {lote.rpxxx}</Text> : null}
      {lote.sbbxxx  ? <Text style={s.loteInfo}>SBB: {lote.sbbxxx}</Text> : null}
      {lote.catego  ? <Text style={s.loteInfo}>Sexo: {CATEGO[lote.catego] || lote.catego}</Text> : null}
      {lote.pesoxx  ? <Text style={s.loteInfo}>Peso: {lote.pesoxx} kg</Text> : null}
      <Text style={s.loteInfo}>
        Qtd: {lote.qtdxxx != null ? Number(lote.qtdxxx).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'} cabeças
      </Text>
    </View>
  );
}

function SecaoComprador({ comp, index }: { comp: FaturaData['compradores'][0]; index: number }) {
  // sem wrap={false} para que seções longas (muitas parcelas) quebrem normalmente entre páginas
  const ende = [comp.endere, comp.bairro].filter(Boolean).join(', ');
  const cid  = [comp.nomeCidade, comp.nomeEstado].filter(Boolean).join(' — ');
  const totalParcelas = comp.parcelas.reduce((s, p) => s + (p.vlrpar || 0), 0);

  return (
    <View>
      {/* Dados do comprador */}
      <View style={s.compradorBox}>
        <View style={s.compradorHeader}>
          <View style={s.compradorEsq}>
            <Text style={s.comprLabelGreen}>
              Comprador{index > 0 ? ` ${index + 1}` : ''}
            </Text>
            <Text style={s.nomeXX}>{comp.nomexx || '—'}</Text>
            <Text style={s.cpfXX}>CPF: {comp.cpfxxx || 'não informado'}</Text>
            {ende ? <Text style={s.endereco}>{ende}</Text> : null}
            {cid  ? <Text style={s.endereco}>{cid}{comp.cepxxx ? `  CEP ${comp.cepxxx}` : ''}</Text> : null}
            {comp.celu1 ? <Text style={s.telefone}>Tel: {comp.celu1}</Text> : null}
          </View>
          {comp.percen != null && comp.percen !== 100 ? (
            <View style={s.compradorDir}>
              <View style={s.percTag}>
                <Text style={s.percText}>{comp.percen}%</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Propriedade */}
        {comp.nomePropriedade ? (
          <View style={s.propBox}>
            <Text style={s.propLabel}>Propriedade</Text>
            <Text style={s.propText}>{comp.nomePropriedade}</Text>
            {comp.cidadeProp ? (
              <Text style={s.propText}>
                {comp.cidadeProp}{comp.estadoProp ? `/${comp.estadoProp}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Dados do acerto */}
      <View style={s.acertoBox}>
        <Text style={[s.secLabel, { marginBottom: 8 }]}>Dados do Acerto</Text>
        <View style={s.acertoGrid}>
          <InfoItem label="Cond. Pagamento" value={comp.desfin} />
          <InfoItem label="Forma de Pagamento" value={comp.formaPagamento} />
          <InfoItem label="Valor Total" value={fmtR(comp.valorOriginal)} style={s.acertoValorBlue} />
          <InfoItem label="Comissão" value={comp.comissao != null ? `${comp.comissao}%` : '—'} style={s.acertoValorOrange} />
          <InfoItem label="Vlr. Comissão" value={fmtR(comp.valorComissao)} style={s.acertoValorOrange} />
          <InfoItem label="Desconto" value={fmtR(comp.valorDesconto)} style={s.acertoValorRed} />
          <InfoItem label="Valor Líquido" value={fmtR(comp.valorPagar)} style={s.acertoValorGreen} />
        </View>
      </View>

      {/* Parcelas — 3 colunas */}
      {(() => {
        const parc = comp.parcelas;
        // agrupar em linhas de 3
        const linhas: (typeof parc[0] | null)[][] = [];
        for (let i = 0; i < parc.length; i += 3) {
          linhas.push([parc[i] || null, parc[i + 1] || null, parc[i + 2] || null]);
        }
        return (
          <View style={s.parcelasBox}>
            {/* Cabeçalho */}
            <View style={s.parcelasHeader}>
              {[0, 1, 2].map(c => (
                <View key={c} style={[s.cGrupo, c > 0 ? s.cGrupoSep : {}]}>
                  <View style={s.cNumP}><Text style={s.thP}>#</Text></View>
                  <View style={s.cDatP}><Text style={s.thP}>Vencimento</Text></View>
                  <View style={s.cVlrP}><Text style={s.thPRight}>Valor</Text></View>
                </View>
              ))}
            </View>

            {parc.length === 0 ? (
              <Text style={s.semParcelas}>Parcelas ainda não geradas</Text>
            ) : (
              linhas.map((linha, li) => (
                <View key={li} wrap={false}
                  style={[s.parcRow3, li % 2 === 1 ? s.parcRowAlt : {}]}>
                  {linha.map((p, ci) => (
                    <View key={ci} style={[s.cGrupo, ci > 0 ? s.cGrupoSep : {}]}>
                      {p ? (
                        <View style={{ flexDirection: 'row', flex: 1 }}>
                          <View style={s.cNumP}>
                            <Text style={p.pripar === 'S' ? s.tdPBold : s.tdP}>
                              {p.ordxxx || String(li * 3 + ci + 1).padStart(2, '0')}
                            </Text>
                          </View>
                          <View style={s.cDatP}>
                            <Text style={p.pripar === 'S' ? s.tdPBold : s.tdP}>
                              {p.datven || '—'}
                            </Text>
                          </View>
                          <View style={s.cVlrP}>
                            <Text style={p.pripar === 'S' ? s.tdPBold : s.tdPRight}>
                              {fmtR(p.vlrpar)}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))
            )}

            {/* Total */}
            {parc.length > 0 && (
              <View style={s.parcelasTotal}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', flex: 1 }}>
                  TOTAL — {parc.length} parcela{parc.length !== 1 ? 's' : ''}
                </Text>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>
                  {fmtR(totalParcelas)}
                </Text>
              </View>
            )}
          </View>
        );
      })()}
    </View>
  );
}

function FaturaCompraPDF({ dados, empresa }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Document
      title={`Fatura de Compras #${dados.id}${dados.codnot ? ` — ${dados.codnot}` : ''}`}
      author={nomeEmpresa}
    >
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.docHeader}>
          <View style={s.docHeaderLeft}>
            <Image src={logotipoLocal} style={s.docLogo} />
            <Text style={s.docEmpresa}>{nomeEmpresa}</Text>
          </View>
          <View style={s.docHeaderRight}>
            <Text style={s.docTitulo}>FATURA DE COMPRAS</Text>
            {dados.codnot ? <Text style={s.docNumero}>Boleto Nº {dados.codnot}</Text> : null}
            <Text style={s.docData}>
              Código #{dados.id}   ·   Emissão: {agora}
            </Text>
          </View>
        </View>

        {/* Leilão */}
        <View style={s.leilaoBox}>
          <View>
            <Text style={s.leilaoLabel}>Leilão</Text>
            <Text style={s.leilaoNome}>{dados.leilao || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.leilaoLabel}>Data do Leilão</Text>
            <Text style={s.leilaoData}>{dados.datlei || '—'}</Text>
          </View>
        </View>

        {/* Lote + Vendedor */}
        {dados.lote ? (
          <View style={s.duasColunas}>
            <SecaoLote  lote={dados.lote} />
            <SecaoVendedor lote={dados.lote} />
          </View>
        ) : null}

        {/* Compradores */}
        {dados.compradores.map((comp, i) => (
          <SecaoComprador key={comp.id} comp={comp} index={i} />
        ))}

        {/* Assinaturas */}
        <View wrap={false} style={s.assinaturas}>
          {dados.compradores.slice(0, 2).map((comp, i) => (
            <View key={i} style={s.assinaturaItem}>
              <View style={s.assinaturaLinha} />
              <Text style={s.assinaturaNome}>{comp.nomexx || 'Comprador'}</Text>
              <Text style={s.assinaturaRole}>Comprador</Text>
            </View>
          ))}
          <View style={s.assinaturaItem}>
            <View style={s.assinaturaLinha} />
            <Text style={s.assinaturaNome}>{dados.lote?.nomeVendedor || 'Vendedor'}</Text>
            <Text style={s.assinaturaRole}>Vendedor</Text>
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomeEmpresa} — Sistema de Gestão</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}

export default FaturaCompraPDF;
