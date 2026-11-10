import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { erroApi, fmtDataHora } from './tipos';

const { Paragraph } = Typography;

export default function Descadastrados() {
  const [dados, setDados] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setDados((await api.get('/whatsapp/descadastrados', { params: { busca: busca || undefined } })).data); }
    catch (e) { message.error(erroApi(e, 'Erro ao carregar')); }
    finally { setCarregando(false); }
  }, [busca]);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionar = async (v: any) => {
    try { await api.post('/whatsapp/descadastrados', v); message.success('Número descadastrado'); setModal(false); carregar(); }
    catch (e) { message.error(erroApi(e, 'Erro ao descadastrar')); }
  };

  const remover = async (chave: string) => {
    try { await api.delete(`/whatsapp/descadastrados/${chave}`); message.success('Número volta a receber'); carregar(); }
    catch (e) { message.error(erroApi(e, 'Erro ao remover')); }
  };

  return (
    <>
      <Paragraph type="secondary">
        Estes números nunca recebem campanhas. O cliente entra aqui sozinho ao responder SAIR (ou PARAR, STOP...)
        e sai ao responder VOLTAR. Respeitar o descadastro mantém a qualidade do número na Meta.
      </Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="Nome ou telefone" onSearch={setBusca} style={{ width: 240 }} />
        <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>Descadastrar número</Button>
      </Space>
      <Table rowKey="chave" size="small" loading={carregando} dataSource={dados}
        pagination={{ pageSize: 20, showTotal: t => `${t} números` }}
        columns={[
          { title: 'Nome', dataIndex: 'nome', ellipsis: true },
          { title: 'Telefone', dataIndex: 'telefone', width: 170 },
          { title: 'Origem', dataIndex: 'origem', width: 110,
            render: (o: string) => <Tag color={o === 'CLIENTE' ? 'orange' : 'default'}>{o === 'CLIENTE' ? 'Cliente pediu' : 'Manual'}</Tag> },
          { title: 'Motivo', dataIndex: 'motivo', ellipsis: true },
          { title: 'Data', dataIndex: 'data', width: 130, render: fmtDataHora },
          { title: '', width: 60, render: (_: any, r: any) => (
            <Popconfirm title="Voltar a enviar mensagens para este número?" onConfirm={() => remover(r.chave)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ) },
        ]} />
      <Modal open={modal} title="Descadastrar número" onCancel={() => setModal(false)} onOk={form.submit} okText="Descadastrar">
        <Form form={form} layout="vertical" onFinish={adicionar}>
          <Form.Item name="telefone" label="Celular (DDD + número)" rules={[{ required: true, message: 'Informe o celular' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nome" label="Nome"><Input /></Form.Item>
          <Form.Item name="motivo" label="Motivo"><Input placeholder="Ex.: pediu por telefone" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
