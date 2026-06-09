import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import { Button, Radio, Space } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

type Orientacao = 'retrato' | 'paisagem';

export interface VendaPDF {
  id: number;
  lotexx?: string;
  deslot?: string;
  descricaoRaca?: string;
  especies?: string;
  nomeVendedor?: string;
  nomeComprador?: string;
  qtdxxx?: number;
  valorUnidade?: number;
  valorPagar?: number;
  valorComissao?: number;
  valorDesconto?: number;
  valorLiquido?: number;
  desfin?: string;
  defesa?: string;
}

export interface TotaisVendas {
  totalLotes: number;
  totalValor: number;
  totalComissao: number;
  totalDesconto: number;
  totalLiquido: number;
  totalQtd: number;
  mediaGeral: number;
  mediasCategoria?: {
    key: string;
    categoria: string;
    qtd: number;
    valor: number;
    media: number;
  }[];
}

interface Props {
  vendas: VendaPDF[];
  totais: TotaisVendas;
  titulo?: string;
  empresa?: string;
  filtrosDesc?: string;
}

const AZUL       = '#001529';
const AZUL_CLARO = '#1677ff';
const VERDE      = '#52c41a';
const LARANJA    = '#fa8c16';
const VERMELHO   = '#ff4d4f';
const CINZA      = '#d9d9d9';

const fmtR = (v?: number | null) =>
  v != null && v !== 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const fmtN = (v?: number | null) =>
  v != null && v !== 0
    ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
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

  // Cabeçalho
  header: {
    backgroundColor: AZUL,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 108, height: 33, objectFit: 'contain', marginRight: 14 },
  headerTitleBox: { flexDirection: 'column', justifyContent: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  headerSub: { color: '#a0b4c8', fontSize: 7.5, marginTop: 2 },
  headerFiltro: { color: '#6894b4', fontSize: 7, marginTop: 2, fontStyle: 'italic' },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { color: '#a0b4c8', fontSize: 7 },
  headerCount: { color: '#ffffff', fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 3 },

  // Linha de resumo financeiro
  resumo: {
    flexDirection: 'row',
    backgroundColor: '#f0f6ff',
    borderRadius: 4,
    borderColor: '#c8deff',
    borderWidth: 1,
    marginBottom: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  resumoItem: { flexDirection: 'column', alignItems: 'center', flex: 1 },
  resumoSep: { width: 1, backgroundColor: '#d0e0ff', marginVertical: 2 },
  resumoLabel: { fontSize: 6, color: '#888', marginBottom: 2, textAlign: 'center' as const },
  resumoValor: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' as const },
  mediasBox: {
    borderColor: '#e8f0fe',
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 7,
  },
  mediasTitle: {
    backgroundColor: '#f5f8ff',
    color: AZUL,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediasRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderTopColor: '#e8f0fe',
    borderTopWidth: 0.5,
  },
  mediaCat: { flex: 1, fontSize: 6.5 },
  mediaQtd: { width: 45, fontSize: 6.5, textAlign: 'right' as const },
  mediaValor: { width: 70, fontSize: 6.5, textAlign: 'right' as const },
  mediaMedia: { width: 70, fontSize: 6.5, textAlign: 'right' as const, fontFamily: 'Helvetica-Bold', color: '#722ed1' },

  // Cabeçalho da tabela
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: AZUL,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    marginBottom: 0,
  },
  th: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  thCenter: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'center' as const },

  // Linhas
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomColor: '#e8f0fe',
    borderBottomWidth: 0.5,
  },
  rowAlt: { backgroundColor: '#f5f8ff' },

  // Colunas
  cLote:     { width: 42 },
  cDes:      { flex: 1 },
  cRaca:     { width: 82 },
  cVend:     { width: 106 },
  cComp:     { width: 106 },
  cQtd:      { width: 35 },
  cPagar:    { width: 80 },
  cComissao: { width: 72 },
  cLiquido:  { width: 80 },

  // Células
  tdNormal:      { fontSize: 7.5 },
  tdNormalRight: { fontSize: 7.5, textAlign: 'right' as const },
  tdSmall:       { fontSize: 7, color: '#555' },
  tdBold:        { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  tdBoldRight:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'right' as const },

  // Linha de totais
  totaisRow: {
    flexDirection: 'row',
    backgroundColor: AZUL,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginTop: 0,
  },
  tdTotLabel:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  tdTotVal:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  tdTotGreen:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#95de64', textAlign: 'right' as const },
  tdTotOrange: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ffd591', textAlign: 'right' as const },

  // Rodapé
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: CINZA,
    borderTopWidth: 0.5,
    paddingTop: 3,
  },
  footerText: { fontSize: 6, color: '#aaa' },
});

