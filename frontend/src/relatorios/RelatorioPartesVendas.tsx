import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import { Button, Radio, Space } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

type Orientacao = 'retrato' | 'paisagem';

export interface VendaPartesPDF {
  id: number;
  lotexx?: string;
  deslot?: string;
  descricaoRaca?: string;
  valorPagar?: number;
  // Vendedor
  nomeVendedor?: string;
  cpfVendedor?: string;
  endereVendedor?: string;
  bairroVendedor?: string;
  cepVendedor?: string;
  cidadeVendedor?: string;
  estadoVendedor?: string;
  celularVendedor?: string;
  telresVendedor?: string;
  // Comprador
  nomeComprador?: string;
  cpfComprador?: string;
  endereComprador?: string;
  bairroComprador?: string;
  cepComprador?: string;
  cidadeComprador?: string;
  estadoComprador?: string;
  celularComprador?: string;
  // Propriedade (comprador)
  nomePropriedade?: string;
  localidade?: string;
  cidadePropriedade?: string;
  estadoPropriedade?: string;
}

interface Props {
  vendas: VendaPartesPDF[];
  titulo?: string;
  empresa?: string;
  filtrosDesc?: string;
}

const AZUL       = '#001529';
const AZUL_CLARO = '#1677ff';
const CINZA      = '#d9d9d9';
const VERDE_BG   = '#f6ffed';
const VERDE_BD   = '#b7eb8f';
const AZUL_BG    = '#e6f4ff';
const AZUL_BD    = '#91caff';

const fmtR = (v?: number | null) =>
  v != null && v !== 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const linhaEndereco = (end?: string, bairro?: string) =>
  [end, bairro].filter(Boolean).join(', ') || null;

const linhaCidadeEstado = (cidade?: string, estado?: string, cep?: string) => {
  const loc = [cidade, estado].filter(Boolean).join(' — ');
  return [loc, cep ? `CEP ${cep}` : ''].filter(Boolean).join('  ') || null;
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#222',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    backgroundColor: '#f5f5f5',
  },

  // Cabeçalho
  header: {
    backgroundColor: AZUL,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 8,
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

  // Card por venda
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderColor: CINZA,
    borderWidth: 1,
    marginBottom: 7,
    overflow: 'hidden',
  },

  // Cabeçalho do card (info do lote)
  cardHeader: {
    backgroundColor: AZUL,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  loteNum: {
    color: '#ffc53d',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginRight: 10,
    width: 50,
  },
  descricao: {
    color: '#ffffff',
    fontSize: 9,
    flex: 1,
    fontFamily: 'Helvetica-Bold',
  },
  racaTag: {
    color: '#a0b4c8',
    fontSize: 7,
    marginLeft: 8,
  },
  valorTag: {
    color: '#95de64',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginLeft: 12,
  },

  // Duas colunas (vendedor | comprador)
  duasColunas: {
    flexDirection: 'row',
  },
  colEsq: {
    flex: 1,
    backgroundColor: AZUL_BG,
    borderRightColor: AZUL_BD,
    borderRightWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  colDir: {
    flex: 1,
    backgroundColor: VERDE_BG,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  // Labels de seção
  parteLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: AZUL_CLARO,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    borderBottomColor: AZUL_BD,
    borderBottomWidth: 0.5,
    paddingBottom: 3,
  },
  parteLabelGreen: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#389e0d',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    borderBottomColor: VERDE_BD,
    borderBottomWidth: 0.5,
    paddingBottom: 3,
  },

  // Nome
  parteNome: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
    marginBottom: 3,
  },

  // CPF destacado
  parteCpf: {
    fontSize: 8,
    color: '#444',
    marginBottom: 4,
  },
  parteCpfValor: {
    fontFamily: 'Helvetica-Bold',
    color: AZUL,
  },

  // Endereço
  parteEnde: {
    fontSize: 7.5,
    color: '#555',
    marginBottom: 1,
  },
  parteCidade: {
    fontSize: 7.5,
    color: '#555',
    marginBottom: 1,
  },
  parteCep: {
    fontSize: 7,
    color: '#888',
    marginBottom: 1,
  },
  parteTel: {
    fontSize: 7.5,
    color: '#666',
    marginTop: 3,
  },
  parteVazio: {
    fontSize: 7.5,
    color: '#bbb',
    fontStyle: 'italic',
  },

  // Propriedade
  propLabel: {
    fontSize: 6,
    color: '#52c41a',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginTop: 5,
    marginBottom: 2,
  },
  propText: {
    fontSize: 7.5,
    color: '#555',
    marginBottom: 1,
  },

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

