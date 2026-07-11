import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Popconfirm, Typography, Row, Col, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

interface Classificacao { id: number; descricao: string; }

export default function Classificacoes() {
  const [dados, setDados] = useState<Classificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Classificacao | null>(null);
  const [busca, setBusca] = useState('');
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/classificacoes', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = (item?: Classificacao) => {
    setEditando(item || null);
    form.setFieldsValue(item || { descricao: '' });
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/classificacoes/${editando.id}`, values);
      else await api.post('/classificacoes', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/classificacoes/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Descrição', dataIndex: 'descricao' },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: Classificacao) => (
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
      <Title level={4}>Classificações</Title>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search placeholder="Buscar por descrição..." value={busca}
            onChange={e => setBusca(e.target.value)} onSearch={carregar}
            enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Nova Classificação</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }} size="small"
        scroll={{ x: 'max-content' }} />

      <Modal title={editando ? 'Editar Classificação' : 'Nova Classificação'} open={modalOpen}
        onOk={form.submit} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="descricao" label="Descrição" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
