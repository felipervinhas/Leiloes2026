import React, { useEffect, useState } from 'react';
import { Table, Select, Typography, Row, Col, Tag, Statistic, Card, Space } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function Lances() {
  const [leiloes, setLeiloes] = useState<{ value: number; label: string }[]>([]);
  const [lotes, setLotes]     = useState<{ value: number; label: string }[]>([]);
  const [leilaoSel, setLeilaoSel] = useState<number | undefined>();
  const [loteSel, setLoteSel]     = useState<number | undefined>();
  const [dados, setDados]         = useState<any[]>([]);
  const [resumo, setResumo]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [tab, setTab]             = useState<'lances' | 'resumo'>('resumo');

  useEffect(() => {
    api.get('/leiloes').then(r => setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao }))));
  }, []);

  const onLeilao = async (idLeilao: number) => {
    setLeilaoSel(idLeilao);
    setLoteSel(undefined);
    setDados([]);
    // carregar lotes desse leilão
    const r = await api.get('/lotes', { params: { idLeilao } });
    setLotes(r.data.map((l: any) => ({ value: l.id, label: `${l.lotexx} — ${l.deslot}` })));
    // resumo por lote
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

  const colsResumo = [
    { title: 'Lote', dataIndex: 'lotexx', width: 80 },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true },
    { title: 'Qtd. Lances', dataIndex: 'qtdLances', width: 110, align: 'center' as const,
      render: (v: number) => <Tag color={v > 0 ? 'blue' : 'default'}>{v}</Tag> },
    { title: 'Maior Lance', dataIndex: 'maiorLance', width: 130, align: 'right' as const,
      render: (v: number) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—' },
    { title: 'Menor Lance', dataIndex: 'menorLance', width: 130, align: 'right' as const,
      render: (v: number) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—' },
  ];

  const colsLances = [
    { title: 'Data/Hora', dataIndex: 'data', width: 150,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '—' },
    { title: 'Lote', dataIndex: 'lotexx', width: 80 },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true },
    { title: 'Cliente', dataIndex: 'nomeCliente', ellipsis: true },
    { title: 'Telefone', dataIndex: 'celu1', width: 130 },
    { title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const,
      render: (v: number) => <strong style={{ color: '#52c41a' }}>R$ {Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> },
    { title: 'Origem', dataIndex: 'origemLance', width: 100 },
  ];

  const totalLances = resumo.reduce((a, r) => a + (r.qtdLances || 0), 0);
  const lotesComLance = resumo.filter(r => r.qtdLances > 0).length;

  return (
    <>
      <Title level={4}><TrophyOutlined style={{ marginRight: 8 }} />Lances</Title>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Select
            placeholder="Selecione o leilão"
            style={{ width: '100%' }}
            options={leiloes}
            onChange={onLeilao}
            showSearch
            filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
          />
        </Col>
        <Col span={12}>
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
            columns={colsLances}
            dataSource={dados}
            loading={loading}
            size="small"
            pagination={{ pageSize: 20, showTotal: t => `${t} lances` }}
          />
        </>
      )}
    </>
  );
}