function ConsultaVendasPDF({
  vendas, totais, titulo, empresa, filtrosDesc, orientacao = 'paisagem',
}: Props & { orientacao?: Orientacao }) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const pageSize: any = orientacao === 'paisagem' ? [841.89, 595.28] : 'A4';
  const subtitulo = titulo || 'Todas as vendas';

  return (
    <Document title={`Relatório de Vendas — ${subtitulo}`} author={nomeEmpresa}>
      <Page size={pageSize} style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            <Image src={logotipoLocal} style={s.headerLogo} />
            <View style={s.headerTitleBox}>
              <Text style={s.headerTitle}>Relatório de Consulta de Vendas</Text>
              <Text style={s.headerSub}>{subtitulo}</Text>
              {filtrosDesc ? (
                <Text style={s.headerFiltro}>Filtros: {filtrosDesc}</Text>
              ) : null}
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>Gerado em: {agora}</Text>
            <Text style={s.headerCount}>
              {vendas.length} lote{vendas.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Resumo financeiro */}
        <View style={s.resumo} fixed>
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Total Lotes</Text>
            <Text style={[s.resumoValor, { color: AZUL_CLARO }]}>
              {totais.totalLotes.toLocaleString('pt-BR')}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Qtd. Total</Text>
            <Text style={[s.resumoValor, { color: AZUL_CLARO }]}>
              {fmtN(totais.totalQtd)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Valor Total</Text>
            <Text style={[s.resumoValor, { color: AZUL_CLARO }]}>
              {fmtR(totais.totalValor)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Comissão</Text>
            <Text style={[s.resumoValor, { color: LARANJA }]}>
              {fmtR(totais.totalComissao)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Descontos</Text>
            <Text style={[s.resumoValor, { color: VERMELHO }]}>
              {fmtR(totais.totalDesconto)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Valor Líquido</Text>
            <Text style={[s.resumoValor, { color: VERDE }]}>
              {fmtR(totais.totalLiquido)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Média/Cabeça</Text>
            <Text style={[s.resumoValor, { color: '#722ed1' }]}>
              {fmtR(totais.mediaGeral)}
            </Text>
          </View>
        </View>

        {/* Cabeçalho da tabela */}
        {totais.mediasCategoria?.length ? (
          <View style={s.mediasBox}>
            <Text style={s.mediasTitle}>Médias por Categoria</Text>
            <View style={[s.mediasRow, { backgroundColor: '#fbfdff' }]}>
              <Text style={[s.mediaCat, { fontFamily: 'Helvetica-Bold' }]}>Categoria</Text>
              <Text style={[s.mediaQtd, { fontFamily: 'Helvetica-Bold' }]}>Qtd.</Text>
              <Text style={[s.mediaValor, { fontFamily: 'Helvetica-Bold' }]}>Total</Text>
              <Text style={s.mediaMedia}>Média</Text>
            </View>
            {totais.mediasCategoria.map(cat => (
              <View key={cat.key} style={s.mediasRow} wrap={false}>
                <Text style={s.mediaCat}>{cat.categoria}</Text>
                <Text style={s.mediaQtd}>{fmtN(cat.qtd)}</Text>
                <Text style={s.mediaValor}>{fmtR(cat.valor)}</Text>
                <Text style={s.mediaMedia}>{fmtR(cat.media)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.tableHeader} fixed>
          <View style={s.cLote}><Text style={s.th}>Lote</Text></View>
          <View style={s.cDes}><Text style={s.th}>Descrição</Text></View>
          <View style={s.cRaca}><Text style={s.th}>Raça / Espécie</Text></View>
          <View style={s.cVend}><Text style={s.th}>Vendedor</Text></View>
          <View style={s.cComp}><Text style={s.th}>Comprador</Text></View>
          <View style={s.cQtd}><Text style={s.thRight}>Qtd</Text></View>
          <View style={s.cPagar}><Text style={s.thRight}>Vlr. a Pagar</Text></View>
          <View style={s.cComissao}><Text style={s.thRight}>Comissão</Text></View>
          <View style={s.cLiquido}><Text style={s.thRight}>Vlr. Líquido</Text></View>
        </View>

        {/* Linhas */}
        {vendas.map((v, i) => (
          <View key={v.id} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]} wrap={false}>
            <View style={s.cLote}>
              <Text style={[s.tdBold, { color: AZUL_CLARO }]}>{v.lotexx || '—'}</Text>
            </View>
            <View style={s.cDes}>
              <Text style={s.tdNormal}>{v.deslot || '—'}</Text>
            </View>
            <View style={s.cRaca}>
              <Text style={s.tdSmall}>
                {[v.descricaoRaca, v.especies].filter(Boolean).join(' / ') || '—'}
              </Text>
            </View>
            <View style={s.cVend}>
              <Text style={s.tdNormal}>{v.nomeVendedor || '—'}</Text>
            </View>
            <View style={s.cComp}>
              <Text style={s.tdNormal}>{v.nomeComprador || '—'}</Text>
            </View>
            <View style={s.cQtd}>
              <Text style={s.tdNormalRight}>{fmtN(v.qtdxxx)}</Text>
            </View>
            <View style={s.cPagar}>
              <Text style={s.tdBoldRight}>{fmtR(v.valorPagar)}</Text>
            </View>
            <View style={s.cComissao}>
              <Text style={[s.tdNormalRight, { color: LARANJA }]}>{fmtR(v.valorComissao)}</Text>
            </View>
            <View style={s.cLiquido}>
              <Text style={[s.tdBoldRight, { color: VERDE }]}>{fmtR(v.valorLiquido)}</Text>
            </View>
          </View>
        ))}

        {/* Linha de totais */}
        {vendas.length > 0 && (
          <View style={s.totaisRow}>
            <View style={s.cLote}><Text style={s.tdTotLabel} /></View>
            <View style={s.cDes}><Text style={s.tdTotLabel}>TOTAIS</Text></View>
            <View style={s.cRaca}><Text style={s.tdTotLabel} /></View>
            <View style={s.cVend}><Text style={s.tdTotLabel} /></View>
            <View style={s.cComp}><Text style={s.tdTotLabel} /></View>
            <View style={s.cQtd}>
              <Text style={s.tdTotVal}>{fmtN(totais.totalQtd)}</Text>
            </View>
            <View style={s.cPagar}>
              <Text style={s.tdTotVal}>{fmtR(totais.totalValor)}</Text>
            </View>
            <View style={s.cComissao}>
              <Text style={s.tdTotOrange}>{fmtR(totais.totalComissao)}</Text>
            </View>
            <View style={s.cLiquido}>
              <Text style={s.tdTotGreen}>{fmtR(totais.totalLiquido)}</Text>
            </View>
          </View>
        )}

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

export function BotaoBaixarPDFVendas({ vendas, totais, titulo, empresa, filtrosDesc }: Props) {
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const nomeArquivo = `consulta-vendas-${new Date().toISOString().slice(0, 10)}.pdf`;
  return (
    <Space size={4}>
      <Radio.Group
        value={orientacao}
        onChange={e => setOrientacao(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        size="small"
      >
        <Radio.Button value="retrato">Retrato</Radio.Button>
        <Radio.Button value="paisagem">Paisagem</Radio.Button>
      </Radio.Group>
      <PDFDownloadLink
        document={
          <ConsultaVendasPDF
            vendas={vendas}
            totais={totais}
            titulo={titulo}
            empresa={empresa}
            filtrosDesc={filtrosDesc}
            orientacao={orientacao}
          />
        }
        fileName={nomeArquivo}
        style={{ textDecoration: 'none' }}
      >
        {({ loading }) => (
          <Button icon={<PrinterOutlined />} loading={loading} disabled={vendas.length === 0}>
            {loading ? 'Gerando PDF...' : 'Imprimir PDF'}
          </Button>
        )}
      </PDFDownloadLink>
    </Space>
  );
}

export default ConsultaVendasPDF;
