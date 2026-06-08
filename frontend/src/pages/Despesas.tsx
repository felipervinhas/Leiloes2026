import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Popconfirm, Typography, Row, Col, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, WalletOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;
const { TextArea } = Input;

const DC_OPTS = [
  { value: 'E', label: 'Entrada / Recibo' },
  { value: 'S', label: 'Saída / Despesa' },
];

export default function Despesas() {
  const [dados, setDados]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);
  const [busca, setBusca]         = useState('');
  const [leiloes, setLeiloes]     = useState<{ value: number; label: string }[]>([]);
  const [clientes, setClientes]   = useState<{ value: number; label: string }[]>([]);
  const [leilaoFiltro, setLeilaoFiltro] = useState<number | undefined>();
  const [form] = Form.useForm();

  const carregar = async (b = '', idLeilao?: number) => {
    setLoading(true);
    try {
      const r = await api.get('/despesas', { params: { busca: b, idLeilao } });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    carregar();
    api.get('/leiloes').then(r => setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao }))));
    api.get('/clientes').then(r => setClientes(r.data.map((c: any) => ({ value: c.id, label: c.nomexx }))));
  }, []);

  const abrirModal = (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item
      ? { ...item }
      : { dc: 'S', valor: 0 });
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/despesas/${editando.id}`, values);
      else await api.post('/despesas', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca, leilaoFiltro);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/despesas/${id}`); message.success('Excluído'); carregar(busca, leilaoFiltro); }
    catch { message.error('Erro ao excluir'); }
  };

  const totalEntradas = dados.filter(d => d.dc === 'E').reduce((a, d) => a + (d.valor || 0), 0);
  const totalSaidas   = dados.filter(d => d.dc === 'S').reduce((a, d) => a + (d.valor || 0), 0);
  const saldo         = totalEntradas - totalSaidas;

  const colunas = [
    { title: 'Tipo', dataIndex: 'dc', width: 110,
      render: (v: string) => v === 'E'
        ? <Tag color="green">Entrada</Tag>
        : <Tag color="volcano">Saída</Tag> },
    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true, width: 180 },
    { title: 'Cliente', dataIndex: 'cliente', ellipsis: true },
    { title: 'Observações', dataIndex: 'observacoes', ellipsis: true },
    { title: 'Valor', dataIndex: 'valor', width: 140, align: 'right' as const,
      render: (v: number, r: any) => (
        <span style={{ color: r.dc === 'E' ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {r.dc === 'S' ? '- ' : '+ '}R$ {Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { title: 'Inclusão', dataIndex: 'dataInclusao', width: 110,
      render: (v: string) => v ? new Date(v).toLocaleDateString('pt-BR') : '—' },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Title level={4}><WalletOutlined style={{ marginRight: 8 }} />Despesas</Title>

      {dados.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {[
            { label: 'Total Entradas', value: totalEntradas, color: '#52c41a' },
            { label: 'Total Saídas',   value: totalSaidas,   color: '#ff4d4f' },
            { label: 'Saldo',          value: saldo,         color: saldo >= 0 ? '#52c41a' : '#ff4d4f' },
          ].map(({ label, value, color }) => (
            <Col span={8} key={label}>
              <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 16px' }}>
                <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>
                  R$ {Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col style={{ width: 240 }}>
          <Select
            placeholder="Filtrar por leilão"
            style={{ width: '100%' }}
            allowClear
            options={leiloes}
            onChange={v => { setLeilaoFiltro(v); carregar(busca, v); }}
            showSearch
            filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
          />
        </Col>
        <Col flex="auto">
          <Input.Search
            placeholder="Buscar por observação ou cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca, leilaoFiltro)}
            enterButton={<SearchOutlined />}
            allowClear
            onClear={() => carregar('', leilaoFiltro)}
          />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Nova Despesa</Button>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={dados}
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }}
        scroll={{ x: 900 }}
      />

      <Modal
        title={editando ? 'Editar Lançamento' : 'Novo Lançamento'}
        open={modalOpen}
        onOk={form.submit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={salvar}>
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
              <Form.Item name="codLei" label="Leilão">
                <Select
                  showSearch
                  allowClear
                  placeholder="Selecione o leilão (opcional)"
                  options={leiloes}
                  filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="codigoCliente" label="Cliente">
                <Select
                  showSearch
                  allowClear
                  placeholder="Selecione o cliente (opcional)"
                  options={clientes}
                  filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
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
    </>
  );
}
