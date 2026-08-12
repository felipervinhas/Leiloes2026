import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Table, Button, Select, Row, Col, Typography, Tag, Space,
  Card, Divider, message, Spin, Radio, Modal, Dropdown, Checkbox,
} from 'antd';
import ResizableTitle from '../components/ResizableTitle';
import { useColumnWidths } from '../hooks/useColumnWidths';
import { useBuscaLeiloes } from '../hooks/useBuscaLeiloes';
import {
  SearchOutlined, FileExcelOutlined, FileSearchOutlined, ClearOutlined, PrinterOutlined,
  CheckCircleFilled, CloseOutlined, FileTextOutlined, EyeOutlined, SettingOutlined,
} from '@ant-design/icons';
import { PDFDownloadLink, BlobProvider } from '@react-pdf/renderer';
import api from '../services/api';
import dayjs from 'dayjs';
import ConsultaVendasPDF, { COLUNAS_CONSULTA_VENDAS } from '../relatorios/RelatorioConsultaVendas';
import PartesVendasPDF from '../relatorios/RelatorioPartesVendas';
import MediasLeilaoPDF from '../relatorios/RelatorioMediasLeilao';
import RelatorioFaturaUnificada, { FaturaUnificadaGrupo } from '../relatorios/RelatorioFaturaUnificada';
import MapaSeguroPDF from '../relatorios/RelatorioMapaSeguro';
import { useConfig } from '../context/ConfigContext';
import { labelRP, labelSBB } from '../utils/lote';

type Orientacao = 'retrato' | 'paisagem';
type TipoRelatorio = 'vendas' | 'partes' | 'medias' | 'fatura' | 'seguro' | 'seguroCompradores';
type MediaCategoria = {
  key: string;
  categoria: string;
  qtd: number;
  valor: number;
  media: number;
};

const { Title, Text } = Typography;

const fmt = (v: number | null | undefined) =>
  v != null && v !== 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '—';

const DEFESA_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'S', label: 'Vendido' },
  { value: 'N', label: 'Não vendido' },
];

// V.ID (id) não é único por comprador quando o lote é rateado entre vários
// compradores — a consulta retorna uma linha por comprador com o mesmo id.
// A combinação id+idCli identifica cada linha de forma única.
const rowKeyOf = (d: any) => `${d.id}_${d.idCli}`;

// Comparadores usados tanto no `sorter` de cada coluna (ordenação visual da
// tabela) quanto para reordenar os dados antes de gerar o PDF/CSV — sem isso,
// a impressão sempre saía na ordem original da consulta, ignorando a coluna
// que o usuário escolheu para ordenar na tela.
const cmpTexto = (a?: string | null, b?: string | null) => (a || '').localeCompare(b || '');
const cmpNumero = (a?: number | null, b?: number | null) => (a || 0) - (b || 0);