function ColunaVendedor({ v }: { v: VendaPartesPDF }) {
  const ende = linhaEndereco(v.endereVendedor, v.bairroVendedor);
  const cid  = linhaCidadeEstado(v.cidadeVendedor, v.estadoVendedor, v.cepVendedor);
  const tel  = v.celularVendedor || v.telresVendedor;

  return (
    <View style={s.colEsq}>
      <Text style={s.parteLabel}>Vendedor</Text>
      <Text style={s.parteNome}>{v.nomeVendedor || '—'}</Text>
      <Text style={s.parteCpf}>
        CPF: <Text style={s.parteCpfValor}>{v.cpfVendedor || 'não informado'}</Text>
      </Text>
      {ende ? <Text style={s.parteEnde}>{ende}</Text> : null}
      {cid  ? <Text style={s.parteCidade}>{cid}</Text> : null}
      {!ende && !cid ? <Text style={s.parteVazio}>Endereço não cadastrado</Text> : null}
      {tel  ? <Text style={s.parteTel}>Tel: {tel}</Text> : null}
    </View>
  );
}

function ColunaComprador({ v }: { v: VendaPartesPDF }) {
  const ende = linhaEndereco(v.endereComprador, v.bairroComprador);
  const cid  = linhaCidadeEstado(v.cidadeComprador, v.estadoComprador, v.cepComprador);
  const tel  = v.celularComprador;
  const temProp = v.nomePropriedade || v.localidade || v.cidadePropriedade;

  return (
    <View style={s.colDir}>
      <Text style={s.parteLabelGreen}>Comprador</Text>
      <Text style={s.parteNome}>{v.nomeComprador || '—'}</Text>
      <Text style={s.parteCpf}>
        CPF: <Text style={s.parteCpfValor}>{v.cpfComprador || 'não informado'}</Text>
      </Text>
      {ende ? <Text style={s.parteEnde}>{ende}</Text> : null}
      {cid  ? <Text style={s.parteCidade}>{cid}</Text> : null}
      {!ende && !cid ? <Text style={s.parteVazio}>Endereço não cadastrado</Text> : null}
      {tel  ? <Text style={s.parteTel}>Tel: {tel}</Text> : null}
      {temProp ? (
        <>
          <Text style={s.propLabel}>Propriedade</Text>
          {v.nomePropriedade ? <Text style={s.propText}>{v.nomePropriedade}</Text> : null}
          {v.localidade
            ? <Text style={s.propText}>{v.localidade}{v.cidadePropriedade ? ` — ${v.cidadePropriedade}` : ''}{v.estadoPropriedade ? `/${v.estadoPropriedade}` : ''}</Text>
            : null}
        </>
      ) : null}
    </View>
  );
}

function PartesVendasPDF({
  vendas, titulo, empresa, filtrosDesc, orientacao = 'paisagem',
}: Props & { orientacao?: Orientacao }) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const pageSize: any = orientacao === 'paisagem' ? [841.89, 595.28] : 'A4';
  const subtitulo = titulo || 'Partes das Vendas';

  return (
    <Document title={`Partes das Vendas — ${subtitulo}`} author={nomeEmpresa}>
      <Page size={pageSize} style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            <Image src={logotipoLocal} style={s.headerLogo} />
            <View style={s.headerTitleBox}>
              <Text style={s.headerTitle}>Vendedores e Compradores</Text>
              <Text style={s.headerSub}>{subtitulo}</Text>
              {filtrosDesc ? <Text style={s.headerFiltro}>Filtros: {filtrosDesc}</Text> : null}
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>Gerado em: {agora}</Text>
            <Text style={s.headerCount}>
              {vendas.length} lote{vendas.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Cards */}
        {vendas.map(v => (
          <View key={v.id} style={s.card} wrap={false}>
            {/* Topo do card: dados do lote */}
            <View style={s.cardHeader}>
              <Text style={s.loteNum}>{v.lotexx || '?'}</Text>
              <Text style={s.descricao}>{v.deslot || '—'}</Text>
              {v.descricaoRaca ? <Text style={s.racaTag}>{v.descricaoRaca}</Text> : null}
              <Text style={s.valorTag}>{fmtR(v.valorPagar)}</Text>
            </View>
            {/* Colunas vendedor / comprador */}
            <View style={s.duasColunas}>
              <ColunaVendedor v={v} />
              <ColunaComprador v={v} />
            </View>
          </View>
        ))}

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

export function BotaoBaixarPDFPartes({ vendas, titulo, empresa, filtrosDesc }: Props) {
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const nomeArquivo = `partes-vendas-${new Date().toISOString().slice(0, 10)}.pdf`;
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
          <PartesVendasPDF
            vendas={vendas}
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
            {loading ? 'Gerando PDF...' : 'Vendedores / Compradores'}
          </Button>
        )}
      </PDFDownloadLink>
    </Space>
  );
}

export default PartesVendasPDF;
