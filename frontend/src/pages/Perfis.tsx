import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Typography, Row, Col, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;
const SN = [{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }];

interface Perfil { id: number; perfil: string; inserir?: string; alterar?: string; deletar?: string; }

export default function Perfis() {
  const [dados, setDados] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [form] = Form.useForm();

  const carregar = async () => {
    setLoading(true);
    try { const r = await api.get('/perfis'); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = (item?: Perfil) => {
    setEditando(item || null);
    form.setFieldsValue(item || { perfil: '', inserir: 'N', alterar: 'N', deletar: 'N' });
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/perfis/${editando.id}`, values);
      else await api.post('/perfis', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar();
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/perfis/${id}`); message.success('Excluído'); carregar(); }
    catch { message.error('Erro ao excluir'); }
  };

  const renderSN = (v: string) => <Tag color={v === 'S' ? 'green' : 'red'}>{v === 'S' ? 'Sim' : 'Não'}</Tag>;

  const colunas = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Perfil', dataIndex: 'perfil' },
    { title: 'Inserir', dataIndex: 'inserir', width: 100, align: 'center' as const, render: renderSN },
    { title: 'Alterar', dataIndex: 'alterar', width: 100, align: 'center' as const, render: renderSN },
    { title: 'Deletar', dataIndex: 'deletar', width: 100, align: 'center' as const, render: renderSN },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: Perfil) => (
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
      <Title level={4}>Perfis de Acesso</Title>
      <Row justify="end" style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Novo Perfil</Button>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15 }} size="small" />

      <Modal title={editando ? 'Editar Perfil' : 'Novo Perfil'} open={modalOpen}
        onOk={form.submit} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="perfil" label="Nome do Perfil" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="inserir" label="Inserir"><Select options={SN} /></Form.Item></Col>
            <Col span={8}><Form.Item name="alterar" label="Alterar"><Select options={SN} /></Form.Item></Col>
            <Col span={8}><Form.Item name="deletar" label="Deletar"><Select options={SN} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
