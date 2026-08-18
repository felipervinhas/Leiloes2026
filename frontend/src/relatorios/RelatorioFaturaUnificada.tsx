import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { valorExtenso } from './promissoriaUtils';
import { labelRP, labelSBB } from '../utils/lote';

export type ModoFaturaUnificada = 'par' | 'vendedor' | 'comprador';

export interface FaturaUnificadaLote {
  idMc: number;
  idMov: number;
  idMovLote: number;
  codnot?: string;
  datlan: string;
  lotexx?: string;
  deslot?: string;
  rpxxx?: string;
  sbbxxx?: string;
  pesoxx?: number;
  catego?: string;
  descricaoRaca?: string;
  especies?: string;
  qtdxxx?: number;
  valorOriginal: number;
  valorPagar: number;
  valorDesconto: number;
  valorDescontoFidelidade: number;
  tipoDescontoFidelidade?: 'P' | 'V' | null;
  descontoFidelidade?: number;
  valorComissao: number;
  comissao: number;
  formaPagamento?: string;
  desfin?: string;
  qtdparCond: number;
  parcelas: Array<{ ordxxx?: string; datven?: string; vlrpar?: number; pripar?: string }>;
  idContraparte?: number;
  nomeContraparte?: string;
  documentoContraparte?: string;
  comissaoVendedor?: number;
  valorComissaoVendedor: number;
}

export interface FaturaUnificadaParte {
  id: number;
  nomexx?: string;
  cpfxxx?: string;
  cnpjxx?: string;
  totalSinal: number;
  totalComissao: number;
}

export interface FaturaUnificadaGrupo {
  idLeilao: number;
  leilao?: string;
  datlei?: string;
  modo: ModoFaturaUnificada;
  vendedor: {
    id: number; nomexx?: string; cpfxxx?: string; cnpjxx?: string;
    endere?: string; bairro?: string; cepxxx?: string;
    celu1?: string; telres?: string; emailx?: string;
    nomeCidade?: string; nomeEstado?: string;
  } | null;
  comprador: {
    id: number; nomexx?: string; cpfxxx?: string; cnpjxx?: string;
    endere?: string; bairro?: string; cepxxx?: string;
    celu1?: string; celu2?: string; telcom?: string; telres?: string; emailx?: string;
    nomeCidade?: string; nomeEstado?: string; nomePropriedade?: string;
  } | null;
  contrapartes: FaturaUnificadaParte[];
  lotes: FaturaUnificadaLote[];
  totais: {
    totalCompra: number;
    totalAVista: number;
    totalPromissorias: number;
    totalSinal: number;
    totalComissao: number;
    totalDesconto: number;
    totalDescontoFidelidade: number;
    totalComissaoVendedor: number;
    totalLiquidoVendedor: number;
  };
}

interface Props {
  grupos: FaturaUnificadaGrupo[];
  empresa?: string;
  logoBase64?: string | null;
}

const PRETO  = '#000';
const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';
const CLARO  = '#f0f0f0';
const CATEGO: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

const fmtR = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

