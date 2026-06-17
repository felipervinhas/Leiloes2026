import React, { useEffect, useState } from 'react';
import { Table, Select, Typography, Row, Col, Tag, Statistic, Card, Space, Button, Modal } from 'antd';
import ResizableTitle from '../components/ResizableTitle';
import { useColumnWidths } from '../hooks/useColumnWidths';
import { TrophyOutlined, FileDoneOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useConfig } from '../context/ConfigContext';
import dayjs from 'dayjs';
import BotaoBaixarLancesPDF, { LancePDF } from '../relatorios/RelatorioLances';

const { Title, Text } = Typography;

export default function Lances() {
  const config = useConfig();

  const [leiloes, setLeiloes] = useState<{ value: number; label: string }[]>([]);
  const [lotes, setLotes]     = useState<{ value: number; label: string }[]>([]);
  const [leilaoSel, setLeilaoSel]   = useState<number | undefined>();
  const [leilaoLabel, setLeilaoLabel] = useState('');
  const [loteSel, setLoteSel]       = useState<number | undefined>();
  const [dados, setDados]           = useState<any[]>([]);
  const [resumo, setResumo]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [tab, setTab]               = useState<'lances' | 'resumo'>('resumo');

  const [relatorioModal, setRelatorioModal]     = useState(false);
  const [lancesRelatorio, setLancesRelatorio]   = useState<LancePDF[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const { rz: rzR } = useColumnWidths('lances_resumo', { lotexx: 80, deslot: 200, qtdLances: 110, maiorLance: 130, menorLance: 130 });
  const { rz: rzL } = useColumnWidths('lances_detalhes', { data: 150, lotexx: 80, deslot: 180, nomeCliente: 200, celu1: 130, valor: 130, origemLance: 100 });

  useEffect(() => {
    api.get('/leiloes').then(r => setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao }))));
  }, []);

  const onLeilao = async (idLeilao: number) => {
    setLeilaoSel(idLeilao);
    setLeilaoLabel(leiloes.find(l => l.value === idLeilao)?.label || '');
    setLoteSel(undefined);
    setDados([]);
    setLancesRelatorio([]);
    const r = await api.get('/lotes', { params: { idLeilao } });
    setLotes(r.data.map((l: any) => ({ value: l.id, label: `${l.lotexx} — ${l.deslot}` })));
    setLoading(true);
    try {
      const res = await api.get(`/lances/resumo/${idLeilao}`);
      setResumo(res.data);
    } finally { setLoading(false); }
  };

  const onLote = async (idLote: number) => {
    setLoteSel(idLote);
    setTab('lances');
    setLoading(true);
    try {
      const r = await api.get('/lances', { params: { idLeilao: leilaoSel, idLote } });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  const gerarRelatorio = async () => {
    if (!leilaoSel) return;
    setLoadingRelatorio(true);
    try {
      const r = await api.get('/lances', { params: { idLeilao: leilaoSel } });
      setLancesRelatorio(r.data as LancePDF[]);
      setRelatorioModal(true);
    } finally { setLoadingRelatorio(false); }
  };

  const colsResumo = [
    { title: 'Lote', dataIndex: 'lotexx', ...rzR('lotexx') },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true, ...rzR('deslot') },
    { title: 'Qtd. Lances', dataIndex: 'qtdLances', ...rzR('qtdLances'), align: 'center' as const,
      render: (v: number) => <Tag color={v > 0 ? 'blue' : 'default'}>{v}</Tag> },
    { title: 'Maior Lance', dataIndex: 'maiorLance', ...rzR('maiorLance'), align: 'right' as const,
      render: (v: number) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—' },
    { title: 'Menor Lance', dataIndex: 'menorLance', ...rzR('menorLance'), align: 'right' as const,
      render: (v: number) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—' },
  ];

  const colsLances = [
    { title: 'Data/Hora', dataIndex: 'data', ...rzL('data'),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '—' },
    { title: 'Lote', dataIndex: 'lotexx', ...rzL('lotexx') },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true, ...rzL('deslot') },
    { title: 'Cliente', dataIndex: 'nomeCliente', ellipsis: true, ...rzL('nomeCliente') },
    { title: 'Telefone', dataIndex: 'celu1', ...rzL('celu1') },
    { title: 'Valor', dataIndex: 'valor', ...rzL('valor'), align: 'right' as const,
      render: (v: number) => <strong style={{ color: '#52c41a' }}>R$ {Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> },
    { title: 'Origem', dataIndex: 'origemLance', ...rzL('origemLance') },
  ];

  const totalLances = resumo.reduce((a, r) => a + (r.qtdLances || 0), 0);
  const lotesComLance = resumo.filter(r => r.qtdLances > 0).length;

  const lotesRelatorio = new Set(lancesRelatorio.map(l => l.idLote)).size;

  return (
    <>
      <Title level={4}><TrophyOutlined style={{ marginRight: 8 }} />Lances</Title>

      <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
        <Col span={11}>
          <Select
            placeholder="Selecione o leilão"
            style={{ width: '100%' }}
            options={leiloes}
            onChange={onLeilao}
            showSearch
            filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
          />
        </Col>
        <Col span={11}>
          <Select
            placeholder="Filtrar por lote (opcional)"
            style={{ width: '100%' }}
            options={lotes}
            value={loteSel}
            onChange={onLote}
            disabled={!leilaoSel}
            showSearch
            allowClear
            onClear={() => { setLoteSel(undefined); setDados([]); setTab('resumo'); }}
            filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
          />
        </Col>
        <Col span={2} style={{ textAlign: 'right' }}>
          <Button
            icon={<FileDoneOutlined />}
            disabled={!leilaoSel || resumo.length === 0}
            loading={loadingRelatorio}
            onClick={gerarRelatorio}
            title="Gerar Relatório de Lances"
          >
            PDF
          </Button>
        </Col>
      </Row>

      {resumo.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="Total de Lotes" value={resumo.length} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Lotes com Lances" value={lotesComLance} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Total de Lances" value={totalLances} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Lotes sem Lance" value={resumo.length - lotesComLance} valueStyle={{ color: '#faad14' }} /></Card></Col>
        </Row>
      )}

      {tab === 'resumo' && (
        <Table
          rowKey="idLote"
          components={{ header: { cell: ResizableTitle } }}
          columns={colsResumo}
          dataSource={resumo}
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showTotal: t => `${t} lotes` }}
          onRow={r => ({ onClick: () => onLote(r.idLote), style: { cursor: 'pointer' } })}
          locale={{ emptyText: leilaoSel ? 'Nenhum lote encontrado' : 'Selecione um leilão para ver os lances' }}
        />
      )}

      {tab === 'lances' && (
        <>
          <Space style={{ marginBottom: 8 }}>
            <a onClick={() => setTab('resumo')} style={{ fontSize: 13 }}>← Voltar ao resumo</a>
          </Space>
          <Table
            rowKey="id"
            components={{ header: { cell: ResizableTitle } }}
            columns={colsLances}
            dataSource={dados}
            loading={loading}
            size="small"
            pagination={{ pageSize: 20, showTotal: t => `${t} lances` }}
          />
        </>
      )}

      {/* Modal de relatório */}
      <Modal
        open={relatorioModal}
        onCancel={() => setRelatorioModal(false)}
        footer={null}
        title={
          <Space>
            <FileDoneOutlined />
            <span>Relatório de Lances — {leilaoLabel}</span>
          </Space>
        }
        width={420}
      >
        <div style={{ padding: '12px 0', textAlign: 'center' }}>
          <div style={{ marginBottom: 16, textAlign: 'left', lineHeight: 2 }}>
            <Text type="secondary">
              <strong>{lancesRelatorio.length}</strong> lance{lancesRelatorio.length !== 1 ? 's' : ''} em{' '}
              <strong>{lotesRelatorio}</strong> lote{lotesRelatorio !== 1 ? 's' : ''}
            </Text>
          </div>
          <BotaoBaixarLancesPDF
            lances={lancesRelatorio}
            leilao={leilaoLabel}
            empresa={config.empresa}
          />
        </div>
      </Modal>
    </>
  );
}
