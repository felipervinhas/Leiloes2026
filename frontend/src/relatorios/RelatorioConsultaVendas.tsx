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
  parcelas?: Array<{ ordxxx?: string; datven?: string; vlrpar?: number; pripar?: string }>;
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
  logoBase64?: string | null;
  /** Chaves de COLUNAS_CONSULTA_VENDAS a exibir no PDF. Se omitido, mostra todas (comportamento atual). */
  colunasVisiveis?: string[];
}

/** Catálogo de colunas que o usuário pode ocultar/mostrar no PDF de Consulta de Vendas. */
export const COLUNAS_CONSULTA_VENDAS = [
  { key: 'lote', label: 'Lote' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'raca', label: 'Raça / Espécie' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'comprador', label: 'Comprador' },
  { key: 'qtd', label: 'Qtd' },
  { key: 'valorPagar', label: 'Vlr. a Pagar' },
  { key: 'comissao', label: 'Comissão' },
  { key: 'liquido', label: 'Vlr. Líquido' },
];

const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';
const CLARO  = '#f0f0f0';

const fmtR = (v?: number | null) =>
  v != null && v !== 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

function parseDataBr(str?: string): Date | null {
  if (!str) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

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
    borderBottomColor: ESCURO,
    borderBottomWidth: 2,
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
  headerTitle: { color: ESCURO, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  headerSub: { color: MEDIO, fontSize: 7.5, marginTop: 2 },
  headerFiltro: { color: MEDIO, fontSize: 7, marginTop: 2, fontStyle: 'italic' },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { color: MEDIO, fontSize: 7 },
  headerCount: { color: ESCURO, fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 3 },

  // Linha de resumo financeiro
  resumo: {
    flexDirection: 'row',
    backgroundColor: CLARO,
    borderRadius: 4,
    borderColor: CINZA,
    borderWidth: 1,
    marginBottom: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  resumoItem: { flexDirection: 'column', alignItems: 'center', flex: 1 },
  resumoSep: { width: 1, backgroundColor: CINZA, marginVertical: 2 },
  resumoLabel: { fontSize: 6, color: '#888', marginBottom: 2, textAlign: 'center' as const },
  resumoValor: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' as const },
  mediasBox: {
    borderColor: CINZA,
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 7,
  },
  mediasTitle: {
    backgroundColor: CLARO,
    color: ESCURO,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediasRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderTopColor: CINZA,
    borderTopWidth: 0.5,
  },
  mediaCat: { flex: 1, fontSize: 6.5 },
  mediaQtd: { width: 45, fontSize: 6.5, textAlign: 'right' as const },
  mediaValor: { width: 70, fontSize: 6.5, textAlign: 'right' as const },
  mediaMedia: { width: 70, fontSize: 6.5, textAlign: 'right' as const, fontFamily: 'Helvetica-Bold', color: ESCURO },

  // Cabeçalho da tabela
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: ESCURO,
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
    borderBottomColor: CINZA,
    borderBottomWidth: 0.5,
  },
  rowAlt: { backgroundColor: CLARO },

  // Colunas — larguras em % (não pt fixo) pra caber tanto em paisagem quanto em
  // retrato; em pt fixo a soma das colunas já estourava sozinha a página retrato
  // (603pt de colunas fixas > 555pt úteis de uma A4 em pé), fazendo o texto
  // desenhar por cima um do outro.
  cLote:     { width: '5.3%' },
  cDes:      { flex: 1 },
  cRaca:     { width: '10.3%' },
  cVend:     { width: '13.3%' },
  cComp:     { width: '13.3%' },
  cQtd:      { width: '4.4%' },
  cPagar:    { width: '10%' },
  cComissao: { width: '9%' },
  cLiquido:  { width: '10%' },

  // Células
  tdNormal:      { fontSize: 7.5 },
  tdNormalRight: { fontSize: 7.5, textAlign: 'right' as const },
  tdSmall:       { fontSize: 7, color: '#555' },
  tdBold:        { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  tdBoldRight:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'right' as const },

  // Linha de totais
  totaisRow: {
    flexDirection: 'row',
    backgroundColor: ESCURO,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginTop: 0,
  },
  tdTotLabel:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  tdTotVal:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  tdTotGreen:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  tdTotOrange: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ddd', textAlign: 'right' as const },

  // Parcelas agrupadas por vencimento
  parcelasBox: {
    borderRadius: 3, borderColor: CINZA, borderWidth: 1, marginBottom: 8, overflow: 'hidden',
  },
  parcelasTitulo: {
    backgroundColor: CLARO, color: ESCURO, fontSize: 7, fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  parcelasHeader: { backgroundColor: ESCURO, flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6 },
  thP: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thPRight: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  parcRow: { flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 6, borderTopColor: CINZA, borderTopWidth: 0.5 },
  parcRowAlt: { backgroundColor: CLARO },
  cGrupo: { flex: 1, flexDirection: 'row' },
  cGrupoSep: { borderLeftColor: CINZA, borderLeftWidth: 0.5, paddingLeft: 4 },
  cDatP: { flex: 1 },
  cVlrP: { width: 70, textAlign: 'right' as const },
  tdP: { fontSize: 7, color: ESCURO },
  tdPRight: { fontSize: 7, color: ESCURO, textAlign: 'right' as const },

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
  vendas, totais, titulo, empresa, filtrosDesc, logoBase64, colunasVisiveis, orientacao = 'paisagem',
}: Props & { orientacao?: Orientacao }) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const pageSize: any = orientacao === 'paisagem' ? [841.89, 595.28] : 'A4';
  const subtitulo = titulo || 'Todas as vendas';
  const v = (chave: string) => !colunasVisiveis || colunasVisiveis.includes(chave);

  // Parcelas de todas as vendas listadas, somadas por data de vencimento —
  // mesmo padrão da Fatura Unificada, senão uma consulta com muitos lotes
  // parcelados geraria uma lista enorme (lotes x parcelas).
  const porData = new Map<string, { datven: string; vlrpar: number; temSinal: boolean }>();
  for (const venda of vendas) {
    for (const p of venda.parcelas || []) {
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
  for (let i = 0; i < parcelasAgrupadas.length; i += 4) {
    linhasParc.push([parcelasAgrupadas[i] || null, parcelasAgrupadas[i + 1] || null, parcelasAgrupadas[i + 2] || null, parcelasAgrupadas[i + 3] || null]);
  }

  return (
    <Document title={`Relatório de Vendas — ${subtitulo}`} author={nomeEmpresa}>
      <Page size={pageSize} style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            <Image src={logoBase64 || logotipoLocal} style={s.headerLogo} />
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
            <Text style={[s.resumoValor, { color: ESCURO }]}>
              {totais.totalLotes.toLocaleString('pt-BR')}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Qtd. Total</Text>
            <Text style={[s.resumoValor, { color: ESCURO }]}>
              {fmtN(totais.totalQtd)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Valor Total</Text>
            <Text style={[s.resumoValor, { color: ESCURO }]}>
              {fmtR(totais.totalValor)}
            </Text>
          </View>
          {v('comissao') && (
            <>
              <View style={s.resumoSep} />
              <View style={s.resumoItem}>
                <Text style={s.resumoLabel}>Comissão</Text>
                <Text style={[s.resumoValor, { color: ESCURO }]}>
                  {fmtR(totais.totalComissao)}
                </Text>
              </View>
            </>
          )}
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Descontos</Text>
            <Text style={[s.resumoValor, { color: ESCURO }]}>
              {fmtR(totais.totalDesconto)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Valor Líquido</Text>
            <Text style={[s.resumoValor, { color: '#000' }]}>
              {fmtR(totais.totalLiquido)}
            </Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Média/Cabeça</Text>
            <Text style={[s.resumoValor, { color: ESCURO }]}>
              {fmtR(totais.mediaGeral)}
            </Text>
          </View>
        </View>

        {/* Cabeçalho da tabela */}
        {totais.mediasCategoria?.length ? (
          <View style={s.mediasBox}>
            <Text style={s.mediasTitle}>Médias por Categoria</Text>
            <View style={[s.mediasRow, { backgroundColor: CLARO }]}>
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
          {v('lote') && <View style={s.cLote}><Text style={s.th}>Lote</Text></View>}
          {v('descricao') && <View style={s.cDes}><Text style={s.th}>Descrição</Text></View>}
          {v('raca') && <View style={s.cRaca}><Text style={s.th}>Raça / Espécie</Text></View>}
          {v('vendedor') && <View style={s.cVend}><Text style={s.th}>Vendedor</Text></View>}
          {v('comprador') && <View style={s.cComp}><Text style={s.th}>Comprador</Text></View>}
          {v('qtd') && <View style={s.cQtd}><Text style={s.thRight}>Qtd</Text></View>}
          {v('valorPagar') && <View style={s.cPagar}><Text style={s.thRight}>Vlr. a Pagar</Text></View>}
          {v('comissao') && <View style={s.cComissao}><Text style={s.thRight}>Comissão</Text></View>}
          {v('liquido') && <View style={s.cLiquido}><Text style={s.thRight}>Vlr. Líquido</Text></View>}
        </View>

        {/* Linhas */}
        {vendas.map((venda, i) => (
          <View key={venda.id} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]} wrap={false}>
            {v('lote') && (
              <View style={s.cLote}>
                <Text style={[s.tdBold, { color: ESCURO }]}>{venda.lotexx || '—'}</Text>
              </View>
            )}
            {v('descricao') && (
              <View style={s.cDes}>
                <Text style={s.tdNormal}>{venda.deslot || '—'}</Text>
              </View>
            )}
            {v('raca') && (
              <View style={s.cRaca}>
                <Text style={s.tdSmall}>
                  {[venda.descricaoRaca, venda.especies].filter(Boolean).join(' / ') || '—'}
                </Text>
              </View>
            )}
            {v('vendedor') && (
              <View style={s.cVend}>
                <Text style={s.tdNormal}>{venda.nomeVendedor || '—'}</Text>
              </View>
            )}
            {v('comprador') && (
              <View style={s.cComp}>
                <Text style={s.tdNormal}>{venda.nomeComprador || '—'}</Text>
              </View>
            )}
            {v('qtd') && (
              <View style={s.cQtd}>
                <Text style={s.tdNormalRight}>{fmtN(venda.qtdxxx)}</Text>
              </View>
            )}
            {v('valorPagar') && (
              <View style={s.cPagar}>
                <Text style={s.tdBoldRight}>{fmtR(venda.valorPagar)}</Text>
              </View>
            )}
            {v('comissao') && (
              <View style={s.cComissao}>
                <Text style={[s.tdNormalRight, { color: ESCURO }]}>{fmtR(venda.valorComissao)}</Text>
              </View>
            )}
            {v('liquido') && (
              <View style={s.cLiquido}>
                <Text style={[s.tdBoldRight, { color: '#000' }]}>{fmtR(venda.valorLiquido)}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Linha de totais */}
        {vendas.length > 0 && (
          <View style={s.totaisRow}>
            {v('lote') && <View style={s.cLote}><Text style={s.tdTotLabel} /></View>}
            {v('descricao') && <View style={s.cDes}><Text style={s.tdTotLabel}>TOTAIS</Text></View>}
            {v('raca') && <View style={s.cRaca}><Text style={s.tdTotLabel} /></View>}
            {v('vendedor') && <View style={s.cVend}><Text style={s.tdTotLabel} /></View>}
            {v('comprador') && <View style={s.cComp}><Text style={s.tdTotLabel} /></View>}
            {v('qtd') && (
              <View style={s.cQtd}>
                <Text style={s.tdTotVal}>{fmtN(totais.totalQtd)}</Text>
              </View>
            )}
            {v('valorPagar') && (
              <View style={s.cPagar}>
                <Text style={s.tdTotVal}>{fmtR(totais.totalValor)}</Text>
              </View>
            )}
            {v('comissao') && (
              <View style={s.cComissao}>
                <Text style={s.tdTotOrange}>{fmtR(totais.totalComissao)}</Text>
              </View>
            )}
            {v('liquido') && (
              <View style={s.cLiquido}>
                <Text style={s.tdTotGreen}>{fmtR(totais.totalLiquido)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Parcelas — somadas por data de vencimento entre todos os lotes listados */}
        {parcelasAgrupadas.length > 0 && (
          <View style={s.parcelasBox}>
            <Text style={s.parcelasTitulo}>Parcelas por Vencimento</Text>
            <View style={s.parcelasHeader}>
              {[0, 1, 2, 3].map(c => (
                <View key={c} style={[s.cGrupo, c > 0 ? s.cGrupoSep : {}]}>
                  <View style={s.cDatP}><Text style={s.thP}>Vencimento</Text></View>
                  <View style={s.cVlrP}><Text style={s.thPRight}>Valor</Text></View>
                </View>
              ))}
            </View>
            {linhasParc.map((linha, li) => (
              <View key={li} wrap={false} style={[s.parcRow, li % 2 === 1 ? s.parcRowAlt : {}]}>
                {linha.map((p, ci) => (
                  <View key={ci} style={[s.cGrupo, ci > 0 ? s.cGrupoSep : {}]}>
                    {p ? (
                      <View style={{ flexDirection: 'row', flex: 1 }}>
                        <View style={s.cDatP}><Text style={s.tdP}>{p.datven || '—'}</Text></View>
                        <View style={s.cVlrP}><Text style={s.tdPRight}>{fmtR(p.vlrpar)}</Text></View>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
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

export function BotaoBaixarPDFVendas({ vendas, totais, titulo, empresa, filtrosDesc, logoBase64 }: Props) {
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
            logoBase64={logoBase64}
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
