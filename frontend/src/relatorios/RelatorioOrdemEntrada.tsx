import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';
import { Button, Checkbox, Popover, Radio, Space } from 'antd';
import { PrinterOutlined, SettingOutlined } from '@ant-design/icons';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { fmtDataUTC } from '../utils/data';
import { labelRP } from '../utils/lote';

type Orientacao = 'retrato' | 'paisagem';

export interface LoteOrdemPDF {
  id: number;
  lotexx: string;
  deslot?: string;
  nomeVendedor?: string;
  nomeRaca?: string;
  catego?: string;
  rpxxx?: string;
  pesoxx?: number;
  obslot?: string;
  especies?: string;
  ordem: string;
  dataLeilao?: string;
  enderecoLeilao?: string;
  horaInicioLeilao?: string;
  leiloeiro?: string;
}

/** Colunas opcionais — mesmas opções da impressão da Ordem de Entrada do Delphi
 * (NÃO apresentar Número/Vendedor/Sexo/RP-TAT, Apresentar Peso). */
export interface OpcoesOrdemEntrada {
  ordem: boolean;
  vendedor: boolean;
  sexo: boolean;
  raca: boolean;
  rpTat: boolean;
  peso: boolean;
  obs: boolean;
}

/** Padrão do Delphi: tudo visível, menos o peso. Observação (não existia no Delphi) começa desligada. */
export const OPCOES_ORDEM_PADRAO: OpcoesOrdemEntrada = { ordem: true, vendedor: true, sexo: true, raca: true, rpTat: true, peso: false, obs: false };

const ROTULOS_OPCOES: { key: keyof OpcoesOrdemEntrada; label: string }[] = [
  { key: 'ordem', label: 'Número da ordem' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'raca', label: 'Raça' },
  { key: 'sexo', label: 'Sexo' },
  { key: 'rpTat', label: 'Tatuagem (RP nos equinos)' },
  { key: 'peso', label: 'Peso' },
  { key: 'obs', label: 'Observações do lote' },
];

interface Props {
  lotes: LoteOrdemPDF[];
  titulo?: string;
  empresa?: string;
  logoBase64?: string | null;
  /** Colunas a mostrar; sem isso, o padrão do Delphi. */
  opcoes?: OpcoesOrdemEntrada;
}

const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';

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
    borderBottomColor: ESCURO,
    borderBottomWidth: 2,
    paddingBottom: 6,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerEsquerda: { flexDirection: 'column', justifyContent: 'center' },
  headerLogo: { width: 165, height: 51, objectFit: 'contain', marginBottom: 2 },
  headerSub: { color: MEDIO, fontSize: 8, marginTop: 2 },
  headerInfoLeilao: { color: MEDIO, fontSize: 6.5, marginTop: 2 },
  headerDireita: { alignItems: 'flex-end' },
  headerData: { color: MEDIO, fontSize: 7 },
  headerTotal: { color: ESCURO, fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 2 },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
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
  cRpTat:  { width: 60 },
  cPeso:   { width: 45 },
  cObs:    { width: 170 },

  tdOrdem: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: ESCURO },
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

function dataBr(v?: string): string {
  return fmtDataUTC(v, '');
}

const fmtPeso = (v?: number) => v ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';

