import React, { useEffect, useState } from 'react';
import { Select, Button, Table, Input, Space, message, Typography, Row, Col, Tag, Grid, Tooltip } from 'antd';
import {
  SaveOutlined, PrinterOutlined, OrderedListOutlined, ClearOutlined, CalendarOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import { BotaoBaixarPDFOrdem, LoteOrdemPDF } from '../relatorios/RelatorioOrdemEntrada';
import { useConfig } from '../context/ConfigContext';

interface LoteOrdem {
  id: number;
  lotexx: string;
  deslot?: string;
  nomeVendedor?: string;
  nomeRaca?: string;
  catego?: string;
  ordem?: string;
}

const CATEGO_COR: Record<string, string> = { M: 'blue', F: 'magenta', N: 'default', C: 'orange' };
const CATEGO_LABEL: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

export default function OrdemEntrada() {
  const config = useConfig();
  const screens = Grid.useBreakpoint();
  const sm = !!screens.sm;

  const [leiloes, setLeiloes] = useState<{ value: number; label: string }[]>([]);
  const [leilaoId, setLeilaoId] = useState<number | undefined>();
  const [nomeLeilao, setNomeLeilao] = useState<string | undefined>();
  const [lotes, setLotes] = useState<LoteOrdem[]>([]);
  const [ordens, setOrdens] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/leiloes').then(r => {
      setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao || `Leilão #${l.id}` })));
    });
  }, []);

  const carregarLotes = async (id: number, label: string) => {
    setLoading(true);
    try {
      const r = await api.get('/lotes', { params: { idLeilao: id } });
      const data: LoteOrdem[] = r.data;
      setLotes(data);
      const init: Record<number, string> = {};
      data.forEach(l => { init[l.id] = l.ordem || ''; });
      setOrdens(init);
      setNomeLeilao(label);
    } finally {
      setLoading(false);
    }
  };

  const onChangeLeilao = (id: number, opt: any) => {
    setLeilaoId(id);
    carregarLotes(id, opt.label as string);
  };

  const setOrdem = (id: number, valor: string) =>
    setOrdens(prev => ({ ...prev, [id]: valor }));

  const autonumerar = () => {
    const novas: Record<number, string> = {};
    lotes.forEach((l, i) => { novas[l.id] = String(i + 1).padStart(2, '0'); });
    setOrdens(novas);
    message.success('Numeração automática aplicada — salve para confirmar');
  };

  const limparOrdens = () => {
    const novas: Record<number, string> = {};
    lotes.forEach(l => { novas[l.id] = ''; });
    setOrdens(novas);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const payload = lotes.map(l => ({ id: l.id, ordem: ordens[l.id] || null }));
      await api.post('/lotes/salvar-ordens', { lotes: payload });
      message.success('Ordem salva com sucesso');
    } catch {
      message.error('Erro ao salvar ordem');
    } finally {
      setSalvando(false);
    }
  };

  const comOrdem = lotes.filter(l => ordens[l.id]);

  const lotesParaPDF: LoteOrdemPDF[] = lotes
    .map(l => ({ ...l, ordem: ordens[l.id] || l.ordem || '' }))
    .sort((a, b) => {
      const na = a.ordem ? parseInt(a.ordem) || 999 : 9999;
      const nb = b.ordem ? parseInt(b.ordem) || 999 : 9999;
      return na - nb || a.lotexx.localeCompare(b.lotexx);
    });

  const colunas = [
    {
      title: 'Ordem',
      key: 'ordem',
      width: 80,
      render: (_: any, r: LoteOrdem) => (
        <Input
          size="small"
          value={ordens[r.id] ?? ''}
          onChange={e => setOrdem(r.id, e.target.value)}
          maxLength={3}
          style={{
            width: 60,
            textAlign: 'center',
            fontWeight: 700,
            color: ordens[r.id] ? '#1677ff' : undefined,
          }}
          placeholder="—"
        />
      ),
    },
    { title: 'Lote', dataIndex: 'lotexx', width: 70 },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true },
    ...(sm ? [{ title: 'Vendedor', dataIndex: 'nomeVendedor', ellipsis: true, width: 180 }] : []),
    ...(sm ? [{ title: 'Raça', dataIndex: 'nomeRaca', width: 120, ellipsis: true }] : []),
    {
      title: 'Sexo',
      dataIndex: 'catego',
      width: 70,
      render: (v: string) => v
        ? <Tag color={CATEGO_COR[v] || 'default'}>{sm ? (CATEGO_LABEL[v] || v) : v}</Tag>
        : '—',
    },
  ];

  return (
    <>
      <Typography.Title level={4}>
        <CalendarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        Ordem de Entrada
      </Typography.Title>

      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={14}>
          <Select
            placeholder="Selecione o leilão..."
            options={leiloes}
            value={leilaoId}
            onChange={onChangeLeilao}
            style={{ width: '100%' }}
            showSearch
            filterOption={(input, opt) =>
              (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Col>

        {lotes.length > 0 && (
          <Col xs={24} md={10}>
            <Space wrap size={6}>
              <Tooltip title="Numera todos os lotes sequencialmente pela ordem da tabela">
                <Button icon={<OrderedListOutlined />} onClick={autonumerar}>
                  Auto-numerar
                </Button>
              </Tooltip>
              <Button icon={<ClearOutlined />} onClick={limparOrdens}>
                Limpar
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={salvar}
                loading={salvando}
              >
                Salvar
              </Button>
              <BotaoBaixarPDFOrdem
                lotes={lotesParaPDF}
                titulo={nomeLeilao}
                empresa={config.empresa}
              />
            </Space>
          </Col>
        )}
      </Row>

      {leilaoId && lotes.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
          <span style={{ color: '#389e0d', fontWeight: 600 }}>{comOrdem.length}</span> de{' '}
          <strong>{lotes.length}</strong> lotes com ordem definida
        </div>
      )}

      {leilaoId && (
        <Table
          rowKey="id"
          columns={colunas}
          dataSource={lotes}
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ x: sm ? 700 : 400, y: 'calc(100vh - 300px)' }}
          rowClassName={r => ordens[r.id] ? 'lote-com-ordem' : ''}
        />
      )}

      <style>{`
        .lote-com-ordem td { background-color: #f6ffed !important; }
        .lote-com-ordem:hover td { background-color: #d9f7be !important; }
      `}</style>
    </>
  );
}
