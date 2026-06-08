import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker,
  Space, Popconfirm, Typography, Row, Col, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, LineChartOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function Cotacoes() {
  const [dados, setDados]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);
  const [busca, setBusca]         = useState('');
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/cotacoes', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item
      ? { ...item, data: item.data ? dayjs(item.data) : dayjs() }
      : { data: dayjs(), valor: 0 });
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    const payload = { ...values, data: values.data?.toISOString() || new Date().toISOString() };
    try {
      if (editando) await api.put(`/cotacoes/${editando.id}`, payload);
      else await api.post('/cotacoes', payload);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/cotacoes/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'Data', dataIndex: 'data', width: 120,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Cotação', dataIndex: 'cotacao', ellipsis: true },
    { title: 'Tipo', dataIndex: 'tipo', width: 120 },
    { title: 'Valor', dataIndex: 'valor', width: 140, align: 'right' as const,
      render: (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
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
      <Title level={4}><LineChartOutlined style={{ marginRight: 8 }} />Cotações</Title>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search
            placeholder="Buscar por cotação ou tipo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca)}
            enterButton={<SearchOutlined />}
            allowClear
            onClear={() => carregar('')}
          />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Nova Cotação</Button>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={dados}
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }}
      />

      <Modal
        title={editando ? `Editar Cotação` : 'Nova Cotação'}
        open={modalOpen}
        onOk={form.submit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="data" label="Data" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tipo" label="Tipo">
                <Input placeholder="Ex: Arroba, kg, cabeça..." />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="cotacao" label="Cotação" rules={[{ required: true, message: 'Informe a cotação' }]}>
                <Input placeholder="Descrição da cotação" />
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
          </Row>
        </Form>
      </Modal>
    </>
  );
}
