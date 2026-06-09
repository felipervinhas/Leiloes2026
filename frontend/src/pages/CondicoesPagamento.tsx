import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Typography, Row, Col, message, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

interface Condicao { id: number; desfin: string; przmed?: number; qtdpar?: string; avista?: string; entrad?: string; descon?: string; }

export default function CondicoesPagamento() {
  const [dados, setDados] = useState<Condicao[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Condicao | null>(null);
  const [busca, setBusca] = useState('');
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/condicoes-pagamento', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = async (item?: Condicao) => {
    if (item) {
      const r = await api.get(`/condicoes-pagamento/${item.id}`);
      form.setFieldsValue(r.data);
      setEditando(r.data);
    } else {
      form.resetFields();
      setEditando(null);
    }
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/condicoes-pagamento/${editando.id}`, values);
      else await api.post('/condicoes-pagamento', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/condicoes-pagamento/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Descrição', dataIndex: 'desfin' },
    { title: 'Qtd. Parcelas', dataIndex: 'qtdpar', width: 130, align: 'center' as const },
    { title: 'Prazo Médio', dataIndex: 'przmed', width: 130, align: 'center' as const },
    { title: 'À Vista', dataIndex: 'avista', width: 90, align: 'center' as const, render: (v: string) => v === 'S' ? 'Sim' : 'Não' },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: Condicao) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const parcFields = Array.from({ length: 6 }, (_, i) => `parc0${i + 1}`);

  return (
    <>
      <Title level={4}>Condições de Pagamento</Title>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search placeholder="Buscar condição..." value={busca}
            onChange={e => setBusca(e.target.value)} onSearch={carregar}
            enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Nova Condição</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }} size="small"
        scroll={{ x: 'max-content' }} />

      <Modal title={editando ? 'Editar Condição' : 'Nova Condição'} open={modalOpen}
        onOk={form.submit} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="desfin" label="Descrição" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={8}><Form.Item name="qtdpar" label="Qtd. Parcelas"><Input /></Form.Item></Col>
            <Col xs={24} sm={8}><Form.Item name="przmed" label="Prazo Médio (dias)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} sm={8}><Form.Item name="descon" label="Desconto (%)"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item name="avista" label="À Vista">
                <Select options={[{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="entrad" label="Entrada">
                <Select options={[{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="invert" label="Inverter Qtd.">
                <Select options={[{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Divider plain>Vencimentos das Parcelas (dias)</Divider>
          <Row gutter={12}>
            {parcFields.map((f, i) => (
              <Col xs={8} sm={4} key={f}>
                <Form.Item name={f} label={`Parc. ${i + 1}`}><Input /></Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>
    </>
  );
}
