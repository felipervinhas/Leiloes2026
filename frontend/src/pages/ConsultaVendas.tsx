import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Table, Button, Select, Row, Col, Typography, Tag, Space,
  Card, Divider, message, Spin, Radio,
} from 'antd';
import {
  SearchOutlined, FileExcelOutlined, FileSearchOutlined, ClearOutlined, PrinterOutlined,
} from '@ant-design/icons';
import { PDFDownloadLink } from '@react-pdf/renderer';
import api from '../services/api';
import dayjs from 'dayjs';
import ConsultaVendasPDF from '../relatorios/RelatorioConsultaVendas';
import PartesVendasPDF from '../relatorios/RelatorioPartesVendas';
import { useConfig } from '../context/ConfigContext';

type Orientacao = 'retrato' | 'paisagem';
type TipoRelatorio = 'vendas' | 'partes';

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

export default function ConsultaVendas() {
  const config = useConfig();
  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>('vendas');
  const [orientacaoImp, setOrientacaoImp] = useState<Orientacao>('paisagem');
  const [leiloes, setLeiloes]   = useState<{ value: number; label: string }[]>([]);
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

  useEffect(() => {
    api.get('/leiloes').then(r =>
      setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao }))));
  }, []);

  const buscarVendedores = useCallback((busca: string) => {
    clearTimeout(timerVend.current);
    if (busca.length < 2) { setVendedores([]); return; }
    timerVend.current = setTimeout(async () => {
      setLoadingVend(true);
      try {
        const r = await api.get('/clientes', { params: { busca, filtro: 'nome' } });
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
        const r = await api.get('/clientes', { params: { busca, filtro: 'nome' } });
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
    setLoading(true);
    setConsultou(true);
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
    } catch { message.error('Erro ao consultar vendas'); }
    finally { setLoading(false); }
  };

  const limpar = () => {
    setLeilaoSel(undefined); setLoteSel(undefined);
    setVendedorSel(undefined); setCompradorSel(undefined);
    setDefesaSel(''); setRacasSel([]);
    setLotes([]); setRacas([]);
    setVendedores([]); setCompradores([]);
    setDados([]); setConsultou(false);
  };

  const exportarCSV = () => {
    if (!dados.length) return;
    const cols = colunas.filter(c => c.dataIndex);
    const header = cols.map(c => c.title).join(';');
    const rows = dados.map(row =>
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
  const totalLotes      = dados.length;
  const totalValor      = dados.reduce((a, d) => a + (d.valorPagar     || 0), 0);
  const totalComissao   = dados.reduce((a, d) => a + (d.valorComissao  || 0), 0);
  const totalLiquido    = dados.reduce((a, d) => a + (d.valorLiquido   || 0), 0);
  const totalDesconto   = dados.reduce((a, d) => a + (d.valorDesconto  || 0), 0);
  const totalQtd        = dados.reduce((a, d) => a + (d.qtdxxx         || 0), 0);
  const mediaGeral      = totalQtd > 0 ? totalValor / totalQtd : 0;

  const colunas: any[] = [
    { title: 'Lote', dataIndex: 'lotexx', width: 70, fixed: 'left' as const,
      sorter: (a: any, b: any) => (a.lotexx || '').localeCompare(b.lotexx || '') },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true, width: 180 },
    { title: 'Raça', dataIndex: 'descricaoRaca', width: 120, ellipsis: true },
    { title: 'Espécie', dataIndex: 'especies', width: 90, ellipsis: true },
    { title: 'RP', dataIndex: 'rpxxx', width: 90 },
    { title: 'SBB', dataIndex: 'sbbxxx', width: 90 },
    { title: 'Vendedor', dataIndex: 'nomeVendedor', ellipsis: true, width: 160 },
    { title: 'Comprador', dataIndex: 'nomeComprador', ellipsis: true, width: 160 },
    { title: 'Qtd', dataIndex: 'qtdxxx', width: 70, align: 'right' as const,
      render: (v: number) => v ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—' },
    { title: 'Vlr. Unit.', dataIndex: 'valorUnidade', width: 110, align: 'right' as const,
      render: fmt,
      sorter: (a: any, b: any) => (a.valorUnidade || 0) - (b.valorUnidade || 0) },
    { title: 'Vlr. a Pagar', dataIndex: 'valorPagar', width: 120, align: 'right' as const,
      render: (v: number) => <Text strong>{fmt(v)}</Text>,
      sorter: (a: any, b: any) => (a.valorPagar || 0) - (b.valorPagar || 0) },
    { title: 'Comissão', dataIndex: 'valorComissao', width: 110, align: 'right' as const,
      render: (v: number) => <Text type="warning">{fmt(v)}</Text> },
    { title: 'Desconto', dataIndex: 'valorDesconto', width: 110, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="danger">- {fmt(v)}</Text> : '—' },
    { title: 'Vlr. Líquido', dataIndex: 'valorLiquido', width: 120, align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmt(v)}</Text>,
      sorter: (a: any, b: any) => (a.valorLiquido || 0) - (b.valorLiquido || 0) },
    { title: 'Condição', dataIndex: 'desfin', width: 130, ellipsis: true },
    { title: '1ª Parcela', dataIndex: 'parcelaInicial', width: 110, align: 'right' as const, render: fmt },
    { title: 'Vencimento', dataIndex: 'primeiroVencimentoData', width: 110 },
    { title: 'Dt. Lançamento', dataIndex: 'datlan', width: 120,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Status', dataIndex: 'defesa', width: 100,
      render: (v: string) => v === 'S'
        ? <Tag color="green">Vendido</Tag>
        : <Tag color="default">Não vendido</Tag> },
  ];

  return (
    <>
      <Title level={4}><FileSearchOutlined style={{ marginRight: 8 }} />Consulta de Vendas</Title>

      {/* ── Filtros ── */}
      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col span={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Leilão</div>
            <Select
              placeholder="Todos os leilões"
              style={{ width: '100%' }}
              allowClear
              showSearch
              value={leilaoSel}
              options={leiloes}
              onChange={onLeilao}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
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
                ]}
              />
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
              <PDFDownloadLink
                key={`${tipoRelatorio}-${orientacaoImp}`}
                document={
                  tipoRelatorio === 'vendas'
                    ? <ConsultaVendasPDF
                        vendas={dados}
                        totais={{ totalLotes, totalValor, totalComissao, totalDesconto, totalLiquido, totalQtd, mediaGeral }}
                        titulo={nomeLeilaoSel}
                        empresa={config.empresa}
                        filtrosDesc={filtrosDesc}
                        orientacao={orientacaoImp}
                      />
                    : <PartesVendasPDF
                        vendas={dados}
                        titulo={nomeLeilaoSel}
                        empresa={config.empresa}
                        filtrosDesc={filtrosDesc}
                        orientacao={orientacaoImp}
                      />
                }
                fileName={`${tipoRelatorio === 'vendas' ? 'consulta-vendas' : 'partes-vendas'}-${new Date().toISOString().slice(0, 10)}.pdf`}
                style={{ textDecoration: 'none' }}
              >
                {({ loading }) => (
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    loading={loading}
                    disabled={!dados.length}
                  >
                    {loading ? 'Gerando PDF...' : 'Imprimir PDF'}
                  </Button>
                )}
              </PDFDownloadLink>
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
            rowKey="id"
            columns={colunas}
            dataSource={dados}
            loading={loading}
            size="small"
            scroll={{ x: 2200 }}
            pagination={{ pageSize: 20, showTotal: t => `${t} registros`, showSizeChanger: true }}
            locale={{ emptyText: 'Nenhuma venda encontrada com os filtros informados' }}
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
    </>
  );
}
