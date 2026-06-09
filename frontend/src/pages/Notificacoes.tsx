import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm,
  Typography, Row, Col, message, Tag, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, BellOutlined, SendOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;
const { TextArea } = Input;

const PARA_QUEM_OPTS = [
  { value: 'Todos', label: 'Todos os clientes' },
  { value: 'Especifico', label: 'Cliente específico' },
];

export default function Notificacoes() {
  const [dados, setDados]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending]     = useState(false);
  const [busca, setBusca]         = useState('');
  const [clientes, setClientes]   = useState<{ value: number; label: string }[]>([]);
  const [paraQuem, setParaQuem]   = useState<string>('Todos');
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/notificacoes', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    carregar();
    api.get('/clientes').then(r => setClientes(r.data.map((c: any) => ({ value: c.id, label: c.nomexx }))));
  }, []);

  const abrirModal = () => {
    form.resetFields();
    form.setFieldsValue({ paraQuem: 'Todos' });
    setParaQuem('Todos');
    setModalOpen(true);
  };

  const enviar = async (values: any) => {
    setSending(true);
    try {
      // salva no histórico
      await api.post('/notificacoes', {
        titulo: values.titulo,
        mensagem: values.mensagem,
        paraQuem: values.paraQuem,
      });
      // dispara push
      const result = await api.post('/notificacoes/enviar', {
        titulo: values.titulo,
        mensagem: values.mensagem,
        idCliente: values.paraQuem === 'Especifico' ? values.idCliente : undefined,
      });
      const { enviados, erros } = result.data;
      if (enviados > 0) {
        message.success(`Notificação enviada para ${enviados} dispositivo(s)${erros > 0 ? ` (${erros} erro(s))` : ''}`);
      } else if (erros > 0) {
        message.warning('Não foi possível enviar — verifique os tokens dos clientes');
      } else {
        message.info('Nenhum dispositivo cadastrado para receber a notificação');
      }
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao enviar notificação'); }
    finally { setSending(false); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/notificacoes/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'Título', dataIndex: 'titulo', ellipsis: true },
    { title: 'Mensagem', dataIndex: 'mensagem', ellipsis: true },
    { title: 'Para quem', dataIndex: 'paraQuem', width: 150,
      render: (v: string) => <Tag color={v === 'Todos' ? 'blue' : 'purple'}>{v}</Tag> },
    {
      title: 'Ações', width: 80,
      render: (_: any, r: any) => (
        <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Title level={4}><BellOutlined style={{ marginRight: 8 }} />Notificações</Title>

      <Alert
        message="Notificações push via Expo"
        description="As notificações são enviadas via Expo Push API para os dispositivos dos clientes que instalaram o aplicativo."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        closable
      />

      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search
            placeholder="Buscar por título ou mensagem..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca)}
            enterButton={<SearchOutlined />}
            allowClear
            onClear={() => carregar('')}
          />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirModal}>Nova Notificação</Button>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={dados}
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title="Enviar Notificação Push"
        open={modalOpen}
        onOk={form.submit}
        okText={<><SendOutlined /> Enviar</>}
        onCancel={() => setModalOpen(false)}
        confirmLoading={sending}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={enviar}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Informe o título' }]}>
            <Input placeholder="Ex: Resultado do Leilão" maxLength={100} />
          </Form.Item>
          <Form.Item name="mensagem" label="Mensagem" rules={[{ required: true, message: 'Informe a mensagem' }]}>
            <TextArea rows={4} placeholder="Texto da notificação..." maxLength={500} showCount />
          </Form.Item>
          <Form.Item name="paraQuem" label="Destinatário" rules={[{ required: true }]}>
            <Select options={PARA_QUEM_OPTS} onChange={v => setParaQuem(v)} />
          </Form.Item>
          {paraQuem === 'Especifico' && (
            <Form.Item name="idCliente" label="Cliente" rules={[{ required: true, message: 'Selecione o cliente' }]}>
              <Select
                showSearch
                placeholder="Selecione o cliente"
                options={clientes}
                filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
