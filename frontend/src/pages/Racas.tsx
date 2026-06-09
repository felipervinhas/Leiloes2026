import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Typography, Row, Col, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;
const ESPECIES = ['BOVINOS', 'EQUINOS', 'OVINOS', 'SUINOS', 'CAPRINOS', 'OUTROS'];

interface Raca { id: number; descricao: string; especies?: string; raca?: string; }

export default function Racas() {
  const [dados, setDados] = useState<Raca[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Raca | null>(null);
  const [busca, setBusca] = useState('');
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/racas', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = (item?: Raca) => {
    setEditando(item || null);
    form.setFieldsValue(item || { descricao: '', especies: '', raca: '' });
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/racas/${editando.id}`, values);
      else await api.post('/racas', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/racas/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Descrição', dataIndex: 'descricao' },
    { title: 'Espécie', dataIndex: 'especies', width: 140 },
    { title: 'Raça', dataIndex: 'raca', width: 160 },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: Raca) => (
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
      <Title level={4}>Raças</Title>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search placeholder="Buscar por descrição ou espécie..." value={busca}
            onChange={e => setBusca(e.target.value)} onSearch={carregar}
            enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Nova Raça</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }} size="small"
        scroll={{ x: 'max-content' }} />

      <Modal title={editando ? 'Editar Raça' : 'Nova Raça'} open={modalOpen}
        onOk={form.submit} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="descricao" label="Descrição" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="especies" label="Espécie">
            <Select options={ESPECIES.map(e => ({ value: e, label: e }))} allowClear />
          </Form.Item>
          <Form.Item name="raca" label="Raça">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
