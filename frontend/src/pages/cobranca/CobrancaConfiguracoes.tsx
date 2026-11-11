import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Typography, Space, Button, InputNumber, Input, Table, Modal, Form, Switch, Radio, Popconfirm, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { DESTINOS, nomeDestino, SeletorCliente } from './comum';

const { Title, Text } = Typography;

export default function CobrancaConfiguracoes() {
  const status = useOutletContext<{ taxaPadrao: number }>();
  const [taxa, setTaxa] = useState<number | null>(status.taxaPadrao);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editar, setEditar] = useState<any | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setVendedores((await api.get('/cobranca/vendedores')).data); }
    catch { message.error('Erro ao carregar os vendedores'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvarTaxa = async () => {
    try { await api.put('/cobranca/config/taxa', { taxa }); status.taxaPadrao = Number(taxa); message.success('Taxa padrão salva'); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao salvar'); }
  };
  const excluir = async (id: number) => {
    try { await api.delete(`/cobranca/vendedores/${id}`); carregar(); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro'); }
  };

  return (
    <>
      <Title level={4}>Configurações</Title>
      <Card size="small" title="Taxa padrão da empresa" style={{ marginBottom: 16 }}>
        <Space>
          <InputNumber min={0} max={100} precision={2} decimalSeparator="," suffix="%" value={taxa} onChange={v => setTaxa(v)} style={{ width: 140 }} />
          <Button type="primary" onClick={salvarTaxa} disabled={taxa == null}>Salvar</Button>
        </Space>
        <div><Text type="secondary">Vale para os lotes sem taxa própria e de vendedores sem taxa própria. Taxa de cada parcela recebida.</Text></div>
      </Card>
      <Card size="small" title="Vendedores" extra={<Button icon={<PlusOutlined />} onClick={() => setEditar({})}>Adicionar vendedor</Button>}>
        <Text type="secondary">Taxa e destino próprios do vendedor e, com "lotes novos já entram", os lotes cadastrados para ele já vêm marcados na cobrança.</Text>
        <Table size="small" rowKey="idCliente" loading={carregando} dataSource={vendedores} pagination={false} style={{ marginTop: 8 }}
          locale={{ emptyText: 'Nenhum vendedor configurado — os lotes usam a taxa padrão' }}
          columns={[
            { title: 'Vendedor', dataIndex: 'nome' },
            { title: 'Lotes novos já entram', dataIndex: 'padrao', width: 170, render: (v: boolean) => (v ? <Tag color="green">Sim</Tag> : <Tag>Não</Tag>) },
            { title: 'Dinheiro vai para', dataIndex: 'destino', width: 170, render: nomeDestino },
            { title: 'Taxa', dataIndex: 'taxa', width: 110, render: (v: number | null) => (v != null ? `${v}%` : <Text type="secondary">padrão ({status.taxaPadrao}%)</Text>) },
            { title: 'Lotes em cobrança', dataIndex: 'lotes', width: 140, align: 'right' as const },
            { title: 'Painel do cliente', dataIndex: 'portal', width: 150, render: (v: boolean, x: any) => (v ? <Tag color="green">Liberado</Tag>
              : <Tag>{x.temSenha ? 'Bloqueado' : 'Sem senha'}</Tag>) },
            { title: '', width: 90, render: (_: any, v: any) => (
              <Space size={2}>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditar(v)} />
                <Popconfirm title="Remover a configuração deste vendedor?" description="Os lotes já marcados continuam na cobrança. O acesso ao painel do cliente é bloqueado." onConfirm={() => excluir(v.idCliente)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ) },
          ]} />
      </Card>
      {editar && <ModalVendedor v={editar} taxaPadrao={status.taxaPadrao} onClose={ok => { setEditar(null); if (ok) carregar(); }} />}
    </>
  );
}

function ModalVendedor({ v, taxaPadrao, onClose }: { v: any; taxaPadrao: number; onClose: (ok: boolean) => void }) {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const [cliente, setCliente] = useState<{ id?: number; nome?: string }>({ id: v.idCliente, nome: v.nome });
  const salvar = async () => {
    const x = await form.validateFields();
    if (!cliente.id) return message.warning('Escolha o vendedor');
    setSalvando(true);
    try {
      await api.put(`/cobranca/vendedores/${cliente.id}`, { padrao: x.padrao, destino: x.destino, taxa: x.taxaPropria ? x.taxa : null });
      if (x.portal !== !!v.portal || x.senha) await api.put(`/cobranca/vendedores/${cliente.id}/acesso`, { liberado: !!x.portal, senha: x.senha || undefined });
      onClose(true);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  };
  return (
    <Modal open title={v.idCliente ? `Vendedor — ${v.nome}` : 'Adicionar vendedor'} onCancel={() => onClose(false)} onOk={salvar} confirmLoading={salvando} destroyOnHidden>
      {!v.idCliente && <div style={{ marginBottom: 12 }}><SeletorCliente placeholder="Vendedor" value={cliente.id} rotulo={cliente.nome} style={{ width: '100%' }}
        onChange={(id, nome) => setCliente({ id, nome })} /></div>}
      <Form form={form} layout="vertical" preserve={false} initialValues={{
        padrao: v.padrao ?? true, destino: v.destino || 'VENDEDOR', taxaPropria: v.taxa != null, taxa: v.taxa ?? taxaPadrao, portal: !!v.portal,
      }}>
        <Form.Item name="padrao" label="Lotes novos deste vendedor já entram na cobrança" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="destino" label="Para onde vai o dinheiro (padrão dos lotes dele)"><Radio.Group options={DESTINOS} /></Form.Item>
        <Form.Item name="taxaPropria" label="Taxa própria" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.taxaPropria !== b.taxaPropria}>
          {({ getFieldValue }) => getFieldValue('taxaPropria') && (
            <Form.Item name="taxa" label="Taxa (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} precision={2} decimalSeparator="," suffix="%" style={{ width: 140 }} />
            </Form.Item>
          )}
        </Form.Item>
        <Form.Item name="portal" label="Acesso ao painel do cliente" valuePropName="checked"
          extra={`O cliente entra em ${window.location.origin}/${window.location.pathname.split('/')[1]}/cliente/login com CPF/CNPJ ou e-mail e vê todos os recebimentos e pagamentos dele.`}>
          <Switch />
        </Form.Item>
        <Form.Item name="senha" label={v.temSenha ? 'Trocar a senha (opcional)' : 'Senha do cliente'}
          extra="É a mesma senha do aplicativo e do site da leiloeira: trocar aqui troca lá também. Mínimo de 6 caracteres."
          rules={[{ min: 6, message: 'Mínimo de 6 caracteres' }]}>
          <Input.Password autoComplete="new-password" placeholder={v.temSenha ? 'Deixe em branco para manter' : 'Obrigatória para liberar o painel'} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
