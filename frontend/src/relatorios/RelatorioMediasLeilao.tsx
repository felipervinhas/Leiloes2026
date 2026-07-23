import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { TotaisVendas } from './RelatorioConsultaVendas';

interface Props {
  titulo?: string;
  empresa?: string;
  filtrosDesc?: string;
  logoBase64?: string | null;
  totais: TotaisVendas;
  dataLeilao?: string;
}

const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';
const CLARO  = '#f0f0f0';

const fmtR = (v?: number | null) =>
  v != null && v !== 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const fmtN = (v?: number | null) =>
  v != null && v !== 0
    ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
    : '—';

const fmtData = (v?: string) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: ESCURO,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
  },

  header: {
    borderBottomColor: ESCURO,
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 135, height: 48, objectFit: 'contain', marginRight: 12 },
  headerTitleBox: { flexDirection: 'column', justifyContent: 'center' },
  headerTitle: { color: ESCURO, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  headerSub: { color: MEDIO, fontSize: 8, marginTop: 2 },
  headerFiltro: { color: MEDIO, fontSize: 7, marginTop: 2, fontStyle: 'italic' },
  headerRight: { alignItems: 'flex-end' },
  headerData: { color: MEDIO, fontSize: 7.5 },

  resumo: {
    flexDirection: 'row',
    backgroundColor: CLARO,
    borderRadius: 4,
    borderColor: CINZA,
    borderWidth: 1,
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  resumoItem: { flexDirection: 'column', alignItems: 'center', flex: 1 },
  resumoSep: { width: 1, backgroundColor: CINZA, marginVertical: 2 },
  resumoLabel: { fontSize: 6.5, color: '#888', marginBottom: 3, textAlign: 'center' as const },
  resumoValor: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'center' as const, color: ESCURO },

  tabela: { borderWidth: 0.5, borderColor: CINZA, borderRadius: 3, overflow: 'hidden' },
  tHeader: { flexDirection: 'row', backgroundColor: ESCURO, paddingVertical: 6, paddingHorizontal: 8 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  row: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomColor: CINZA, borderBottomWidth: 0.5 },
  rowAlt: { backgroundColor: CLARO },
  cCategoria: { flex: 1 },
  cQtd: { width: 70, textAlign: 'right' as const },
  cValor: { width: 100, textAlign: 'right' as const },
  cMedia: { width: 100, textAlign: 'right' as const },
  td: { fontSize: 9 },
  tdRight: { fontSize: 9, textAlign: 'right' as const },
  tdMedia: { fontSize: 9, textAlign: 'right' as const, fontFamily: 'Helvetica-Bold', color: ESCURO },

  totaisRow: {
    flexDirection: 'row', backgroundColor: ESCURO,
    paddingVertical: 7, paddingHorizontal: 8,
  },
  tdTotLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff' },
  tdTotVal: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },

  footer: {
    position: 'absolute', bottom: 10, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopColor: CINZA, borderTopWidth: 0.5, paddingTop: 3,
  },
  footerText: { fontSize: 6, color: '#aaa' },
});

function MediasLeilaoPDF({ titulo, empresa, filtrosDesc, logoBase64, totais, dataLeilao }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const subtitulo = titulo || 'Todos os leilões';
  const dataLeilaoFmt = fmtData(dataLeilao);
  const medias = totais.mediasCategoria || [];

  return (
    <Document title={`Médias por Categoria — ${subtitulo}`} author={nomeEmpresa}>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image src={logoBase64 || logotipoLocal} style={s.headerLogo} />
            <View style={s.headerTitleBox}>
              <Text style={s.headerTitle}>Relatório de Médias por Categoria</Text>
              <Text style={s.headerSub}>{subtitulo}{dataLeilaoFmt ? `   ·   Data do Leilão: ${dataLeilaoFmt}` : ''}</Text>
              {filtrosDesc ? <Text style={s.headerFiltro}>Filtros: {filtrosDesc}</Text> : null}
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerData}>Gerado em: {agora}</Text>
          </View>
        </View>

        <View style={s.resumo}>
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Total Lotes</Text>
            <Text style={s.resumoValor}>{totais.totalLotes.toLocaleString('pt-BR')}</Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Qtd. Total</Text>
            <Text style={s.resumoValor}>{fmtN(totais.totalQtd)}</Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Valor Total</Text>
            <Text style={s.resumoValor}>{fmtR(totais.totalValor)}</Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Média Geral / Cabeça</Text>
            <Text style={[s.resumoValor, { color: '#722ed1' }]}>{fmtR(totais.mediaGeral)}</Text>
          </View>
        </View>

        <View style={s.tabela}>
          <View style={s.tHeader}>
            <View style={s.cCategoria}><Text style={s.th}>Categoria</Text></View>
            <View style={s.cQtd}><Text style={s.thRight}>Qtd.</Text></View>
            <View style={s.cValor}><Text style={s.thRight}>Total</Text></View>
            <View style={s.cMedia}><Text style={s.thRight}>Média</Text></View>
          </View>
          {medias.length === 0 ? (
            <Text style={{ padding: 12, textAlign: 'center', fontSize: 8, color: '#aaa', fontStyle: 'italic' }}>
              Nenhuma categoria encontrada
            </Text>
          ) : medias.map((cat, i) => (
            <View key={cat.key} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row} wrap={false}>
              <View style={s.cCategoria}><Text style={s.td}>{cat.categoria}</Text></View>
              <View style={s.cQtd}><Text style={s.tdRight}>{fmtN(cat.qtd)}</Text></View>
              <View style={s.cValor}><Text style={s.tdRight}>{fmtR(cat.valor)}</Text></View>
              <View style={s.cMedia}><Text style={s.tdMedia}>{fmtR(cat.media)}</Text></View>
            </View>
          ))}
          {medias.length > 0 && (
            <View style={s.totaisRow}>
              <View style={s.cCategoria}><Text style={s.tdTotLabel}>TOTAIS</Text></View>
              <View style={s.cQtd}><Text style={s.tdTotVal}>{fmtN(totais.totalQtd)}</Text></View>
              <View style={s.cValor}><Text style={s.tdTotVal}>{fmtR(totais.totalValor)}</Text></View>
              <View style={s.cMedia}><Text style={s.tdTotVal}>{fmtR(totais.mediaGeral)}</Text></View>
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomeEmpresa} — Sistema de Gestão</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

export default MediasLeilaoPDF;
