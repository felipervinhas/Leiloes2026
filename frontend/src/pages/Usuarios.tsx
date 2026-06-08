import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm,
  Typography, Row, Col, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;
const SN      = [{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }];
const BLOCLI  = [{ value: 'Não', label: 'Não' }, { value: 'Sim', label: 'Sim' }];
const ACESSO  = ['1 - Liberado', '2 - Bloqueado', '3 - Pendente', '4 - Reprovado'].map(v => ({ value: v, label: v }));

export default function Usuarios() {
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/usuarios', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item
      ? { ...item, senhax: '' }
      : { ativox: 'S', blocli: 'Não', acessoApp: '1 - Liberado', senhax: '' });
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/usuarios/${editando.id}`, values);
      else await api.post('/usuarios', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const revogar = async (id: number) => {
    try { await api.delete(`/usuarios/${id}`); message.success('Acesso de administrador revogado'); carregar(busca); }
    catch { message.error('Erro ao revogar acesso'); }
  };

  const colunas = [
    { title: 'Nome', dataIndex: 'nomexx', ellipsis: true },
    { title: 'E-mail', dataIndex: 'emailx', ellipsis: true, width: 220 },
    { title: 'CPF', dataIndex: 'cpfxxx', width: 130 },
    { title: 'Ativo', dataIndex: 'ativox', width: 80,
      render: (v: string) => <Tag color={v === 'S' ? 'green' : 'red'}>{v === 'S' ? 'Sim' : 'Não'}</Tag> },
    { title: 'Bloqueado', dataIndex: 'blocli', width: 100,
      render: (v: string) => v === 'Sim' ? <Tag color="volcano">Sim</Tag> : <Tag color="default">Não</Tag> },
    { title: 'Acesso App', dataIndex: 'acessoApp', width: 140, ellipsis: true },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Revogar acesso de administrador?" onConfirm={() => revogar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Title level={4}>Usuários do Sistema</Title>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search placeholder="Buscar por nome ou e-mail..." value={busca}
            onChange={e => setBusca(e.target.value)} onSearch={() => carregar(busca)}
            enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Novo Usuário</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }} size="small" />

      <Modal title={editando ? `Editar — ${editando.nomexx}` : 'Novo Usuário do Sistema'}
        open={modalOpen} onOk={form.submit} onCancel={() => setModalOpen(false)} destroyOnClose width={540}>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Row gutter={12}>
            <Col span={14}><Form.Item name="nomexx" label="Nome" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="cpfxxx" label="CPF"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="emailx" label="E-mail" rules={[{ type: 'email', message: 'E-mail inválido' }]}><Input /></Form.Item></Col>
            <Col span={24}>
              <Form.Item name="senhax" label={editando ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                rules={editando ? [] : [{ required: true, message: 'Informe a senha' }]}>
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={8}><Form.Item name="ativox" label="Ativo"><Select options={SN} /></Form.Item></Col>
            <Col span={8}><Form.Item name="blocli" label="Bloqueado"><Select options={BLOCLI} /></Form.Item></Col>
            <Col span={8}><Form.Item name="acessoApp" label="Acesso App"><Select options={ACESSO} allowClear /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