function parseDataBr(str?: string): Date | null {
  if (!str) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
const cmpDataBr = (a?: string, b?: string) => {
  const da = parseDataBr(a);
  const db = parseDataBr(b);
  if (da && db) return da.getTime() - db.getTime();
  return cmpTexto(a, b);
};
const cmpDataIso = (a?: string, b?: string) => (a ? new Date(a).getTime() : 0) - (b ? new Date(b).getTime() : 0);

const COMPARADORES: Record<string, (a: any, b: any) => number> = {
  leilao:                 (a, b) => cmpTexto(a.leilao, b.leilao),
  datlei:                 (a, b) => cmpDataIso(a.datlei, b.datlei),
  lotexx:                 (a, b) => cmpTexto(a.lotexx, b.lotexx),
  deslot:                 (a, b) => cmpTexto(a.deslot, b.deslot),
  descricaoRaca:          (a, b) => cmpTexto(a.descricaoRaca, b.descricaoRaca),
  especies:               (a, b) => cmpTexto(a.especies, b.especies),
  rpxxx:                  (a, b) => cmpTexto(a.rpxxx, b.rpxxx),
  sbbxxx:                 (a, b) => cmpTexto(a.sbbxxx, b.sbbxxx),
  nomeVendedor:           (a, b) => cmpTexto(a.nomeVendedor, b.nomeVendedor),
  nomeComprador:          (a, b) => cmpTexto(a.nomeComprador, b.nomeComprador),
  qtdxxx:                 (a, b) => cmpNumero(a.qtdxxx, b.qtdxxx),
  valorUnidade:           (a, b) => cmpNumero(a.valorUnidade, b.valorUnidade),
  valorPagar:             (a, b) => cmpNumero(a.valorPagar, b.valorPagar),
  valorComissao:          (a, b) => cmpNumero(a.valorComissao, b.valorComissao),
  valorDesconto:          (a, b) => cmpNumero(a.valorDesconto, b.valorDesconto),
  valorLiquido:           (a, b) => cmpNumero(a.valorLiquido, b.valorLiquido),
  desfin:                 (a, b) => cmpTexto(a.desfin, b.desfin),
  parcelaInicial:         (a, b) => cmpNumero(a.parcelaInicial, b.parcelaInicial),
  primeiroVencimentoData: (a, b) => cmpDataBr(a.primeiroVencimentoData, b.primeiroVencimentoData),
  datlan:                 (a, b) => cmpDataIso(a.datlan, b.datlan),
  defesa:                 (a, b) => cmpTexto(a.defesa, b.defesa),
};

export default function ConsultaVendas() {
  const config = useConfig();
  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>('vendas');
  const [orientacaoImp, setOrientacaoImp] = useState<Orientacao>('paisagem');
  const { opcoes: leiloes, carregando: carregandoLeiloes, buscar: buscarLeiloes } = useBuscaLeiloes();
  const [lotes, setLotes]       = useState<{ value: number; label: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ value: number; label: string }[]>([]);
  const [compradores, setCompradores] = useState<{ value: number; label: string }[]>([]);
  const [loadingVend, setLoadingVend] = useState(false);
  const [loadingComp, setLoadingComp] = useState(false);
  const timerVend = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerComp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [racas, setRacas]       = useState<{ id: number; label: string }[]>([]);

  const [leilaoSel, setLeilaoSel]     = useState<number | undefined>();
  const [loteSel, setLoteSel]         = useState<number | undefined>();
  const [vendedorSel, setVendedorSel] = useState<number | undefined>();
  const [compradorSel, setCompradorSel] = useState<number | undefined>();
  const [defesaSel, setDefesaSel]     = useState<string>('');
  const [racasSel, setRacasSel]       = useState<number[]>([]);

  const [dados, setDados]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [consultou, setConsultou] = useState(false);
  // Incrementa a cada nova consulta — força o PDFDownloadLink a remontar (via key)
  // sempre que o resultado muda, senão o @react-pdf/renderer pode manter o PDF
  // gerado da consulta anterior (ex.: troca de filtro sem trocar orientação/colunas).
  const [consultaVersao, setConsultaVersao] = useState(0);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  // Ordenação atual da grid (coluna + sentido) — replicada em dadosOrdenados
  // pra impressão e CSV seguirem a mesma ordem escolhida na tela.
  const [sortField, setSortField] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | undefined>();
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(COLUNAS_CONSULTA_VENDAS.map(c => c.key));
  const [gerandoFaturaUnificada, setGerandoFaturaUnificada] = useState(false);
  const [faturasUnificadas, setFaturasUnificadas] = useState<FaturaUnificadaGrupo[] | null>(null);
  const [modalFaturaOpen, setModalFaturaOpen] = useState(false);

  const { rz: rzCV } = useColumnWidths('consulta_vendas', {
    lotexx: 70, deslot: 180, descricaoRaca: 120, especies: 90, rpxxx: 90, sbbxxx: 90,
    nomeVendedor: 160, nomeComprador: 160, qtdxxx: 70, valorUnidade: 110, valorPagar: 120,
    valorComissao: 110, valorDesconto: 110, valorLiquido: 120, desfin: 130,
    parcelaInicial: 110, primeiroVencimentoData: 110, datlan: 120, defesa: 100,
  });

  const buscarVendedores = useCallback((busca: string) => {
    clearTimeout(timerVend.current);
    if (busca.length < 2) { setVendedores([]); return; }
    timerVend.current = setTimeout(async () => {
      setLoadingVend(true);
      try {
        const r = await api.get('/clientes', { params: { nome: busca } });
        setVendedores(r.data.map((c: any) => ({ value: c.id, label: c.nomexx })));
      } finally { setLoadingVend(false); }
    }, 350);
  }, []);

  const buscarCompradores = useCallback((busca: string) => {
    clearTimeout(timerComp.current);
    if (busca.length < 2) { setCompradores([]); return; }
    timerComp.current = setTimeout(async () => {
      setLoadingComp(true);
      try {
        const r = await api.get('/clientes', { params: { nome: busca } });
        setCompradores(r.data.map((c: any) => ({ value: c.id, label: c.nomexx })));
      } finally { setLoadingComp(false); }
    }, 350);
  }, []);

  const onLeilao = async (idLeilao: number | undefined) => {
    setLeilaoSel(idLeilao);
    setLoteSel(undefined);
    setRacasSel([]);
    setRacas([]);
    setLotes([]);
    if (!idLeilao) return;
    const [rl, rr] = await Promise.all([
      api.get(`/consulta-vendas/lotes/${idLeilao}`),
      api.get(`/consulta-vendas/racas/${idLeilao}`),
    ]);
    setLotes(rl.data.map((l: any) => ({ value: l.id, label: `${l.lotexx} — ${l.deslot}` })));
    setRacas(rr.data.map((r: any) => ({ id: r.id, label: r.descricao + (r.especies ? ` (${r.especies})` : '') })));
  };

  const consultar = async () => {
    if (!leilaoSel && !vendedorSel && !compradorSel) {
      message.warning('Selecione ao menos um filtro: Leilão, Vendedor ou Comprador');
      return;
    }
    setLoading(true);
    setConsultou(true);
    setSelectedRowKeys([]);
    try {
      const params: any = {};
      if (leilaoSel)    params.idLeilao    = leilaoSel;
      if (loteSel)      params.idLote      = loteSel;
      if (vendedorSel)  params.idVendedor  = vendedorSel;
      if (compradorSel) params.idComprador = compradorSel;
      if (defesaSel)    params.defesa      = defesaSel;
      if (racasSel.length) params.idRacas  = racasSel.join(',');
      const r = await api.get('/consulta-vendas', { params });
      setDados(r.data);
      setConsultaVersao(v => v + 1);
    } catch { message.error('Erro ao consultar vendas'); }
    finally { setLoading(false); }
  };

  const limparSelecao = () => setSelectedRowKeys([]);

  const gerarFaturaUnificada = async () => {
    setGerandoFaturaUnificada(true);
    try {
      const idsMc = dados
        .filter(d => selectedRowKeys.includes(rowKeyOf(d)))
        .map(d => d.idMovimentoComprador)
        .filter((id): id is number => id != null);
      if (!idsMc.length) { message.warning('Nenhum lote válido selecionado'); return; }
      const r = await api.post('/vendas/fatura-unificada', { ids: idsMc });
      if (!r.data.length) { message.warning('Nenhum dado encontrado para os lotes selecionados'); return; }
      setFaturasUnificadas(r.data);
      setModalFaturaOpen(true);
    } catch { message.error('Erro ao gerar fatura unificada'); }
    finally { setGerandoFaturaUnificada(false); }
  };

  // Gera a partir de TODOS os resultados da consulta atual, sem precisar
  // marcar lote por lote — igual ao "Fatura Unificada" do sistema antigo,
  // que usava direto o resultado já filtrado (ex.: por Vendedor ou Comprador).
  // Exige Leilão + (Vendedor ou Comprador) — sem isso, geraria uma fatura
  // enorme sem sentido. Se só o Vendedor está selecionado, junta todas as
  // vendas dele (para compradores diferentes) numa fatura só; se só o
  // Comprador está selecionado, junta todas as compras dele (de vendedores
  // diferentes); se os dois estão selecionados, é o par de sempre.
  const gerarFaturaUnificadaTodos = async () => {
    if (!leilaoSel || (!vendedorSel && !compradorSel)) {
      message.warning('Selecione o Leilão e o Vendedor ou o Comprador antes de gerar a Fatura Unificada');
      return;
    }
    const modo = vendedorSel && !compradorSel ? 'vendedor'
               : compradorSel && !vendedorSel ? 'comprador'
               : 'par';
    setGerandoFaturaUnificada(true);
    try {
      const idsMc = dados
        .map(d => d.idMovimentoComprador)
        .filter((id): id is number => id != null);
      if (!idsMc.length) { message.warning('Nenhum lote encontrado nos filtros atuais'); return; }
      const r = await api.post('/vendas/fatura-unificada', { ids: idsMc, modo });
      if (!r.data.length) { message.warning('Nenhum dado encontrado para os lotes filtrados'); return; }
      setFaturasUnificadas(r.data);
      setModalFaturaOpen(true);
    } catch { message.error('Erro ao gerar fatura unificada'); }
    finally { setGerandoFaturaUnificada(false); }
  };

  const limpar = () => {
    setLeilaoSel(undefined); setLoteSel(undefined);
    setVendedorSel(undefined); setCompradorSel(undefined);
    setDefesaSel(''); setRacasSel([]);
    setLotes([]); setRacas([]);
    setVendedores([]); setCompradores([]);
    setDados([]); setConsultou(false);
    setConsultaVersao(v => v + 1);
  };

  const exportarCSV = () => {
    if (!dados.length) return;
    const cols = colunas.filter(c => c.dataIndex);
    const header = cols.map(c => c.title).join(';');
    const rows = dadosOrdenados.map(row =>
      cols.map(c => {
        const v = row[c.dataIndex!];
        if (v == null) return '';
        if (typeof v === 'number') return String(v).replace('.', ',');
        return String(v).replace(/;/g, ',');
      }).join(';')
    );
    const csv = '﻿' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `consulta_vendas_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Descrição dos filtros ativos para o PDF
  const nomeLeilaoSel    = leiloes.find(l => l.value === leilaoSel)?.label;
  const nomeVendedorSel  = vendedores.find(v => v.value === vendedorSel)?.label;
  const nomeCompradorSel = compradores.find(c => c.value === compradorSel)?.label;
  const filtrosDesc = [
    nomeLeilaoSel    && `Leilão: ${nomeLeilaoSel}`,
    nomeVendedorSel  && `Vendedor: ${nomeVendedorSel}`,
    nomeCompradorSel && `Comprador: ${nomeCompradorSel}`,
    defesaSel        && `Status: ${DEFESA_OPTS.find(d => d.value === defesaSel)?.label}`,
    racasSel.length > 0 && `Raças: ${racasSel.map(id => racas.find(r => r.id === id)?.label).filter(Boolean).join(', ')}`,
  ].filter(Boolean).join(' | ') || undefined;

  // Totalizadores
  function calcularTotais(lista: typeof dados) {
    const totalLotes      = lista.length;
    const totalValor      = lista.reduce((a, d) => a + (d.valorPagar     || 0), 0);
    const totalComissao   = lista.reduce((a, d) => a + (d.valorComissao  || 0), 0);
    const totalLiquido    = lista.reduce((a, d) => a + (d.valorLiquido   || 0), 0);
    const totalDesconto   = lista.reduce((a, d) => a + (d.valorDesconto  || 0), 0);
    const totalQtd        = lista.reduce((a, d) => a + (d.qtdxxx         || 0), 0);
    const mediaGeral      = totalQtd > 0 ? totalValor / totalQtd : 0;
    const mediasCategoria: MediaCategoria[] = Array.from(
      lista.reduce<Map<string, MediaCategoria>>((map, d) => {
        const key = String(d.idCategoria ?? d.descricaoRaca ?? 'sem-categoria');
        const categoria = [d.descricaoRaca, d.especies].filter(Boolean).join(' / ') || 'Sem categoria';
        const atual = map.get(key) ?? { key, categoria, qtd: 0, valor: 0, media: 0 };
        atual.qtd += Number(d.qtdxxx || 0);
        atual.valor += Number(d.valorPagar || 0);
        atual.media = atual.qtd > 0 ? atual.valor / atual.qtd : 0;
        return map.set(key, atual);
      }, new Map<string, MediaCategoria>()).values()
    ).sort((a, b) => a.categoria.localeCompare(b.categoria));
    return { totalLotes, totalValor, totalComissao, totalLiquido, totalDesconto, totalQtd, mediaGeral, mediasCategoria };
  }

  const { totalLotes, totalValor, totalComissao, totalLiquido, totalDesconto, totalQtd, mediaGeral, mediasCategoria } = calcularTotais(dados);

  // Reordena os dados igual ao que o usuário escolheu clicando no cabeçalho da
  // tabela (sortField/sortOrder, capturado no onChange do Table), pra impressão
  // e CSV saírem na mesma ordem que está sendo vista na tela.
  const dadosOrdenados = (() => {
    const cmp = sortField && COMPARADORES[sortField];
    if (!cmp) return dados;
    const ordenado = [...dados].sort(cmp);
    return sortOrder === 'descend' ? ordenado.reverse() : ordenado;
  })();

  // Impressão respeita a seleção da tabela: nada marcado -> imprime tudo; com seleção -> só os marcados.
  const dadosImpressao = selectedRowKeys.length > 0 ? dadosOrdenados.filter(d => selectedRowKeys.includes(rowKeyOf(d))) : dadosOrdenados;
  const totaisImpressao = calcularTotais(dadosImpressao);

  // Espécie predominante da consulta atual — decide se as colunas abaixo mostram
  // RP/SBB (equinos) ou Tatuagem/Registro (demais espécies). Uma tabela não pode
  // ter cabeçalho diferente por linha, então usamos a espécie do primeiro lote.
  const especiesPredominante = dados[0]?.especies;

  const colunas: any[] = [
    { title: 'Lote', dataIndex: 'lotexx', ...rzCV('lotexx'), fixed: 'left' as const,
      sorter: COMPARADORES.lotexx },
    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true, ...rzCV('leilao'),
      sorter: COMPARADORES.leilao },
    { title: 'Dt. Leilão', dataIndex: 'datlei', ...rzCV('datlei'),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
      sorter: COMPARADORES.datlei },
    { title: labelRP(especiesPredominante), dataIndex: 'rpxxx', ...rzCV('rpxxx'),
      sorter: COMPARADORES.rpxxx },
    { title: 'Comprador', dataIndex: 'nomeComprador', ellipsis: true, ...rzCV('nomeComprador'),
      sorter: COMPARADORES.nomeComprador },
    { title: 'Vendedor', dataIndex: 'nomeVendedor', ellipsis: true, ...rzCV('nomeVendedor'),
      sorter: COMPARADORES.nomeVendedor },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true, ...rzCV('deslot'),
      sorter: COMPARADORES.deslot },
    { title: 'Raça', dataIndex: 'descricaoRaca', ...rzCV('descricaoRaca'), ellipsis: true,
      sorter: COMPARADORES.descricaoRaca },
    { title: 'Espécie', dataIndex: 'especies', ...rzCV('especies'), ellipsis: true,
      sorter: COMPARADORES.especies },
    { title: 'Qtd', dataIndex: 'qtdxxx', ...rzCV('qtdxxx'), align: 'right' as const,
      render: (v: number) => v ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—',
      sorter: COMPARADORES.qtdxxx },
    { title: 'Vlr. a Pagar', dataIndex: 'valorPagar', ...rzCV('valorPagar'), align: 'right' as const,
      render: (v: number) => <Text strong>{fmt(v)}</Text>,
      sorter: COMPARADORES.valorPagar },
    { title: 'Comissão', dataIndex: 'valorComissao', ...rzCV('valorComissao'), align: 'right' as const,
      render: (v: number) => <Text type="warning">{fmt(v)}</Text>,
      sorter: COMPARADORES.valorComissao },
    { title: 'Vlr. Líquido', dataIndex: 'valorLiquido', ...rzCV('valorLiquido'), align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmt(v)}</Text>,
      sorter: COMPARADORES.valorLiquido },
    { title: labelSBB(especiesPredominante), dataIndex: 'sbbxxx', ...rzCV('sbbxxx'),
      sorter: COMPARADORES.sbbxxx },
    { title: 'Vlr. Unit.', dataIndex: 'valorUnidade', ...rzCV('valorUnidade'), align: 'right' as const,
      render: fmt,
      sorter: COMPARADORES.valorUnidade },
    { title: 'Desconto', dataIndex: 'valorDesconto', ...rzCV('valorDesconto'), align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="danger">- {fmt(v)}</Text> : '—',
      sorter: COMPARADORES.valorDesconto },
    { title: 'Condição', dataIndex: 'desfin', ...rzCV('desfin'), ellipsis: true,
      sorter: COMPARADORES.desfin },
    { title: '1ª Parcela', dataIndex: 'parcelaInicial', ...rzCV('parcelaInicial'), align: 'right' as const, render: fmt,
      sorter: COMPARADORES.parcelaInicial },
    { title: 'Vencimento', dataIndex: 'primeiroVencimentoData', ...rzCV('primeiroVencimentoData'),
      sorter: COMPARADORES.primeiroVencimentoData },
    { title: 'Dt. Lançamento', dataIndex: 'datlan', ...rzCV('datlan'),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
      sorter: COMPARADORES.datlan },
    { title: 'Status', dataIndex: 'defesa', ...rzCV('defesa'),
      render: (v: string) => v === 'S'
        ? <Tag color="green">Vendido</Tag>
        : <Tag color="default">Não vendido</Tag>,
      sorter: COMPARADORES.defesa },
  ];

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #faf5ff' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(124,58,237,0.35)', flexShrink: 0 }}>
          <FileSearchOutlined style={{ fontSize: 20, color: '#fff' }} />
        </div>
        <Title level={4} style={{ margin: 0, color: '#0f172a' }}>Consulta de Vendas</Title>
      </div>

      {/* ── Filtros ── */}
      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col span={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Leilão</div>
            <Select
              placeholder="Digite para buscar o leilão..."
              style={{ width: '100%' }}
              allowClear
              showSearch
              value={leilaoSel}
              options={leiloes}
              onChange={onLeilao}
              onSearch={buscarLeiloes}
              filterOption={false}
              loading={carregandoLeiloes}
              notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
            />
          </Col>
          <Col span={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Lote</div>
            <Select
              placeholder="Todos os lotes"
              style={{ width: '100%' }}
              allowClear
              showSearch
              value={loteSel}
              options={lotes}
              disabled={!leilaoSel}
              onChange={setLoteSel}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
            />
          </Col>
          <Col span={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Status Venda</div>
            <Select
              style={{ width: '100%' }}
              value={defesaSel}
              options={DEFESA_OPTS}
              onChange={setDefesaSel}
            />
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Vendedor</div>
            <Select
              placeholder="Digite para buscar vendedor..."
              style={{ width: '100%' }}
              allowClear
              showSearch
              filterOption={false}
              value={vendedorSel}
              options={vendedores}
              loading={loadingVend}
              onChange={v => { setVendedorSel(v); if (!v) setVendedores([]); }}
              onSearch={buscarVendedores}
              notFoundContent={loadingVend ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
            />
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Comprador</div>
            <Select
              placeholder="Digite para buscar comprador..."
              style={{ width: '100%' }}
              allowClear
              showSearch
              filterOption={false}
              value={compradorSel}
              options={compradores}
              loading={loadingComp}
              onChange={v => { setCompradorSel(v); if (!v) setCompradores([]); }}
              onSearch={buscarCompradores}
              notFoundContent={loadingComp ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
            />
          </Col>
          {racas.length > 0 && (
            <Col span={24}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                Raças / Categorias (selecione para filtrar)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {racas.map(r => (
                  <Tag.CheckableTag
                    key={r.id}
                    checked={racasSel.includes(r.id)}
                    onChange={checked =>
                      setRacasSel(prev =>
                        checked ? [...prev, r.id] : prev.filter(id => id !== r.id)
                      )
                    }
                  >
                    {r.label}
                  </Tag.CheckableTag>
                ))}
              </div>
            </Col>
          )}
        </Row>

        <Divider style={{ margin: '12px 0' }} />

        <Row justify="end" gutter={8}>
          <Col>
            <Button icon={<ClearOutlined />} onClick={limpar}>Limpar</Button>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={loading}
              onClick={consultar}
            >
              Consultar
            </Button>
          </Col>
        </Row>
      </div>

      {/* ── Totalizadores ── */}
      {consultou && dados.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          {[
            { title: 'Lotes',           value: totalLotes,    suffix: '',   color: undefined },
            { title: 'Valor Total',     value: totalValor,    suffix: 'R$', color: '#1677ff' },
            { title: 'Comissão Total',  value: totalComissao, suffix: 'R$', color: '#faad14' },
            { title: 'Total Descontos', value: totalDesconto, suffix: 'R$', color: '#ff4d4f' },
            { title: 'Valor Líquido',   value: totalLiquido,  suffix: 'R$', color: '#52c41a' },
            { title: 'Média/Cabeça',    value: mediaGeral,    suffix: 'R$', color: '#722ed1' },
          ].map(({ title, value, suffix, color }) => (
            <Col span={4} key={title}>
              <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
                <div style={{ fontSize: 11, color: '#888' }}>{title}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: color || undefined }}>
                  {suffix === 'R$'
                    ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : value.toLocaleString('pt-BR')}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* ── Tabela ── */}
      {consultou && mediasCategoria.length > 0 && (
        <Card
          size="small"
          title="Médias por Categoria"
          style={{ marginBottom: 16, borderRadius: 8 }}
          styles={{ body: { padding: 12 } }}
        >
          <Row gutter={[12, 12]}>
            {mediasCategoria.map(cat => (
              <Col xs={24} sm={12} md={8} lg={6} key={cat.key}>
                <div style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  background: 'linear-gradient(135deg, #fafcff 0%, #ffffff 100%)',
                  height: '100%',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#001529', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.categoria}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Qtd.</Text>
                    <Text strong style={{ fontSize: 12 }}>{cat.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Total</Text>
                    <Text strong style={{ fontSize: 12, color: '#1677ff' }}>
                      R$ {cat.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Média</Text>
                    <Text strong style={{ fontSize: 13, color: '#722ed1' }}>
                      R$ {cat.media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {consultou && (
        <>
          <Row justify="end" style={{ marginBottom: 8 }}>
            <Space wrap>
              <Select
                value={tipoRelatorio}
                onChange={setTipoRelatorio}
                style={{ width: 230 }}
                options={[
                  { value: 'vendas', label: 'Consulta de Vendas' },
                  { value: 'partes', label: 'Vendedores / Compradores' },
                  { value: 'medias', label: 'Médias' },
                  { value: 'fatura', label: 'Fatura Unificada' },
                  { value: 'seguro', label: 'Mapa de Seguradoras' },
                  { value: 'seguroCompradores', label: 'Mapa de Compradores' },
                ]}
              />
              {tipoRelatorio !== 'medias' && tipoRelatorio !== 'fatura' && (
                <Radio.Group
                  value={orientacaoImp}
                  onChange={e => setOrientacaoImp(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="retrato">Retrato</Radio.Button>
                  <Radio.Button value="paisagem">Paisagem</Radio.Button>
                </Radio.Group>
              )}
              {tipoRelatorio === 'vendas' && (
                <Dropdown
                  trigger={['click']}
                  popupRender={() => (
                    <Card size="small" style={{ width: 220 }}>
                      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <Typography.Text strong style={{ fontSize: 12 }}>Colunas visíveis</Typography.Text>
                        <a
                          style={{ fontSize: 12 }}
                          onClick={() => setColunasVisiveis(
                            colunasVisiveis.length === COLUNAS_CONSULTA_VENDAS.length
                              ? []
                              : COLUNAS_CONSULTA_VENDAS.map(c => c.key)
                          )}
                        >
                          {colunasVisiveis.length === COLUNAS_CONSULTA_VENDAS.length ? 'Limpar' : 'Marcar todas'}
                        </a>
                      </div>
                      <Checkbox.Group
                        value={colunasVisiveis}
                        onChange={vals => setColunasVisiveis(vals as string[])}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        {COLUNAS_CONSULTA_VENDAS.map(c => (
                          <Checkbox key={c.key} value={c.key}>{c.label}</Checkbox>
                        ))}
                      </Checkbox.Group>
                    </Card>
                  )}
                >
                  <Button icon={<SettingOutlined />}>
                    Colunas ({colunasVisiveis.length}/{COLUNAS_CONSULTA_VENDAS.length})
                  </Button>
                </Dropdown>
              )}
              {tipoRelatorio === 'fatura' ? (
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={gerandoFaturaUnificada}
                  onClick={gerarFaturaUnificadaTodos}
                  disabled={!leilaoSel || (!vendedorSel && !compradorSel) || !dados.length}
                  title={!leilaoSel || (!vendedorSel && !compradorSel) ? 'Selecione o Leilão e o Vendedor ou o Comprador primeiro' : undefined}
                >
                  {!leilaoSel || (!vendedorSel && !compradorSel)
                    ? 'Selecione Leilão e Vendedor/Comprador'
                    : `Gerar Fatura Unificada (${dados.length} lote${dados.length !== 1 ? 's' : ''})`}
                </Button>
              ) : (
                <PDFDownloadLink
                  key={`${tipoRelatorio}-${orientacaoImp}-${colunasVisiveis.join(',')}-${consultaVersao}-${selectedRowKeys.join(',')}`}
                  document={
                    tipoRelatorio === 'vendas'
                      ? <ConsultaVendasPDF
                          vendas={dadosImpressao}
                          totais={totaisImpressao}
                          titulo={nomeLeilaoSel}
                          empresa={config.empresa}
                          filtrosDesc={filtrosDesc}
                          logoBase64={config.logoBase64}
                          colunasVisiveis={colunasVisiveis}
                          orientacao={orientacaoImp}
                        />
                      : tipoRelatorio === 'partes'
                      ? <PartesVendasPDF
                          vendas={dadosImpressao}
                          titulo={nomeLeilaoSel}
                          empresa={config.empresa}
                          filtrosDesc={filtrosDesc}
                          logoBase64={config.logoBase64}
                          orientacao={orientacaoImp}
                        />
                      : tipoRelatorio === 'medias'
                      ? <MediasLeilaoPDF
                          totais={totaisImpressao}
                          titulo={nomeLeilaoSel}
                          dataLeilao={dadosImpressao[0]?.datlei}
                          empresa={config.empresa}
                          filtrosDesc={filtrosDesc}
                          logoBase64={config.logoBase64}
                        />
                      : <MapaSeguroPDF
                          vendas={dadosImpressao}
                          totais={totaisImpressao}
                          titulo={nomeLeilaoSel}
                          empresa={config.empresa}
                          filtrosDesc={filtrosDesc}
                          logoBase64={config.logoBase64}
                          orientacao={orientacaoImp}
                          pagina={tipoRelatorio === 'seguroCompradores' ? 'compradores' : 'seguradoras'}
                        />
                  }
                  fileName={`${{ vendas: 'consulta-vendas', partes: 'partes-vendas', medias: 'medias-leilao', seguro: 'mapa-seguradoras', seguroCompradores: 'mapa-compradores' }[tipoRelatorio as 'vendas' | 'partes' | 'medias' | 'seguro' | 'seguroCompradores']}-${new Date().toISOString().slice(0, 10)}.pdf`}
                  style={{ textDecoration: 'none' }}
                >
                  {({ loading }) => (
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      loading={loading}
                      disabled={!dados.length}
                    >
                      {loading
                        ? 'Gerando PDF...'
                        : selectedRowKeys.length > 0
                          ? `Imprimir PDF (${selectedRowKeys.length} selecionado${selectedRowKeys.length !== 1 ? 's' : ''})`
                          : 'Imprimir PDF (todos)'}
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
              <Button
                icon={<FileExcelOutlined />}
                onClick={exportarCSV}
                disabled={!dados.length}
              >
                Exportar CSV
              </Button>
            </Space>
          </Row>

          <Table
            rowKey={rowKeyOf}
            components={{ header: { cell: ResizableTitle } }}
            columns={colunas}
            dataSource={dados}
            loading={loading}
            size="small"
            scroll={{ x: 2200 }}
            pagination={{ pageSize: 20, showTotal: t => `${t} registros`, showSizeChanger: true }}
            locale={{ emptyText: 'Nenhuma venda encontrada com os filtros informados' }}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            onChange={(_pagination, _filters, sorter) => {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              setSortField(s?.order ? (s.field as string) : undefined);
              setSortOrder(s?.order || undefined);
            }}
            summary={() =>
              dados.length > 0 ? (
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 700 }}>
                  <Table.Summary.Cell index={0} colSpan={8}>TOTAIS</Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    {totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} />
                  <Table.Summary.Cell index={10} align="right">{fmt(totalValor)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={11} align="right">{fmt(totalComissao)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={12} align="right">{fmt(totalDesconto)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={13} align="right"><span style={{ color: '#52c41a' }}>{fmt(totalLiquido)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={14} colSpan={5} />
                </Table.Summary.Row>
              ) : null
            }
          />
        </>
      )}

      {!consultou && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <FileSearchOutlined style={{ fontSize: 48, marginBottom: 12, display: 'block' }} />
          Selecione os filtros e clique em <strong>Consultar</strong>
        </div>
      )}

      {/* Barra flutuante de seleção */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#001529', color: 'white',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          zIndex: 1000, boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
        }}>
          <Space size={8}>
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
            <span>
              <strong>{selectedRowKeys.length}</strong> lote{selectedRowKeys.length !== 1 ? 's' : ''} selecionado{selectedRowKeys.length !== 1 ? 's' : ''}
            </span>
          </Space>
          <Space size={8}>
            <Button
              icon={<CloseOutlined />}
              onClick={limparSelecao}
              style={{ borderColor: '#aaa', color: '#fff', background: 'transparent' }}
            >
              Limpar
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              loading={gerandoFaturaUnificada}
              onClick={gerarFaturaUnificada}
            >
              Gerar Fatura Unificada
            </Button>
          </Space>
        </div>
      )}

      {/* Modal de resultado da fatura unificada */}
      <Modal
        title="Fatura Unificada"
        open={modalFaturaOpen}
        onCancel={() => setModalFaturaOpen(false)}
        footer={null}
      >
        {faturasUnificadas && faturasUnificadas.length > 0 && (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              {faturasUnificadas.length} documento{faturasUnificadas.length !== 1 ? 's' : ''} — agrupado{faturasUnificadas.length !== 1 ? 's' : ''} por {faturasUnificadas[0]?.modo === 'vendedor' ? 'vendedor' : faturasUnificadas[0]?.modo === 'comprador' ? 'comprador' : 'comprador e vendedor'}:
            </Typography.Paragraph>
            <ul style={{ marginBottom: 16, paddingLeft: 20, fontSize: 12, color: '#666' }}>
              {faturasUnificadas.map((g, i) => {
                const nomeComp = g.comprador ? g.comprador.nomexx || '—' : `${g.contrapartes.length} comprador${g.contrapartes.length !== 1 ? 'es' : ''}`;
                const nomeVen  = g.vendedor  ? g.vendedor.nomexx  || '—' : `${g.contrapartes.length} vendedor${g.contrapartes.length !== 1 ? 'es' : ''}`;
                return (
                  <li key={i}>
                    {nomeComp} — {nomeVen} ({g.lotes.length} lote{g.lotes.length !== 1 ? 's' : ''})
                  </li>
                );
              })}
            </ul>
            <BlobProvider document={<RelatorioFaturaUnificada grupos={faturasUnificadas} empresa={config.empresa} logoBase64={config.logoBase64} />}>
              {({ url, loading }) => (
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  loading={loading}
                  disabled={!url}
                  onClick={() => url && window.open(url, '_blank')}
                  block
                  size="large"
                >
                  {loading ? 'Gerando PDF...' : 'Visualizar / Imprimir'}
                </Button>
              )}
            </BlobProvider>
          </>
        )}
      </Modal>
    </>
  );
}