/** Mostra o valor bruto digitado no desconto de fidelidade (% ou R$), não o valor calculado. */
const fmtFidelidade = (tipo?: 'P' | 'V' | null, valor?: number | null) => {
  if (!tipo || valor == null || valor <= 0) return null;
  return tipo === 'P'
    ? `${valor}%`
    : `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

function parseDataBr(str?: string): Date | null {
  if (!str) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

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

  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: PRETO,
    borderBottomWidth: 2,
    paddingBottom: 5,
    marginBottom: 6,
  },
  docHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docLogo: { width: 48, height: 48, objectFit: 'contain' },
  docEmpresa: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRETO },
  docHeaderRight: { alignItems: 'flex-end' },
  docTitulo: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: PRETO, letterSpacing: 0.5 },
  docData: { fontSize: 6.5, color: MEDIO, marginTop: 1 },

  leilaoBox: {
    backgroundColor: ESCURO,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  leilaoLabel: { fontSize: 5.5, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  leilaoNome:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff', marginTop: 1 },
  leilaoData:  { fontSize: 7.5, color: '#ddd', fontFamily: 'Helvetica-Bold' },

  duasColunas: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  colBox: { flex: 1, backgroundColor: CLARO, borderRadius: 3, padding: 6, borderColor: CINZA, borderWidth: 0.5 },
  secLabel: {
    fontSize: 5, fontFamily: 'Helvetica-Bold', color: ESCURO,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 3, paddingBottom: 2,
    borderBottomColor: CINZA, borderBottomWidth: 0.5,
  },
  nomeXX:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO, marginBottom: 1 },
  cpfXX:    { fontSize: 7, color: ESCURO, marginBottom: 1 },
  endereco: { fontSize: 7, color: MEDIO, marginBottom: 1 },
  telefone: { fontSize: 7, color: MEDIO, marginTop: 2 },

  propBox: {
    backgroundColor: '#fff', borderRadius: 3, borderColor: CINZA, borderWidth: 0.5,
    padding: 4, marginTop: 4,
  },
  propLabel: { fontSize: 5, color: ESCURO, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
  propText:  { fontSize: 6.5, color: MEDIO },

  tabela: { borderWidth: 0.5, borderColor: CINZA, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  tHeader: { flexDirection: 'row', backgroundColor: ESCURO, paddingVertical: 3, paddingHorizontal: 5 },
  tRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 5, borderBottomColor: CLARO, borderBottomWidth: 0.5 },
  tRowAlt: { backgroundColor: '#fafafa' },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff' },
  td: { fontSize: 7 },
  tdBold: { fontSize: 7, fontFamily: 'Helvetica-Bold' },

  cLote: { width: 28 },
  cDesc: { flex: 1 },
  cParceiro: { width: 90 },
  cCond: { width: 82 },
  cBruto: { width: 62, textAlign: 'right' as const },
  cLiquido: { width: 62, textAlign: 'right' as const },
  cSinal: { width: 70, textAlign: 'right' as const },
  cComVen: { width: 60, textAlign: 'right' as const },

  parceirosLista: { marginTop: 1 },
  parceiroLinha: { fontSize: 6.5, color: MEDIO, marginBottom: 1 },

  parcelasBox: {
    borderRadius: 3, borderColor: CINZA, borderWidth: 0.5, marginBottom: 5, overflow: 'hidden',
  },
  parcelasHeader: { backgroundColor: ESCURO, flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4 },
  thP: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thPRight: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  parcRow3: { flexDirection: 'row', paddingVertical: 1.5, paddingHorizontal: 4, borderBottomColor: CLARO, borderBottomWidth: 0.5 },
  parcRowAlt: { backgroundColor: '#fafafa' },
  cGrupo: { flex: 1, flexDirection: 'row' },
  cGrupoSep: { borderLeftColor: CINZA, borderLeftWidth: 0.5, paddingLeft: 3 },
  cNumP: { width: 24 },
  cDatP: { flex: 1 },
  cVlrP: { width: 56, textAlign: 'right' as const },
  tdP: { fontSize: 6.5, color: ESCURO },
  tdPRight: { fontSize: 6.5, color: ESCURO, textAlign: 'right' as const },
  tdPBold: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PRETO },

  acertoBox: {
    backgroundColor: '#fafafa', borderRadius: 3, borderColor: CINZA, borderWidth: 0.5,
    padding: '4 6', marginBottom: 5,
  },
  acertoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  acertoItem: { width: '33%', marginBottom: 4 },
  acertoLabel: { fontSize: 5.5, color: MEDIO, marginBottom: 1 },
  acertoValor: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO },

  reciboBox: {
    borderColor: PRETO, borderWidth: 0.5, borderRadius: 3,
    padding: 6, marginBottom: 4,
  },
  reciboLabel: { fontSize: 6, color: MEDIO, marginBottom: 2 },
  reciboNome: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: PRETO, marginBottom: 3 },
  reciboExtenso: { fontSize: 7, color: ESCURO, fontStyle: 'italic' },

  assinaturas: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 6, borderTopColor: CINZA, borderTopWidth: 0.5,
  },
  assinaturaItem: { flexGrow: 1, flexBasis: '28%', maxWidth: '48%', alignItems: 'center', marginHorizontal: 8, marginBottom: 8 },
  assinaturaLinha: { borderTopColor: ESCURO, borderTopWidth: 0.5, width: '80%', marginBottom: 3 },
  assinaturaNome: { fontSize: 7, color: ESCURO, textAlign: 'center' as const },
  assinaturaRole: { fontSize: 6.5, color: MEDIO, textAlign: 'center' as const },

  footer: {
    position: 'absolute', bottom: 10, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopColor: CINZA, borderTopWidth: 0.5, paddingTop: 3,
  },
  footerText: { fontSize: 6, color: CINZA },
});

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.acertoItem}>
      <Text style={s.acertoLabel}>{label}</Text>
      <Text style={s.acertoValor}>{value ?? '—'}</Text>
    </View>
  );
}

function docContraparte(p: { cpfxxx?: string; cnpjxx?: string }) {
  return p.cnpjxx ? `CNPJ: ${p.cnpjxx}` : `CPF: ${p.cpfxxx || 'não informado'}`;
}

function paginaFatura(grupo: FaturaUnificadaGrupo, index: number, nomeEmpresa: string, agora: string, logoBase64?: string | null) {
  const comp = grupo.comprador;
  const ven  = grupo.vendedor;
  const enderecoComp = comp ? [comp.endere, comp.bairro].filter(Boolean).join(', ') : '';
  const cidadeComp   = comp ? [comp.nomeCidade, comp.nomeEstado].filter(Boolean).join(' — ') : '';
  const enderecoVen  = ven ? [ven.endere, ven.bairro].filter(Boolean).join(', ') : '';
  const cidadeVen    = ven ? [ven.nomeCidade, ven.nomeEstado].filter(Boolean).join(' — ') : '';
  const tituloColunaParceiro = grupo.modo === 'vendedor' ? 'Comprador' : grupo.modo === 'comprador' ? 'Vendedor' : null;
  // Fatura de vendedor: documento é do vendedor, não interessa a ele o parcelamento
  // do comprador — interessa quanto vendeu, quanto de comissão paga e quanto recebe líquido.
  const isVendedor = grupo.modo === 'vendedor';

  // Agrupa as parcelas de todos os lotes por data de vencimento, somando os valores
  // que caem no mesmo dia — sem isso, um comprador com vários lotes parcelados em
  // muitas vezes gera uma lista enorme (ex.: 6 lotes x 24 parcelas = 144 linhas).
  const porData = new Map<string, { datven: string; vlrpar: number; temSinal: boolean }>();
  for (const l of grupo.lotes) {
    for (const p of l.parcelas) {
      const key = p.datven || '—';
      const atual = porData.get(key) || { datven: key, vlrpar: 0, temSinal: false };
      atual.vlrpar += p.vlrpar || 0;
      if (p.pripar === 'S') atual.temSinal = true;
      porData.set(key, atual);
    }
  }
  const parcelasAgrupadas = Array.from(porData.values()).sort((a, b) => {
    const da = parseDataBr(a.datven);
    const db = parseDataBr(b.datven);
    if (da && db) return da.getTime() - db.getTime();
    return a.datven.localeCompare(b.datven);
  });

  const linhasParc: (typeof parcelasAgrupadas[0] | null)[][] = [];
  for (let i = 0; i < parcelasAgrupadas.length; i += 3) {
    linhasParc.push([parcelasAgrupadas[i] || null, parcelasAgrupadas[i + 1] || null, parcelasAgrupadas[i + 2] || null]);
  }

  return (
    <Page key={index} size="A4" style={s.page}>

      <View style={s.docHeader}>
        <View style={s.docHeaderLeft}>
          <Image src={logoBase64 || logotipoLocal} style={s.docLogo} />
          <Text style={s.docEmpresa}>{nomeEmpresa}</Text>
        </View>
        <View style={s.docHeaderRight}>
          <Text style={s.docTitulo}>FATURA UNIFICADA</Text>
          <Text style={s.docData}>{grupo.lotes.length} lote{grupo.lotes.length !== 1 ? 's' : ''}   ·   Emissão: {agora}</Text>
        </View>
      </View>

      <View style={s.leilaoBox}>
        <View>
          <Text style={s.leilaoLabel}>Leilão</Text>
          <Text style={s.leilaoNome}>{grupo.leilao || '—'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.leilaoLabel}>Data do Leilão</Text>
          <Text style={s.leilaoData}>{grupo.datlei || '—'}</Text>
        </View>
      </View>

      <View style={s.duasColunas}>
        <View style={s.colBox}>
          <Text style={s.secLabel}>Comprador{grupo.modo === 'vendedor' ? `es (${grupo.contrapartes.length})` : ''}</Text>
          {comp ? (
            <>
              <Text style={s.nomeXX}>{comp.nomexx || '—'}</Text>
              <Text style={s.cpfXX}>{docContraparte(comp)}</Text>
              {enderecoComp ? <Text style={s.endereco}>{enderecoComp}</Text> : null}
              {cidadeComp   ? <Text style={s.endereco}>{cidadeComp}{comp.cepxxx ? `  CEP ${comp.cepxxx}` : ''}</Text> : null}
              {(comp.celu1 || comp.telres) ? <Text style={s.telefone}>Tel: {comp.celu1 || comp.telres}</Text> : null}
              {comp.emailx ? <Text style={s.telefone}>{comp.emailx}</Text> : null}
              {comp.nomePropriedade ? (
                <View style={s.propBox}>
                  <Text style={s.propLabel}>Propriedade</Text>
                  <Text style={s.propText}>{comp.nomePropriedade}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={s.parceirosLista}>
              {grupo.contrapartes.map(p => (
                <Text key={p.id} style={s.parceiroLinha}>{p.nomexx || '—'} · {docContraparte(p)}</Text>
              ))}
            </View>
          )}
        </View>
        <View style={s.colBox}>
          <Text style={s.secLabel}>Vendedor{grupo.modo === 'comprador' ? `es (${grupo.contrapartes.length})` : ''}</Text>
          {ven ? (
            <>
              <Text style={s.nomeXX}>{ven.nomexx || '—'}</Text>
              <Text style={s.cpfXX}>{docContraparte(ven)}</Text>
              {enderecoVen ? <Text style={s.endereco}>{enderecoVen}</Text> : null}
              {cidadeVen   ? <Text style={s.endereco}>{cidadeVen}{ven.cepxxx ? `  CEP ${ven.cepxxx}` : ''}</Text> : null}
              {(ven.celu1 || ven.telres) ? <Text style={s.telefone}>Tel: {ven.celu1 || ven.telres}</Text> : null}
              {ven.emailx ? <Text style={s.telefone}>{ven.emailx}</Text> : null}
            </>
          ) : (
            <View style={s.parceirosLista}>
              {grupo.contrapartes.map(p => (
                <Text key={p.id} style={s.parceiroLinha}>{p.nomexx || '—'} · {docContraparte(p)}</Text>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Tabela de lotes */}
      <View style={s.tabela}>
        <View style={s.tHeader}>
          <View style={s.cLote}><Text style={s.th}>Lote</Text></View>
          <View style={s.cDesc}><Text style={s.th}>Descrição</Text></View>
          {tituloColunaParceiro ? <View style={s.cParceiro}><Text style={s.th}>{tituloColunaParceiro}</Text></View> : null}
          <View style={s.cCond}><Text style={s.th}>Cond. Pagamento</Text></View>
          <View style={s.cBruto}><Text style={[s.th, { textAlign: 'right' }]}>Vlr. Bruto</Text></View>
          {isVendedor ? (
            <>
              <View style={s.cComVen}><Text style={[s.th, { textAlign: 'right' }]}>Comissão Vend.</Text></View>
              <View style={s.cSinal}><Text style={[s.th, { textAlign: 'right' }]}>Sinal/1ª Parc.</Text></View>
            </>
          ) : (
            <>
              <View style={s.cLiquido}><Text style={[s.th, { textAlign: 'right' }]}>Vlr. Líquido</Text></View>
              <View style={s.cSinal}><Text style={[s.th, { textAlign: 'right' }]}>Sinal/1ª Parc.</Text></View>
            </>
          )}
        </View>
        {grupo.lotes.map((l, i) => {
          const primeira = l.parcelas.find(p => p.pripar === 'S');
          const sinal = primeira ? primeira.vlrpar : l.valorPagar;
          return (
            <View key={l.idMc} style={i % 2 === 1 ? [s.tRow, s.tRowAlt] : s.tRow} wrap={false}>
              <View style={s.cLote}><Text style={s.tdBold}>{l.lotexx || '—'}</Text></View>
              <View style={s.cDesc}>
                <Text style={s.td}>{l.deslot || '—'}</Text>
                <Text style={{ fontSize: 6, color: MEDIO }}>
                  {[l.descricaoRaca, l.catego ? CATEGO[l.catego] || l.catego : null, l.sbbxxx ? `${labelSBB(l.especies)} ${l.sbbxxx}` : null, l.rpxxx ? `${labelRP(l.especies)} ${l.rpxxx}` : null]
                    .filter(Boolean).join(' · ')}
                </Text>
              </View>
              {tituloColunaParceiro ? <View style={s.cParceiro}><Text style={s.td}>{l.nomeContraparte || '—'}</Text></View> : null}
              <View style={s.cCond}>
                <Text style={s.td}>{l.desfin || '—'}</Text>
                {fmtFidelidade(l.tipoDescontoFidelidade, l.descontoFidelidade) ? (
                  <Text style={{ fontSize: 6, color: MEDIO }}>Fidelidade: {fmtFidelidade(l.tipoDescontoFidelidade, l.descontoFidelidade)}</Text>
                ) : null}
              </View>
              <View style={s.cBruto}><Text style={s.td}>{fmtR(l.valorOriginal)}</Text></View>
              {isVendedor ? (
                <>
                  <View style={s.cComVen}><Text style={s.td}>{fmtR(l.valorComissaoVendedor)}</Text></View>
                  <View style={s.cSinal}><Text style={s.tdBold}>{fmtR(sinal)}</Text></View>
                </>
              ) : (
                <>
                  <View style={s.cLiquido}><Text style={s.td}>{fmtR(l.valorPagar)}</Text></View>
                  <View style={s.cSinal}><Text style={s.tdBold}>{fmtR(sinal)}</Text></View>
                </>
              )}
            </View>
          );
        })}
      </View>

      {/* Totalizador de parcelamentos — agrupado por data de vencimento */}
      {parcelasAgrupadas.length > 0 && (
        <View style={s.parcelasBox}>
          <Text style={{ fontSize: 5.5, color: MEDIO, padding: '2 4', fontStyle: 'italic' }}>
            Valores somados de todos os lotes com vencimento na mesma data
          </Text>
          <View style={s.parcelasHeader}>
            {[0, 1, 2].map(c => (
              <View key={c} style={[s.cGrupo, c > 0 ? s.cGrupoSep : {}]}>
                <View style={s.cDatP}><Text style={s.thP}>Vencimento</Text></View>
                <View style={s.cVlrP}><Text style={s.thPRight}>Valor</Text></View>
              </View>
            ))}
          </View>
          {linhasParc.map((linha, li) => (
            <View key={li} wrap={false} style={[s.parcRow3, li % 2 === 1 ? s.parcRowAlt : {}]}>
              {linha.map((p, ci) => (
                <View key={ci} style={[s.cGrupo, ci > 0 ? s.cGrupoSep : {}]}>
                  {p ? (
                    <View style={{ flexDirection: 'row', flex: 1 }}>
                      <View style={s.cDatP}><Text style={p.temSinal ? s.tdPBold : s.tdP}>{p.datven || '—'}</Text></View>
                      <View style={s.cVlrP}><Text style={p.temSinal ? s.tdPBold : s.tdPRight}>{fmtR(p.vlrpar)}</Text></View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Totais */}
      <View style={s.acertoBox}>
        <Text style={[s.secLabel, { marginBottom: 6 }]}>Totais</Text>
        <View style={s.acertoGrid}>
          {isVendedor ? (
            <>
              <InfoItem label="Total Vendido" value={fmtR(grupo.totais.totalCompra)} />
              <InfoItem label="Total Comissão do Vendedor" value={fmtR(grupo.totais.totalComissaoVendedor)} />
              <InfoItem label="Total Desconto Fidelidade" value={fmtR(grupo.totais.totalDescontoFidelidade)} />
              <InfoItem label="Total Líquido ao Vendedor" value={fmtR(grupo.totais.totalLiquidoVendedor)} />
            </>
          ) : (
            <>
              <InfoItem label="Total da Compra" value={fmtR(grupo.totais.totalCompra)} />
              <InfoItem label="Total Pagto. à Vista" value={fmtR(grupo.totais.totalAVista)} />
              <InfoItem label="Total em Promissórias" value={fmtR(grupo.totais.totalPromissorias)} />
              <InfoItem label="Total do Sinal / 1ª Parcela(s)" value={fmtR(grupo.totais.totalSinal)} />
              <InfoItem label="Total da Comissão" value={fmtR(grupo.totais.totalComissao)} />
              <InfoItem label="Total Desconto p/ Pagto. à Vista" value={fmtR(grupo.totais.totalDesconto)} />
              <InfoItem label="Total Desconto Fidelidade" value={fmtR(grupo.totais.totalDescontoFidelidade)} />
            </>
          )}
        </View>
      </View>

      {/* Recibos por extenso — não fazem sentido na fatura de vendedor (o dinheiro
          sempre vem do comprador, que assina o próprio recibo na fatura dele). */}
      {!isVendedor && comp ? (
        <View wrap={false}>
          <View style={s.reciboBox}>
            <Text style={s.reciboLabel}>Recebemos de:</Text>
            <Text style={s.reciboNome}>{comp.nomexx || '—'}</Text>
            <Text style={s.reciboLabel}>a quantia de, referente ao pagamento do sinal - 1ª parcela(s):</Text>
            <Text style={s.reciboExtenso}>{valorExtenso(grupo.totais.totalSinal)}</Text>
          </View>
          <View style={s.reciboBox}>
            <Text style={s.reciboLabel}>Recebemos de:</Text>
            <Text style={s.reciboNome}>{comp.nomexx || '—'}</Text>
            <Text style={s.reciboLabel}>a quantia de, referente ao pagamento da comissão à leiloeira:</Text>
            <Text style={s.reciboExtenso}>{valorExtenso(grupo.totais.totalComissao)}</Text>
          </View>
        </View>
      ) : null}

      {/* Assinaturas — só quem é parte única do grupo assina: na fatura de vendedor,
          só o vendedor; na fatura de comprador, só o comprador; no par de sempre,
          os dois (nesse caso comp e ven são sempre não-nulos). A contraparte que
          varia (lista de contrapartes) nunca assina aqui — cada um assinou/assina
          a própria fatura individual, na hora da compra do respectivo lote. */}
      <View wrap={false} style={s.assinaturas}>
        {comp ? (
          <View style={s.assinaturaItem}>
            <View style={s.assinaturaLinha} />
            <Text style={s.assinaturaNome}>{comp.nomexx || 'Comprador'}</Text>
            <Text style={s.assinaturaRole}>Comprador</Text>
          </View>
        ) : null}
        {ven ? (
          <View style={s.assinaturaItem}>
            <View style={s.assinaturaLinha} />
            <Text style={s.assinaturaNome}>{ven.nomexx || 'Vendedor'}</Text>
            <Text style={s.assinaturaRole}>Vendedor</Text>
          </View>
        ) : null}
      </View>

      <View style={s.footer} fixed>
        <Text style={s.footerText}>{nomeEmpresa}</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>

    </Page>
  );
}

function RelatorioFaturaUnificada({ grupos, empresa, logoBase64 }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Document title="Fatura Unificada" author={nomeEmpresa}>
      {grupos.map((grupo, i) => paginaFatura(grupo, i, nomeEmpresa, agora, logoBase64))}
    </Document>
  );
}

export default RelatorioFaturaUnificada;
