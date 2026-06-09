import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import { Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

export interface LoteOrdemPDF {
  id: number;
  lotexx: string;
  deslot?: string;
  nomeVendedor?: string;
  nomeRaca?: string;
  catego?: string;
  ordem: string;
}

interface Props {
  lotes: LoteOrdemPDF[];
  titulo?: string;
  empresa?: string;
}

const AZUL = '#001529';
const AZUL_CLARO = '#1677ff';
const CINZA = '#d9d9d9';

const SEXO: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#222',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
  },

  header: {
    backgroundColor: AZUL,
    borderRadius: 4,
    padding: '8 14',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerEsquerda: { flexDirection: 'column', justifyContent: 'center' },
  headerLogo: { width: 110, height: 34, objectFit: 'contain', marginBottom: 2 },
  headerSub: { color: '#a0b4c8', fontSize: 8, marginTop: 2 },
  headerDireita: { alignItems: 'flex-end' },
  headerData: { color: '#a0b4c8', fontSize: 7 },
  headerTotal: { color: '#fff', fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 2 },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f2f5',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomColor: CINZA,
    borderBottomWidth: 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
  },
  rowAlt: { backgroundColor: '#fafafa' },

  // Cabeçalhos das colunas
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#444' },

  // Células
  cOrdem:  { width: 42 },
  cLote:   { width: 48 },
  cDes:    { flex: 1 },
  cVend:   { width: 150 },
  cRaca:   { width: 100 },
  cSexo:   { width: 50 },

  tdOrdem: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL_CLARO },
  tdNormal: { fontSize: 8 },
  tdRaca:  { fontSize: 7.5, color: '#555' },
  tdSexo:  { fontSize: 8, textAlign: 'center' as const },

  footer: {
    position: 'absolute',
    bottom: 12,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: CINZA,
    borderTopWidth: 1,
    paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: '#aaa' },
});

function OrdemEntradaPDF({ lotes, titulo, empresa }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const subtitulo = titulo ? `Ordem de Entrada — ${titulo}` : 'Ordem de Entrada';

  return (
    <Document title={subtitulo} author={nomeEmpresa}>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header} fixed>
          <View style={s.headerEsquerda}>
            <Image src={logotipoLocal} style={s.headerLogo} />
            <Text style={s.headerSub}>{subtitulo}</Text>
          </View>
          <View style={s.headerDireita}>
            <Text style={s.headerData}>Gerado em: {agora}</Text>
            <Text style={s.headerTotal}>{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Cabeçalho da tabela */}
        <View style={s.tableHeader} fixed>
          <View style={s.cOrdem}><Text style={s.th}>Ordem</Text></View>
          <View style={s.cLote}><Text style={s.th}>Lote</Text></View>
          <View style={s.cDes}><Text style={s.th}>Descrição</Text></View>
          <View style={s.cVend}><Text style={s.th}>Vendedor</Text></View>
          <View style={s.cRaca}><Text style={s.th}>Raça</Text></View>
          <View style={s.cSexo}><Text style={[s.th, { textAlign: 'center' }]}>Sexo</Text></View>
        </View>

        {/* Linhas */}
        {lotes.map((l, i) => (
          <View key={l.id} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]} wrap={false}>
            <View style={s.cOrdem}><Text style={s.tdOrdem}>{l.ordem || '—'}</Text></View>
            <View style={s.cLote}><Text style={s.tdNormal}>{l.lotexx}</Text></View>
            <View style={s.cDes}><Text style={s.tdNormal}>{l.deslot || '—'}</Text></View>
            <View style={s.cVend}><Text style={s.tdNormal}>{l.nomeVendedor || '—'}</Text></View>
            <View style={s.cRaca}><Text style={s.tdRaca}>{l.nomeRaca || '—'}</Text></View>
            <View style={s.cSexo}><Text style={s.tdSexo}>{SEXO[l.catego || ''] || l.catego || '—'}</Text></View>
          </View>
        ))}

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomeEmpresa} — Sistema de Gestão</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

export function BotaoBaixarPDFOrdem({ lotes, titulo, empresa }: Props) {
  const nomeArquivo = `ordem-entrada-${new Date().toISOString().slice(0, 10)}.pdf`;
  return (
    <PDFDownloadLink
      document={<OrdemEntradaPDF lotes={lotes} titulo={titulo} empresa={empresa} />}
      fileName={nomeArquivo}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <Button icon={<PrinterOutlined />} loading={loading} disabled={lotes.length === 0}>
          {loading ? 'Gerando PDF...' : 'Imprimir'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

export default OrdemEntradaPDF;
