import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Popconfirm, Typography, Row, Col, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

interface Cidade { id: number; cidade: string; estado: string; pais?: string; }

export default function Cidades() {
  const [dados, setDados] = useState<Cidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Cidade | null>(null);
  const [busca, setBusca] = useState('');
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/cidades', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = (item?: Cidade) => {
    setEditando(item || null);
    form.setFieldsValue(item || { cidade: '', estado: '', pais: '' });
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/cidades/${editando.id}`, values);
      else await api.post('/cidades', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/cidades/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Cidade', dataIndex: 'cidade', sorter: (a: Cidade, b: Cidade) => a.cidade.localeCompare(b.cidade) },
    { title: 'Estado', dataIndex: 'estado', width: 120 },
    { title: 'País', dataIndex: 'pais', width: 120 },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: Cidade) => (
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
      <Title level={4}>Cidades</Title>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search placeholder="Buscar por cidade ou estado..." value={busca}
            onChange={e => setBusca(e.target.value)} onSearch={carregar}
            enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Nova Cidade</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }} size="small"
        scroll={{ x: 'max-content' }} />

      <Modal title={editando ? 'Editar Cidade' : 'Nova Cidade'} open={modalOpen}
        onOk={form.submit} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="cidade" label="Cidade" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="estado" label="Estado" rules={[{ required: true }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="pais" label="País">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
