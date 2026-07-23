import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import { Button, Radio, Space } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { labelRP, labelSBB } from '../utils/lote';

type Orientacao = 'retrato' | 'paisagem';

export interface VendaSeguroPDF {
  id: number;
  datlan?: string;
  lotexx?: string;
  deslot?: string;
  especies?: string;
  rpxxx?: string;
  sbbxxx?: string;
  codnot?: string;
  valorPagar?: number;
  qtdxxx?: number;
  nomeVendedor?: string;
  cpfVendedor?: string;
  nomeComprador?: string;
  cpfComprador?: string;
  cidadeComprador?: string;
  estadoComprador?: string;
  inscricao?: string;
  nomePropriedade?: string;
  localidade?: string;
  cidadePropriedade?: string;
  estadoPropriedade?: string;
}

export interface TotaisSeguro {
  totalQtd: number;
  totalValor: number;
  mediaGeral: number;
}

interface Props {
  vendas: VendaSeguroPDF[];
  totais: TotaisSeguro;
  titulo?: string;
  empresa?: string;
  filtrosDesc?: string;
  logoBase64?: string | null;
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
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

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

  // Resumo (rodapé de totais, no topo da página 1 — Quantidade / Média / Total)
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
  resumoValor: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' as const, color: ESCURO },

  // Cabeçalho da tabela
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: ESCURO,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  th: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' as const },

  // Linhas
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomColor: CINZA,
    borderBottomWidth: 0.5,
  },
  rowAlt: { backgroundColor: CLARO },

  // Colunas — Página 1 (Mapa de Seguradoras)
  cData:      { width: 46 },
  cLote:      { width: 38 },
  cDes:       { flex: 1 },
  cComp:      { width: 98 },
  cCpf:       { width: 68 },
  cVend:      { width: 98 },
  cBoleto:    { width: 42 },
  cRp:        { width: 32 },
  cTat:       { width: 32 },
  cValor:     { width: 68 },

  // Colunas — Página 2 (Mapa da Compradores)
  cCidade:    { width: 90 },
  cEstado:    { width: 42 },
  cLote2:     { width: 38 },
  cDes2:      { flex: 1 },
  cRp2:       { width: 34 },
  cLocal:     { width: 110 },
  cProp:      { width: 120 },
  cInsc:      { width: 80 },

  // Células
  tdNormal:      { fontSize: 7 },
  tdNormalRight: { fontSize: 7, textAlign: 'right' as const },
  tdBold:        { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  tdBoldRight:   { fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'right' as const },

  // Grupo por comprador (página 2)
  grupoHeader: {
    backgroundColor: '#e6e6e6',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 2,
  },
  grupoNome: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: ESCURO },
  grupoInfo: { fontSize: 7, color: MEDIO },

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

  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: ESCURO,
    marginBottom: 6,
  },

  assinaturas: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    paddingTop: 6,
  },
  assinaturaItem: { alignItems: 'center', width: 220 },
  assinaturaLinha: { borderTopColor: ESCURO, borderTopWidth: 0.5, width: '100%', marginBottom: 3 },
  assinaturaNome: { fontSize: 8, color: ESCURO, textAlign: 'center' as const },
  assinaturaRole: { fontSize: 6.5, color: MEDIO, textAlign: 'center' as const },
});

