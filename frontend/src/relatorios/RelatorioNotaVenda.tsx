import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { FaturaData } from './RelatorioFaturaCompra';
import { valorExtenso } from './RelatorioPromissoria';

interface Props {
  dados: FaturaData;
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
  v != null && v !== 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '—';

const DISCLAIMER =
  '- A presente Nota de Leilão é parte integrante do contrato de compra e venda c/reserva de domínio.\n\n' +
  '- As vendas a prazo serão feitas com reserva de domínio, ficando o comprador na posse do(s) animal(s) aqui descrito(s) não podendo aliená-lo até que liquidada a última parcela, importando o presente contrato em confissão de dívida por parte do comprador, no total da transação feita a prazo.';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, color: ESCURO, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingBottom: 8, borderBottomColor: PRETO, borderBottomWidth: 1 },
  headerEsq: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  empresa: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRETO },
  headerDir: { alignItems: 'flex-end' },
  titulo: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: PRETO, letterSpacing: 1 },
  subTitulo: { fontSize: 8, color: MEDIO, marginTop: 2 },

  secBox: { backgroundColor: CLARO, borderRadius: 3, borderColor: CINZA, borderWidth: 0.5, padding: 6, marginBottom: 6 },
  secLabel: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: ESCURO, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3, paddingBottom: 2, borderBottomColor: CINZA, borderBottomWidth: 0.5 },
  duasColunas: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  colHalf: { flex: 1 },
  nome: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: PRETO, marginBottom: 1 },
  linha: { fontSize: 7, color: MEDIO, marginBottom: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '33%', marginBottom: 4 },
  gridLabel: { fontSize: 5.5, color: MEDIO, marginBottom: 1 },
  gridValor: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO },

  tabela: { borderRadius: 3, borderColor: CINZA, borderWidth: 0.5, marginBottom: 6, overflow: 'hidden' },
  tabelaHeader: { backgroundColor: ESCURO, flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 5 },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },
  tr: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 5, borderBottomColor: CLARO, borderBottomWidth: 0.5 },
  trAlt: { backgroundColor: '#fafafa' },
  cOrd: { width: 60 },
  cDat: { flex: 1 },
  cVlr: { width: 90, textAlign: 'right' as const },
  td: { fontSize: 7, color: ESCURO },
  tdRight: { fontSize: 7, color: ESCURO, textAlign: 'right' as const },
  semParcelas: { padding: 8, textAlign: 'center' as const, fontSize: 7.5, color: CINZA, fontStyle: 'italic' },

  disclaimer: { fontSize: 6, color: MEDIO, marginTop: 8, marginBottom: 14, lineHeight: 1.4 },

  assinatura: { alignItems: 'center', marginTop: 20 },
  assinaturaLinha: { borderTopColor: ESCURO, borderTopWidth: 0.5, width: 260, marginBottom: 3 },
  assinaturaNome: { fontSize: 7.5, color: ESCURO },
  assinaturaRole: { fontSize: 6.5, color: MEDIO },

  footer: { position: 'absolute', bottom: 10, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between', borderTopColor: CINZA, borderTopWidth: 0.5, paddingTop: 3 },
  footerText: { fontSize: 6, color: CINZA },
});

