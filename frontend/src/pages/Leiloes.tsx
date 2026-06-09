import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
  Space, Popconfirm, Typography, Row, Col, message, Tag, Tabs, Divider, Image, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, PictureOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import ImageUpload from '../components/ImageUpload';
import { useConfig } from '../context/ConfigContext';

const { Title } = Typography;
const { TextArea } = Input;

interface Imagens { desktop: string; mobile: string; media: string; }

export default function Leiloes() {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [cidades, setCidades] = useState<{ value: string; label: string }[]>([]);
  const [condicoes, setCondicoes] = useState<{ value: number; label: string }[]>([]);
  const [imagens, setImagens] = useState<Imagens | null>(null);
  const [form] = Form.useForm();
  const config = useConfig();

  const imgUrl = (id: number) =>
    config.bucket
      ? `https://${config.bucket}.s3.us-east-2.amazonaws.com/desktop_leilao_img_${id}.png`
      : '';

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/leiloes', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  const carregarAuxiliares = async () => {
    const [cid, cond] = await Promise.all([api.get('/cidades'), api.get('/condicoes-pagamento')]);
    setCidades(cid.data.map((c: any) => ({ value: String(c.id), label: `${c.cidade} - ${c.estado}` })));
    setCondicoes(cond.data.map((c: any) => ({ value: c.id, label: c.desfin })));
  };

  useEffect(() => { carregar(); carregarAuxiliares(); }, []);

  const abrirModal = async (item?: any) => {
    setImagens(null);
    if (item) {
      const [r, imgs] = await Promise.all([
        api.get(`/leiloes/${item.id}`),
        api.get(`/leiloes/${item.id}/imagens`),
      ]);
      const d = r.data;
      form.setFieldsValue({ ...d, datlei: d.datlei ? dayjs(d.datlei) : null, dataSaldo: d.dataSaldo ? dayjs(d.dataSaldo) : null });
      setEditando(d);
      setImagens(imgs.data);
    } else {
      form.resetFields();
      form.setFieldsValue({ ativox: 'S' });
      setEditando(null);
    }
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    const payload = {
      ...values,
      datlei: values.datlei?.format('YYYY-MM-DD') || null,
      dataSaldo: values.dataSaldo?.format('YYYY-MM-DD') || null,
    };
    try {
      if (editando) await api.put(`/leiloes/${editando.id}`, payload);
      else await api.post('/leiloes', payload);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/leiloes/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    {
      title: '', dataIndex: 'id', width: 180, key: 'img',
      render: (id: number) => (
        <Image
          src={imgUrl(id)}
          width={164}
          height={100}
          style={{ objectFit: 'cover', borderRadius: 4, display: 'block' }}
          preview={{ mask: false }}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='164' height='100'%3E%3Crect width='164' height='100' fill='%23f0f0f0' rx='4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23bbb' font-size='11'%3ESem foto%3C/text%3E%3C/svg%3E"
        />
      ),
    },
    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true },
    { title: 'Data', dataIndex: 'datlei', width: 110, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Ativo', dataIndex: 'ativox', width: 80, render: (v: string) => <Tag color={v === 'S' ? 'green' : 'red'}>{v === 'S' ? 'Sim' : 'Não'}</Tag> },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItens = [
    {
      key: 'dados',
      label: 'Dados',
      children: (
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Row gutter={12}>
            <Col xs={24} md={16}><Form.Item name="leilao" label="Nome do Leilão" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="ativox" label="Ativo"><Select options={[{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }]} /></Form.Item></Col>
            <Col xs={24} sm={12} md={8}><Form.Item name="datlei" label="Data do Leilão"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
            <Col xs={24} sm={12} md={8}><Form.Item name="horaInicio" label="Hora Início"><Input placeholder="HH:MM" /></Form.Item></Col>
            <Col xs={24} sm={12} md={8}><Form.Item name="horaFechamentoPre" label="Hora Fechamento"><Input placeholder="HH:MM" /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="leiloe" label="Leiloeiro"><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="endere" label="Endereço"><Input /></Form.Item></Col>
            <Col xs={24} sm={12}>
              <Form.Item name="codcid" label="Cidade">
                <Select showSearch options={cidades} filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="condic" label="Condição de Pagamento">
                <Select showSearch options={condicoes} filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}><Form.Item name="comven" label="Comissão Vendedor (%)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} sm={12} md={6}><Form.Item name="comcom" label="Comissão Comprador (%)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} sm={12} md={6}><Form.Item name="multiplo" label="Múltiplo"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} sm={12} md={6}><Form.Item name="dataSaldo" label="Data Saldo"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
            <Col xs={24} sm={12} md={8}><Form.Item name="tipoLeilao" label="Tipo de Leilão"><Input /></Form.Item></Col>
            <Col xs={24} sm={12} md={8}><Form.Item name="transmissao" label="Transmissão"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="urlcatalogo" label="URL Catálogo"><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="linktransmissao1" label="Link Transmissão 1"><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="linktransmissao2" label="Link Transmissão 2"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="regulamento" label="Regulamento"><TextArea rows={3} /></Form.Item></Col>
            <Col span={24}><Form.Item name="observacoes" label="Observações"><TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      ),
    },
    ...(editando ? [{
      key: 'imagens',
      label: <span><PictureOutlined /> Imagens</span>,
      children: (
        <div>
          <Divider plain style={{ marginTop: 0 }}>Banners do Leilão</Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <ImageUpload
                label="Desktop (ex: 1200×400px)"
                uploadUrl={`/leiloes/${editando.id}/imagens/desktop`}
                deleteUrl={`/leiloes/${editando.id}/imagens/desktop`}
                initialUrl={imagens?.desktop}
                accept=".png,.jpg,.jpeg"
              />
            </Col>
            <Col xs={24} sm={8}>
              <ImageUpload
                label="Mobile (ex: 600×300px)"
                uploadUrl={`/leiloes/${editando.id}/imagens/mobile`}
                deleteUrl={`/leiloes/${editando.id}/imagens/mobile`}
                initialUrl={imagens?.mobile}
                accept=".png,.jpg,.jpeg"
              />
            </Col>
            <Col xs={24} sm={8}>
              <ImageUpload
                label="Mídia / Thumbnail"
                uploadUrl={`/leiloes/${editando.id}/imagens/media`}
                deleteUrl={`/leiloes/${editando.id}/imagens/media`}
                initialUrl={imagens?.media}
                accept=".jpg,.jpeg"
              />
            </Col>
          </Row>
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <Title level={4}>Leilões</Title>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search placeholder="Buscar leilão..." value={busca} onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca)} enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Novo Leilão</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros`, simple: isMobile }}
        size="small" scroll={{ x: 'max-content' }} />

      <Modal title={editando ? `Editar Leilão — ${editando.leilao}` : 'Novo Leilão'}
        open={modalOpen} onOk={form.submit} onCancel={() => setModalOpen(false)}
        width={isMobile ? '95vw' : 860} styles={{ body: { paddingTop: 0 } }}>
        <Tabs items={tabItens} size="small" />
      </Modal>
    </>
  );
}