function Cabecalho({
  logoBase64, titulo, subtitulo, filtrosDesc, agora, contagem,
}: {
  logoBase64?: string | null; titulo: string; subtitulo?: string; filtrosDesc?: string; agora: string; contagem: number;
}) {
  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        <Image src={logoBase64 || logotipoLocal} style={s.headerLogo} />
        <View style={s.headerTitleBox}>
          <Text style={s.headerTitle}>{titulo}</Text>
          {subtitulo ? <Text style={s.headerSub}>{subtitulo}</Text> : null}
          {filtrosDesc ? <Text style={s.headerFiltro}>Filtros: {filtrosDesc}</Text> : null}
        </View>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerDate}>Gerado em: {agora}</Text>
        <Text style={s.headerCount}>
          {contagem} lote{contagem !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function Rodape({ nomeEmpresa }: { nomeEmpresa: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{nomeEmpresa} — Sistema de Gestão</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

function MapaSeguroPDF({
  vendas, totais, titulo, empresa, filtrosDesc, logoBase64, orientacao = 'paisagem',
}: Props & { orientacao?: Orientacao }) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const pageSize: any = orientacao === 'paisagem' ? [841.89, 595.28] : 'A4';
  const subtitulo = titulo || 'Todas as vendas';

  // Espécie predominante — decide se RP/Tat. mostram RP/SBB (equinos) ou
  // Tatuagem/Registro (demais espécies), igual à Consulta de Vendas.
  const especiesPredominante = vendas[0]?.especies;

  // Agrupamento por comprador na página 2 (Mapa da Compradores) — cada
  // comprador pode ter comprado mais de um lote, cada um com sua própria
  // propriedade de destino (Localidade/Propriedade/Inscrição).
  const grupos = Array.from(
    vendas.reduce<Map<string, { nome: string; cpf?: string; cidade?: string; estado?: string; lotes: VendaSeguroPDF[] }>>((map, v) => {
      const chave = v.nomeComprador || '—';
      const atual = map.get(chave) ?? {
        nome: v.nomeComprador || '—', cpf: v.cpfComprador,
        cidade: v.cidadeComprador, estado: v.estadoComprador, lotes: [],
      };
      atual.lotes.push(v);
      return map.set(chave, atual);
    }, new Map()).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <Document title={`Mapa de Seguro — ${subtitulo}`} author={nomeEmpresa}>

      {/* ── Página 1: Mapa de Seguradoras ── */}
      <Page size={pageSize} style={s.page}>
        <Cabecalho
          logoBase64={logoBase64} titulo="Mapa de Seguradoras" subtitulo={subtitulo}
          filtrosDesc={filtrosDesc} agora={agora} contagem={vendas.length}
        />

        <View style={s.resumo}>
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Quantidade</Text>
            <Text style={s.resumoValor}>{fmtN(totais.totalQtd)}</Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Média Geral</Text>
            <Text style={s.resumoValor}>{fmtR(totais.mediaGeral)}</Text>
          </View>
          <View style={s.resumoSep} />
          <View style={s.resumoItem}>
            <Text style={s.resumoLabel}>Total das Vendas</Text>
            <Text style={s.resumoValor}>{fmtR(totais.totalValor)}</Text>
          </View>
        </View>

        <View style={s.tableHeader} fixed>
          <View style={s.cData}><Text style={s.th}>Data</Text></View>
          <View style={s.cLote}><Text style={s.th}>Lote</Text></View>
          <View style={s.cDes}><Text style={s.th}>Descrição</Text></View>
          <View style={s.cComp}><Text style={s.th}>Comprador</Text></View>
          <View style={s.cCpf}><Text style={s.th}>CPF/CNPJ</Text></View>
          <View style={s.cVend}><Text style={s.th}>Vendedor</Text></View>
          <View style={s.cCpf}><Text style={s.th}>CPF/CNPJ</Text></View>
          <View style={s.cBoleto}><Text style={s.th}>Boleto</Text></View>
          <View style={s.cRp}><Text style={s.th}>{labelRP(especiesPredominante)}</Text></View>
          <View style={s.cTat}><Text style={s.th}>{labelSBB(especiesPredominante)}</Text></View>
          <View style={s.cValor}><Text style={s.thRight}>Vlr.Total</Text></View>
        </View>

        {vendas.map((v, i) => (
          <View key={v.id} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]} wrap={false}>
            <View style={s.cData}><Text style={s.tdNormal}>{fmtData(v.datlan)}</Text></View>
            <View style={s.cLote}><Text style={[s.tdBold, { color: ESCURO }]}>{v.lotexx || '—'}</Text></View>
            <View style={s.cDes}><Text style={s.tdNormal}>{v.deslot || '—'}</Text></View>
            <View style={s.cComp}><Text style={s.tdNormal}>{v.nomeComprador || '—'}</Text></View>
            <View style={s.cCpf}><Text style={s.tdNormal}>{v.cpfComprador || '—'}</Text></View>
            <View style={s.cVend}><Text style={s.tdNormal}>{v.nomeVendedor || '—'}</Text></View>
            <View style={s.cCpf}><Text style={s.tdNormal}>{v.cpfVendedor || '—'}</Text></View>
            <View style={s.cBoleto}><Text style={s.tdNormal}>{v.codnot || '—'}</Text></View>
            <View style={s.cRp}><Text style={s.tdNormal}>{v.rpxxx || '—'}</Text></View>
            <View style={s.cTat}><Text style={s.tdNormal}>{v.sbbxxx || '—'}</Text></View>
            <View style={s.cValor}><Text style={s.tdBoldRight}>{fmtR(v.valorPagar)}</Text></View>
          </View>
        ))}

        <View wrap={false} style={s.assinaturas}>
          <View style={s.assinaturaItem}>
            <View style={s.assinaturaLinha} />
            <Text style={s.assinaturaNome}>{nomeEmpresa}</Text>
            <Text style={s.assinaturaRole}>Leiloeira Responsável</Text>
          </View>
        </View>

        <Rodape nomeEmpresa={nomeEmpresa} />
      </Page>

      {/* ── Página 2: Mapa da Compradores ── */}
      <Page size={pageSize} style={s.page}>
        <Cabecalho
          logoBase64={logoBase64} titulo="Mapa da Compradores" subtitulo={subtitulo}
          filtrosDesc={filtrosDesc} agora={agora} contagem={vendas.length}
        />

        <View style={s.tableHeader} fixed>
          <View style={s.cLote2}><Text style={s.th}>Lote</Text></View>
          <View style={s.cDes2}><Text style={s.th}>Descrição</Text></View>
          <View style={s.cRp2}><Text style={s.th}>{labelRP(especiesPredominante)}</Text></View>
          <View style={s.cLocal}><Text style={s.th}>Localidade</Text></View>
          <View style={s.cProp}><Text style={s.th}>Propriedade</Text></View>
          <View style={s.cInsc}><Text style={s.th}>Inscrição</Text></View>
        </View>

        {grupos.map((g, gi) => (
          <View key={gi}>
            <View style={s.grupoHeader} wrap={false}>
              <Text style={s.grupoNome}>{g.nome}</Text>
              <Text style={s.grupoInfo}>
                CPF/CNPJ: {g.cpf || 'não informado'}
                {(g.cidade || g.estado) ? `   •   ${[g.cidade, g.estado].filter(Boolean).join(' / ')}` : ''}
              </Text>
            </View>
            {g.lotes.map((v, i) => (
              <View key={v.id} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]} wrap={false}>
                <View style={s.cLote2}><Text style={[s.tdBold, { color: ESCURO }]}>{v.lotexx || '—'}</Text></View>
                <View style={s.cDes2}><Text style={s.tdNormal}>{v.deslot || '—'}</Text></View>
                <View style={s.cRp2}><Text style={s.tdNormal}>{v.rpxxx || '—'}</Text></View>
                <View style={s.cLocal}><Text style={s.tdNormal}>{v.localidade || '—'}</Text></View>
                <View style={s.cProp}><Text style={s.tdNormal}>{v.nomePropriedade || '—'}</Text></View>
                <View style={s.cInsc}><Text style={s.tdNormal}>{v.inscricao || '—'}</Text></View>
              </View>
            ))}
          </View>
        ))}

        <Rodape nomeEmpresa={nomeEmpresa} />
      </Page>
    </Document>
  );
}

export function BotaoBaixarPDFMapaSeguro({ vendas, totais, titulo, empresa, filtrosDesc, logoBase64 }: Props) {
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const nomeArquivo = `mapa-seguro-${new Date().toISOString().slice(0, 10)}.pdf`;
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
          <MapaSeguroPDF
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
            {loading ? 'Gerando PDF...' : 'Mapa de Seguro'}
          </Button>
        )}
      </PDFDownloadLink>
    </Space>
  );
}

export default MapaSeguroPDF;
