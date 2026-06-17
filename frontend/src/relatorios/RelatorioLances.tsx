import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import { Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

export interface LancePDF {
  id: number;
  idLote: number;
  lotexx?: string;
  deslot?: string;
  nomeCliente?: string;
  celu1?: string;
  celu2?: string;
  valor?: number;
}

interface DocProps {
  lances: LancePDF[];
  leilao: string;
  empresa?: string;
}

const AZUL  = '#001529';
const VERDE = '#52c41a';
const CINZA = '#f5f5f5';

const fmtR = (v?: number | null) =>
  v != null
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#222',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
  },

  headerRow: {
    backgroundColor: AZUL,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 108, height: 33, objectFit: 'contain', marginRight: 14 },
  headerTitleBox: { flexDirection: 'column' },
  headerTitle: { color: '#fff', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  headerSub:   { color: '#a0b4c8', fontSize: 7.5, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDate:  { color: '#a0b4c8', fontSize: 7 },
  headerCount: { color: '#fff', fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 3 },

  loteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a3a5c',
    padding: '5pt 8pt',
    marginTop: 10,
    borderRadius: 2,
  },
  loteTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#fff' },
  loteQtd:   { fontSize: 7, color: '#8ab4d8' },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#dde6f5',
    borderBottom: '0.5pt solid #aac',
    padding: '3pt 6pt',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.3pt solid #eee',
    padding: '3pt 6pt',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.3pt solid #eee',
    padding: '3pt 6pt',
    backgroundColor: CINZA,
  },

  colNome:     { flex: 3 },
  colTelefone: { flex: 2 },
  colValor:    { flex: 1.5, textAlign: 'right' },

  headerCell: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: '#445' },
  cell:       { fontSize: 7.5 },
  valorCell:  { fontSize: 7.5, color: VERDE, fontFamily: 'Helvetica-Bold' },

  footer: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '0.5pt solid #ccc',
    paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: '#999' },
});

function LancesDoc({ lances, leilao, empresa }: DocProps) {
  // Agrupa por lote mantendo a ordem recebida (API já ordena por IDLOTE)
  const mapaGrupos = new Map<number, { lotexx: string; deslot: string; lances: LancePDF[] }>();
  for (const l of lances) {
    if (!mapaGrupos.has(l.idLote)) {
      mapaGrupos.set(l.idLote, { lotexx: l.lotexx || '', deslot: l.deslot || '', lances: [] });
    }
    mapaGrupos.get(l.idLote)!.lances.push(l);
  }

  // Ordena lotes numericamente pelo número do lote
  const grupos = Array.from(mapaGrupos.entries())
    .map(([idLote, g]) => ({ idLote, ...g }))
    .sort((a, b) => {
      const na = parseInt(a.lotexx, 10);
      const nb = parseInt(b.lotexx, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.lotexx.localeCompare(b.lotexx);
    });

  const totalLances = lances.length;
  const agora = new Date().toLocaleDateString('pt-BR');

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.headerRow} fixed>
          <View style={s.headerLeft}>
            <Image src={logotipoLocal} style={s.headerLogo} />
            <View style={s.headerTitleBox}>
              <Text style={s.headerTitle}>Relatório de Lances</Text>
              <Text style={s.headerSub}>{leilao}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>Gerado em {agora}</Text>
            <Text style={s.headerCount}>{totalLances} lance{totalLances !== 1 ? 's' : ''} · {grupos.length} lote{grupos.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Blocos por lote */}
        {grupos.map(grupo => (
          <View key={grupo.idLote}>
            {/* Cabeçalho do lote + cabeçalho da tabela ficam juntos na mesma página */}
            <View wrap={false}>
              <View style={s.loteHeader}>
                <Text style={s.loteTitulo}>Lote {grupo.lotexx} — {grupo.deslot}</Text>
                <Text style={s.loteQtd}>{grupo.lances.length} lance{grupo.lances.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={s.tableHeader}>
                <Text style={[s.colNome, s.headerCell]}>Nome</Text>
                <Text style={[s.colTelefone, s.headerCell]}>Telefone(s)</Text>
                <Text style={[s.colValor, s.headerCell]}>Valor</Text>
              </View>
            </View>

            {/* Linhas dos lances — valor DESC (já vem ordenado da API) */}
            {grupo.lances.map((l, i) => (
              <View key={l.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.colNome, s.cell]}>{l.nomeCliente || '—'}</Text>
                <Text style={[s.colTelefone, s.cell]}>
                  {[l.celu1, l.celu2].filter(Boolean).join(' / ') || '—'}
                </Text>
                <Text style={[s.colValor, s.valorCell]}>{fmtR(l.valor)}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{empresa || ''}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

interface BotaoProps {
  lances: LancePDF[];
  leilao: string;
  empresa?: string;
}

export default function BotaoBaixarLancesPDF({ lances, leilao, empresa }: BotaoProps) {
  const nomeArquivo = `lances-${leilao.replace(/[^a-zA-Z0-9À-ú]/g, '-').toLowerCase()}.pdf`;
  return (
    <PDFDownloadLink
      document={<LancesDoc lances={lances} leilao={leilao} empresa={empresa} />}
      fileName={nomeArquivo}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }: { loading: boolean }) => (
        <Button type="primary" size="large" icon={<PrinterOutlined />} loading={loading} style={{ width: '100%' }}>
          {loading ? 'Gerando PDF...' : 'Baixar Relatório PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