function OrdemEntradaPDF({ lotes, titulo, empresa, logoBase64, orientacao = 'paisagem', opcoes = OPCOES_ORDEM_PADRAO }: Props & { orientacao?: Orientacao }) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const subtitulo = titulo ? `Ordem de Entrada — ${titulo}` : 'Ordem de Entrada';
  const pageSize: any = orientacao === 'paisagem' ? [841.89, 595.28] : 'A4';

  const primeiro = lotes[0];
  // Tatuagem e RP ficam no mesmo campo (RPXXX): o rótulo segue a espécie — RP nos equinos
  const labelTatuagem = labelRP(lotes.find(l => l.especies)?.especies);
  const infoLeilao = primeiro
    ? [
        dataBr(primeiro.dataLeilao) && `Data: ${dataBr(primeiro.dataLeilao)}`,
        primeiro.horaInicioLeilao && `Início: ${primeiro.horaInicioLeilao}`,
        primeiro.enderecoLeilao && `Local: ${primeiro.enderecoLeilao}`,
        primeiro.leiloeiro && `Leiloeiro: ${primeiro.leiloeiro}`,
      ].filter(Boolean).join('   ·   ')
    : '';

  return (
    <Document title={subtitulo} author={nomeEmpresa}>
      <Page size={pageSize} style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header} fixed>
          <View style={s.headerEsquerda}>
            <Image src={logoBase64 || logotipoLocal} style={s.headerLogo} />
            <Text style={s.headerSub}>{subtitulo}</Text>
            {infoLeilao ? <Text style={s.headerInfoLeilao}>{infoLeilao}</Text> : null}
          </View>
          <View style={s.headerDireita}>
            <Text style={s.headerData}>Gerado em: {agora}</Text>
            <Text style={s.headerTotal}>{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Cabeçalho da tabela */}
        <View style={s.tableHeader} fixed>
          {opcoes.ordem && <View style={s.cOrdem}><Text style={s.th}>Ordem</Text></View>}
          <View style={s.cLote}><Text style={s.th}>Lote</Text></View>
          {opcoes.rpTat && <View style={s.cRpTat}><Text style={s.th}>{labelTatuagem}</Text></View>}
          <View style={s.cDes}><Text style={s.th}>Descrição</Text></View>
          {opcoes.vendedor && <View style={s.cVend}><Text style={s.th}>Vendedor</Text></View>}
          {opcoes.raca && <View style={s.cRaca}><Text style={s.th}>Raça</Text></View>}
          {opcoes.sexo && <View style={s.cSexo}><Text style={[s.th, { textAlign: 'center' }]}>Sexo</Text></View>}
          {opcoes.peso && <View style={s.cPeso}><Text style={[s.th, { textAlign: 'right' }]}>Peso</Text></View>}
          {opcoes.obs && <View style={s.cObs}><Text style={[s.th, { paddingLeft: 6 }]}>Observações</Text></View>}
        </View>

        {/* Linhas */}
        {lotes.map((l, i) => (
          <View key={l.id} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]} wrap={false}>
            {opcoes.ordem && <View style={s.cOrdem}><Text style={s.tdOrdem}>{l.ordem || '—'}</Text></View>}
            <View style={s.cLote}><Text style={s.tdNormal}>{l.lotexx}</Text></View>
            {opcoes.rpTat && <View style={s.cRpTat}><Text style={s.tdNormal}>{l.rpxxx || '—'}</Text></View>}
            <View style={s.cDes}><Text style={s.tdNormal}>{l.deslot || '—'}</Text></View>
            {opcoes.vendedor && <View style={s.cVend}><Text style={s.tdNormal}>{l.nomeVendedor || '—'}</Text></View>}
            {opcoes.raca && <View style={s.cRaca}><Text style={s.tdRaca}>{l.nomeRaca || '—'}</Text></View>}
            {opcoes.sexo && <View style={s.cSexo}><Text style={s.tdSexo}>{SEXO[l.catego || ''] || l.catego || '—'}</Text></View>}
            {opcoes.peso && <View style={s.cPeso}><Text style={[s.tdNormal, { textAlign: 'right' }]}>{fmtPeso(l.pesoxx)}</Text></View>}
            {opcoes.obs && <View style={s.cObs}><Text style={[s.tdRaca, { paddingLeft: 6 }]}>{l.obslot || '—'}</Text></View>}
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

const CHAVE_OPCOES = (banco?: string) => `ordemEntradaOpcoes_${banco || 'padrao'}`;

function lerOpcoes(banco?: string): OpcoesOrdemEntrada {
  try {
    const raw = localStorage.getItem(CHAVE_OPCOES(banco));
    return raw ? { ...OPCOES_ORDEM_PADRAO, ...JSON.parse(raw) } : OPCOES_ORDEM_PADRAO;
  } catch { return OPCOES_ORDEM_PADRAO; }
}

/** banco: separa a preferência de colunas por cliente (fica salva no navegador). */
export function BotaoBaixarPDFOrdem({ lotes, titulo, empresa, logoBase64, banco }: Props & { banco?: string }) {
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const [opcoes, setOpcoes] = useState<OpcoesOrdemEntrada>(() => lerOpcoes(banco));
  const alternar = (key: keyof OpcoesOrdemEntrada, valor: boolean) => {
    const novas = { ...opcoes, [key]: valor };
    setOpcoes(novas);
    try { localStorage.setItem(CHAVE_OPCOES(banco), JSON.stringify(novas)); } catch { /* sem storage: vale só nesta tela */ }
  };
  const nomeArquivo = `ordem-entrada-${new Date().toISOString().slice(0, 10)}.pdf`;
  // Gera o PDF só no clique, com a lista daquele momento. Antes o PDFDownloadLink
  // remontava o documento a cada mudança na tela (arrastar lote, digitar ordem,
  // marcar coluna); montagens simultâneas do @react-pdf misturavam o resultado e
  // o PDF saía com lotes repetidos (ex.: 35 lotes viraram ~95 linhas).
  const [gerando, setGerando] = useState(false);
  const imprimir = async () => {
    setGerando(true);
    try {
      const blob = await pdf(
        <OrdemEntradaPDF lotes={lotes} titulo={titulo} empresa={empresa} logoBase64={logoBase64} orientacao={orientacao} opcoes={opcoes} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setGerando(false);
    }
  };
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
      <Popover
        trigger="click"
        title="Colunas da Ordem de Entrada"
        content={
          <Space direction="vertical" size={4}>
            {ROTULOS_OPCOES.map(o => (
              <Checkbox key={o.key} checked={opcoes[o.key]} onChange={e => alternar(o.key, e.target.checked)}>
                {o.label}
              </Checkbox>
            ))}
          </Space>
        }
      >
        <Button size="small" icon={<SettingOutlined />}>Colunas</Button>
      </Popover>
      <Button icon={<PrinterOutlined />} loading={gerando} disabled={lotes.length === 0 || gerando} onClick={imprimir}>
        {gerando ? 'Gerando PDF...' : 'Imprimir'}
      </Button>
    </Space>
  );
}

export default OrdemEntradaPDF;
