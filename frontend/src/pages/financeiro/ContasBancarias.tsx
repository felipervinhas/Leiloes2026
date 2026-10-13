import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Switch, Tag, Typography, message, Space, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text } = Typography;

/** Nomes dos bancos mais comuns pelo código que vem no OFX (BANKID). */
export const NOME_BANCO: Record<string, string> = {
  '001': 'Banco do Brasil', '1': 'Banco do Brasil', '033': 'Santander', '33': 'Santander',
  '104': 'Caixa', '237': 'Bradesco', '341': 'Itaú', '748': 'Sicredi', '756': 'Sicoob',
  '077': 'Inter', '77': 'Inter', '260': 'Nubank', '336': 'C6 Bank', '208': 'BTG Pactual', '041': 'Banrisul', '41': 'Banrisul',
};
export const nomeBanco = (codigo?: string | null) => (codigo ? NOME_BANCO[codigo] || `Banco ${codigo}` : '—');

export interface ContaForm {
  id?: number;
  banco: string;
  agencia?: string;
  conta?: string;
  acctid: string;
  cnpjTitular?: string;
  descricao?: string;
  ativa?: boolean;
}

/** Modal de cadastro/edição — também usado pela importação quando chega extrato de conta nova. */
export function ModalConta({ aberto, inicial, onFechar, onSalvo }: {
  aberto: boolean; inicial?: Partial<ContaForm> | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [form] = Form.useForm<ContaForm>();
  const [salvando, setSalvando] = useState(false);

  const salvar = async (v: ContaForm) => {
    setSalvando(true);
    try {
      if (inicial?.id) await api.put(`/conciliacao/contas/${inicial.id}`, v);
      else await api.post('/conciliacao/contas', v);
      message.success('Conta salva');
      onSalvo();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Erro ao salvar a conta');
    } finally { setSalvando(false); }
  };

  return (
    <Modal open={aberto} title={inicial?.id ? 'Editar conta' : 'Nova conta bancária'} onCancel={onFechar}
      onOk={() => form.submit()} confirmLoading={salvando} okText="Salvar" destroyOnHidden>
      {/* initialValues + destroyOnHidden: o formulário só existe com o modal aberto, então
          preencher por efeito chegava antes dele montar e os campos vinham vazios */}
      <Form form={form} layout="vertical" onFinish={salvar} preserve={false} initialValues={{ ativa: true, ...(inicial || {}) }}>
        <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Dê um nome à conta' }]}>
          <Input placeholder="Ex.: Sicredi — conta principal" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="banco" label="Código do banco" rules={[{ required: true, message: 'Informe' }]}>
              <Input placeholder="748" />
            </Form.Item>
          </Col>
          <Col span={8}><Form.Item name="agencia" label="Agência"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="conta" label="Conta"><Input /></Form.Item></Col>
        </Row>
        <Form.Item name="acctid" label="Número da conta no extrato (ACCTID)"
          tooltip="Como a conta aparece dentro do arquivo OFX. Ao importar um extrato de conta nova, este campo vem preenchido."
          rules={[{ required: true, message: 'Informe o número como vem no extrato' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="cnpjTitular" label="CNPJ do titular"><Input /></Form.Item>
        <Form.Item name="ativa" label="Ativa" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  );
}

export default function ContasBancarias() {
  const [contas, setContas] = useState<ContaForm[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<Partial<ContaForm> | null>(null);
  const [aberto, setAberto] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try { setContas((await api.get('/conciliacao/contas')).data); }
    catch { message.error('Erro ao carregar as contas'); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Contas bancárias</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditando(null); setAberto(true); }}>Nova conta</Button>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Contas que recebem de compradores. O extrato só é importado em uma conta cadastrada aqui.
      </Text>
      <Table rowKey="id" loading={carregando} dataSource={contas} size="small" pagination={false}
        columns={[
          { title: 'Descrição', dataIndex: 'descricao' },
          { title: 'Banco', dataIndex: 'banco', render: (v: string) => `${nomeBanco(v)} (${v})` },
          { title: 'Agência', dataIndex: 'agencia', render: (v: string) => v || '—' },
          { title: 'Conta', dataIndex: 'conta', render: (v: string) => v || '—' },
          { title: 'No extrato', dataIndex: 'acctid' },
          { title: 'Situação', dataIndex: 'ativa', render: (v: boolean) => v ? <Tag color="green">Ativa</Tag> : <Tag>Inativa</Tag> },
          { title: '', width: 60, render: (_: any, r: ContaForm) =>
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditando(r); setAberto(true); }} /> },
        ]} />
      <ModalConta aberto={aberto} inicial={editando} onFechar={() => setAberto(false)}
        onSalvo={() => { setAberto(false); carregar(); }} />
    </>
  );
}
