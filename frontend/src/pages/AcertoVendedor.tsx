import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Select, Row, Col, Typography, Button, Table, Card, Space, Spin, Tag,
  Modal, Form, Input, InputNumber, Popconfirm, message, Empty,
} from 'antd';
import {
  SearchOutlined, FileTextOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined,
} from '@ant-design/icons';
import { BlobProvider } from '@react-pdf/renderer';
import api from '../services/api';
import RelatorioAcertoVendedor from '../relatorios/RelatorioAcertoVendedor';
import RelatorioReciboDespesa from '../relatorios/RelatorioReciboDespesa';
import { useConfig } from '../context/ConfigContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const fmt = (v: number | null | undefined) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const DC_OPTS = [
  { value: 'D', label: 'Despesa' },
  { value: 'C', label: 'Crédito' },
  { value: 'F', label: 'Fechamento (pagamento)' },
];
const DC_INFO: Record<string, { label: string; color: string }> = {
  D: { label: 'Despesa', color: 'volcano' },
  S: { label: 'Despesa (legado)', color: 'volcano' },
  C: { label: 'Crédito', color: 'green' },
  E: { label: 'Crédito (legado)', color: 'green' },
  F: { label: 'Fechamento', color: 'blue' },
};
const dcInfo = (v: string) => DC_INFO[v] || { label: v || '—', color: 'default' };

interface Acerto {
  idLeilao: number;
  leilao?: string;
  idVendedor: number;
  vendedor?: string;
  entradas: Array<{ idMc: number; lotexx?: string; deslot?: string; nomeComprador?: string; valorEntrada: number }>;
  promissorias: Array<{ datven: string; valor: number }>;
  lancamentos: Array<{ id: number; dc: string; valor: number; observacoes?: string; dataInclusao?: string }>;
  totais: {
    totalEntradas: number; totalPromissorias: number;
    totalDespesas: number; totalCreditos: number; totalFechamentos: number; saldo: number;
  };
}