function NotaVendaPagina({ dados, comp, empresa, logoBase64 }: { dados: FaturaData; comp: FaturaData['compradores'][0]; empresa: string; logoBase64?: string | null }) {
  const lote  = dados.lote;
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const totalParcelas = comp.parcelas.reduce((a, p) => a + (p.vlrpar ?? 0), 0);
  const totalValor = comp.valorPagar ?? totalParcelas;

  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <View style={s.headerEsq}>
          <Image src={logoBase64 || logotipoLocal} style={s.logo} />
          <Text style={s.empresa}>{empresa}</Text>
        </View>
        <View style={s.headerDir}>
          <Text style={s.titulo}>NOTA DE VENDA</Text>
          <Text style={s.subTitulo}>Nota de Leilão — {dados.leilao || '—'}</Text>
          <Text style={s.subTitulo}>Nº Nota: {dados.codnot || dados.id}   ·   Data: {dados.datlan}</Text>
        </View>
      </View>

      <View style={s.duasColunas}>
        <View style={[s.secBox, s.colHalf]}>
          <Text style={s.secLabel}>Vendedor</Text>
          <Text style={s.nome}>{lote?.nomeVendedor || '—'}</Text>
          <Text style={s.linha}>
            {[lote?.cidadeVendedor, lote?.estadoVendedor].filter(Boolean).join(' — ') || '—'}
          </Text>
        </View>
        <View style={[s.secBox, s.colHalf]}>
          <Text style={s.secLabel}>Comprador</Text>
          <Text style={s.nome}>{comp.nomexx || '—'}</Text>
          <Text style={s.linha}>CPF/CNPJ: {comp.cpfxxx || 'não informado'}</Text>
          <Text style={s.linha}>
            {[comp.nomeCidade, comp.nomeEstado].filter(Boolean).join(' — ') || '—'}
          </Text>
        </View>
      </View>

      <View style={s.secBox}>
        <Text style={s.secLabel}>Especificações do Lote</Text>
        <View style={s.grid}>
          <View style={s.gridItem}><Text style={s.gridLabel}>Lote</Text><Text style={s.gridValor}>{lote?.lotexx || '—'}</Text></View>
          <View style={[s.gridItem, { width: '67%' }]}><Text style={s.gridLabel}>Descrição</Text><Text style={s.gridValor}>{lote?.deslot || '—'}</Text></View>
          <View style={s.gridItem}><Text style={s.gridLabel}>Raça</Text><Text style={s.gridValor}>{lote?.descricaoRaca || '—'}</Text></View>
          <View style={s.gridItem}><Text style={s.gridLabel}>SBB / RP</Text><Text style={s.gridValor}>{lote?.sbbxxx || '—'} / {lote?.rpxxx || '—'}</Text></View>
          <View style={s.gridItem}><Text style={s.gridLabel}>Pelagem</Text><Text style={s.gridValor}>{lote?.pelagem || '—'}</Text></View>
          <View style={s.gridItem}><Text style={s.gridLabel}>Dt. Nasc.</Text><Text style={s.gridValor}>{lote?.datnas || '—'}</Text></View>
          <View style={s.gridItem}><Text style={s.gridLabel}>Sexo</Text><Text style={s.gridValor}>{lote?.catego ? (CATEGO[lote.catego] || lote.catego) : '—'}</Text></View>
        </View>
        {lote?.obslot ? (
          <View style={{ marginTop: 4 }}>
            <Text style={s.gridLabel}>Observações</Text>
            <Text style={s.linha}>{lote.obslot}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.secBox}>
        <Text style={s.secLabel}>Acerto Financeiro</Text>
        <View style={s.grid}>
          <View style={s.gridItem}><Text style={s.gridLabel}>F. Pagamento</Text><Text style={s.gridValor}>{comp.formaPagamento || comp.desfin || '—'}</Text></View>
          <View style={s.gridItem}><Text style={s.gridLabel}>Desconto</Text><Text style={s.gridValor}>{fmtR(comp.valorDesconto)}</Text></View>
          <View style={s.gridItem}><Text style={s.gridLabel}>Vlr. Total</Text><Text style={s.gridValor}>{fmtR(totalValor)}</Text></View>
        </View>
        <Text style={[s.linha, { marginTop: 2, fontStyle: 'italic' }]}>
          ({valorExtenso(totalValor)})
        </Text>
      </View>

      <View style={s.tabela}>
        <View style={s.tabelaHeader}>
          <View style={s.cOrd}><Text style={s.th}>Parcela</Text></View>
          <View style={s.cDat}><Text style={s.th}>Vencimento</Text></View>
          <View style={s.cVlr}><Text style={s.thRight}>Valor</Text></View>
        </View>
        {comp.parcelas.length === 0 ? (
          <Text style={s.semParcelas}>Demonstrativo de parcelamentos ainda não gerado</Text>
        ) : comp.parcelas.map((p, i) => (
          <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
            <View style={s.cOrd}><Text style={s.td}>{p.ordxxx || i + 1}</Text></View>
            <View style={s.cDat}><Text style={s.td}>{p.datven || '—'}</Text></View>
            <View style={s.cVlr}><Text style={s.tdRight}>{fmtR(p.vlrpar)}</Text></View>
          </View>
        ))}
      </View>

      <Text style={s.disclaimer}>{DISCLAIMER}</Text>

      <View style={s.assinatura}>
        <View style={s.assinaturaLinha} />
        <Text style={s.assinaturaNome}>{comp.nomexx || 'Comprador'}</Text>
        <Text style={s.assinaturaRole}>De acordo — Comprador</Text>
      </View>

      <View style={s.footer} fixed>
        <Text style={s.footerText}>{empresa}</Text>
        <Text style={s.footerText}>Emitido em {agora}</Text>
      </View>
    </Page>
  );
}

function NotaVendaPDF({ dados, empresa, logoBase64 }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  return (
    <Document title={`Nota de Venda — Nota ${dados.codnot || dados.id}`} author={nomeEmpresa}>
      {dados.compradores.map(comp => (
        <NotaVendaPagina key={comp.id} dados={dados} comp={comp} empresa={nomeEmpresa} logoBase64={logoBase64} />
      ))}
    </Document>
  );
}

export default NotaVendaPDF;