export default function AcertoVendedor() {
  const config = useConfig();
  const [leiloes, setLeiloes] = useState<{ value: number; label: string }[]>([]);
  const [leilaoSel, setLeilaoSel] = useState<number | undefined>();
  const [vendedores, setVendedores] = useState<{ value: number; label: string }[]>([]);
  const [vendedorSel, setVendedorSel] = useState<number | undefined>();
  const [loadingVend, setLoadingVend] = useState(false);
  const timerVend = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [acerto, setAcerto] = useState<Acerto | null>(null);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [recibo, setRecibo] = useState<any | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    api.get('/leiloes').then(r => setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao }))));
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

  const consultar = async () => {
    if (!leilaoSel || !vendedorSel) { message.warning('Selecione o leilão e o vendedor'); return; }
    setLoading(true);
    try {
      const r = await api.get('/acerto-vendedor', { params: { idLeilao: leilaoSel, idVendedor: vendedorSel } });
      setAcerto(r.data);
    } catch { message.error('Erro ao calcular o acerto'); }
    finally { setLoading(false); }
  };

  const abrirModal = (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item ? { ...item } : { dc: 'D', valor: 0 });
    setModalOpen(true);
  };

  const salvarLancamento = async (values: any) => {
    if (!acerto) return;
    const payload = { ...values, codLei: acerto.idLeilao, codigoCliente: acerto.idVendedor };
    try {
      if (editando) await api.put(`/despesas/${editando.id}`, payload);
      else await api.post('/despesas', payload);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      consultar();
    } catch { message.error('Erro ao salvar'); }
  };

  const excluirLancamento = async (id: number) => {
    try { await api.delete(`/despesas/${id}`); message.success('Excluído'); consultar(); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunasEntradas = [
    { title: 'Lote', dataIndex: 'lotexx', width: 70 },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true },
    { title: 'Comprador', dataIndex: 'nomeComprador', ellipsis: true, width: 220 },
    { title: 'Valor Entrada', dataIndex: 'valorEntrada', width: 130, align: 'right' as const, render: fmt },
  ];

  const colunasPromissorias = [
    { title: 'Vencimento', dataIndex: 'datven', width: 130 },
    { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: fmt },
  ];

  const colunasLancamentos = [
    { title: 'Tipo', dataIndex: 'dc', width: 130, render: (v: string) => <Tag color={dcInfo(v).color}>{dcInfo(v).label}</Tag> },
    { title: 'Observações', dataIndex: 'observacoes', ellipsis: true },
    { title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const, render: fmt },
    { title: 'Inclusão', dataIndex: 'dataInclusao', width: 100, render: (v: string) => v ? new Date(v).toLocaleDateString('pt-BR') : '—' },
    {
      title: 'Ações', width: 120,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" icon={<PrinterOutlined />} title="Imprimir recibo"
            onClick={() => setRecibo({ ...r, cliente: acerto?.vendedor, leilao: acerto?.leilao })} />
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => excluirLancamento(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalCards = acerto ? [
    { label: 'Total Entradas', value: acerto.totais.totalEntradas, color: '#1677ff' },
    { label: 'Total Promissórias (futuro)', value: acerto.totais.totalPromissorias, color: '#722ed1' },
    { label: 'Total Créditos', value: acerto.totais.totalCreditos, color: '#52c41a' },
    { label: 'Total Despesas', value: acerto.totais.totalDespesas, color: '#ff4d4f' },
    { label: 'Total Fechamentos', value: acerto.totais.totalFechamentos, color: '#13c2c2' },
    { label: 'Saldo', value: acerto.totais.saldo, color: Math.abs(acerto.totais.saldo) < 1 ? '#52c41a' : '#faad14' },
  ] : [];

  return (
    <>
      <Title level={4}><FileTextOutlined style={{ marginRight: 8 }} />Acerto de Vendedor</Title>

      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Select
            placeholder="Selecione o leilão..."
            style={{ width: '100%' }}
            allowClear
            showSearch
            value={leilaoSel}
            options={leiloes}
            onChange={setLeilaoSel}
            filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
          />
        </Col>
        <Col xs={24} md={10}>
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
        <Col xs={24} md={4}>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={consultar} block>
            Consultar
          </Button>
        </Col>
      </Row>

      {!acerto && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <FileTextOutlined style={{ fontSize: 48, marginBottom: 12, display: 'block' }} />
          Selecione o leilão e o vendedor e clique em <strong>Consultar</strong>
        </div>
      )}

      {acerto && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <Text type="secondary">{acerto.leilao}</Text> — <Text strong>{acerto.vendedor}</Text>
            </div>
            <BlobProvider document={<RelatorioAcertoVendedor dados={acerto} empresa={config.empresa} />}>
              {({ url, loading: gerandoPdf }) => (
                <Button
                  icon={<EyeOutlined />}
                  loading={gerandoPdf}
                  disabled={!url}
                  onClick={() => url && window.open(url, '_blank')}
                >
                  {gerandoPdf ? 'Gerando PDF...' : 'Visualizar / Imprimir'}
                </Button>
              )}
            </BlobProvider>
          </div>

          <Row gutter={12} style={{ marginBottom: 16 }}>
            {totalCards.map(({ label, value, color }) => (
              <Col xs={12} md={4} key={label}>
                <Card size="small" styles={{ body: { padding: '10px 12px' } }}>
                  <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{fmt(value)}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card size="small" title={`Entradas (${acerto.entradas.length})`} style={{ marginBottom: 12 }}>
            <Table
              rowKey="idMc" size="small" columns={colunasEntradas} dataSource={acerto.entradas}
              pagination={false} scroll={{ y: 260 }}
              locale={{ emptyText: <Empty description="Nenhuma entrada" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>

          <Card size="small" title="Promissórias — agrupadas por vencimento" style={{ marginBottom: 12 }}>
            <Table
              rowKey="datven" size="small" columns={colunasPromissorias} dataSource={acerto.promissorias}
              pagination={false} scroll={{ y: 220 }}
              locale={{ emptyText: <Empty description="Nenhuma promissória futura" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>

          <Card
            size="small"
            title="Despesas / Créditos / Fechamentos"
            extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Novo Lançamento</Button>}
          >
            <Table
              rowKey="id" size="small" columns={colunasLancamentos} dataSource={acerto.lancamentos}
              pagination={false}
              locale={{ emptyText: <Empty description="Nenhum lançamento" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </>
      )}

      <Modal
        title={editando ? 'Editar Lançamento' : 'Novo Lançamento'}
        open={modalOpen}
        onOk={form.submit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={salvarLancamento}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dc" label="Tipo" rules={[{ required: true }]}>
                <Select options={DC_OPTS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  decimalSeparator=","
                  formatter={v => `R$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={v => v!.replace(/R\$\s?|(\.)/g, '').replace(',', '.') as any}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="observacoes" label="Observações">
                <TextArea rows={3} placeholder="Descrição do lançamento..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Recibo"
        open={!!recibo}
        onCancel={() => setRecibo(null)}
        footer={null}
        width={400}
      >
        {recibo && (
          <BlobProvider document={<RelatorioReciboDespesa dados={recibo} empresa={config.empresa} />}>
            {({ url, loading: gerandoPdf, error }) => (
              <>
                <Button
                  type="primary" icon={<PrinterOutlined />} loading={gerandoPdf} disabled={!url}
                  onClick={() => url && window.open(url, '_blank')} block size="large"
                >
                  {gerandoPdf ? 'Gerando PDF...' : 'Visualizar / Imprimir Recibo'}
                </Button>
                {error ? (
                  <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
                    Erro ao gerar PDF: {String((error as any)?.message || error)}
                  </div>
                ) : null}
              </>
            )}
          </BlobProvider>
        )}
      </Modal>
    </>
  );
}
