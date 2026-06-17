import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
  Space, Popconfirm, Typography, Row, Col, message, Tag, Switch, Tabs, Divider, Image, Grid } from 'antd';
import ResizableTitle from '../components/ResizableTitle';
import { useColumnWidths } from '../hooks/useColumnWidths';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, PictureOutlined, CopyOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useConfig } from '../context/ConfigContext';
import dayjs from 'dayjs';
import api from '../services/api';
import ImageUpload from '../components/ImageUpload';

const { Title } = Typography;
const { TextArea } = Input;
const CATEGO = ['M', 'F', 'N'].map(v => ({ value: v, label: v === 'M' ? 'Macho' : v === 'F' ? 'Fêmea' : 'Neutro' }));

interface LoteImagem { num: number; url: string; key: string; }

export default function Lotes() {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const { rz: rzLot } = useColumnWidths('lotes', { lotexx: 70, deslot: 300, nomeVendedor: 160 });

  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [leiloes, setLeiloes] = useState<{ value: number; label: string }[]>([]);
  const [leilaoFiltro, setLeilaoFiltro] = useState<number | undefined>();
  const [racas, setRacas] = useState<{ value: number; label: string }[]>([]);
  const [clientes, setClientes] = useState<{ value: number; label: string }[]>([]);
  const [condicoes, setCondicoes] = useState<{ value: number; label: string }[]>([]);
  const [imagens, setImagens] = useState<LoteImagem[]>([]);
  const [form] = Form.useForm();
  const config = useConfig();

  const imgLoteUrl = (id: number) =>
    config.bucket
      ? `https://${config.bucket}.s3.us-east-2.amazonaws.com/lote_1_img_${id}.jpg`
      : '';

  const carregar = async (b = '') => {
    setLoading(true);
    try {
      const r = await api.get('/lotes', { params: { busca: b, idLeilao: leilaoFiltro } });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  const carregarAuxiliares = async () => {
    const [lei, rac, cli, cond] = await Promise.all([
      api.get('/leiloes'), api.get('/racas'), api.get('/clientes'), api.get('/condicoes-pagamento')
    ]);
    setLeiloes(lei.data.map((l: any) => ({ value: l.id, label: l.leilao })));
    setRacas(rac.data.map((r: any) => ({ value: r.id, label: `${r.descricao}${r.especies ? ` (${r.especies})` : ''}` })));
    setClientes(cli.data.map((c: any) => ({ value: c.id, label: c.nomexx })));
    setCondicoes(cond.data.map((c: any) => ({ value: c.id, label: c.desfin })));
  };

  useEffect(() => { carregarAuxiliares(); }, []);
  useEffect(() => { carregar(busca); }, [leilaoFiltro]);

  const abrirModal = async (item?: any) => {
    setImagens([]);
    if (item) {
      const [r, imgs] = await Promise.all([
        api.get(`/lotes/${item.id}`),
        api.get(`/lotes/${item.id}/imagens`),
      ]);
      const d = r.data;
      form.setFieldsValue({ ...d, datnas: d.datnas ? dayjs(d.datnas) : null, publica: d.publica === 'S', vendido: d.vendido === 'S' });
      setEditando(d);
      setImagens(imgs.data);
    } else {
      form.resetFields();
      form.setFieldsValue({ catego: 'M', publica: false, vendido: false });
      setEditando(null);
    }
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    const payload = {
      ...values,
      datnas: values.datnas?.format('YYYY-MM-DD') || null,
      publica: values.publica ? 'S' : 'N',
      vendido: values.vendido ? 'S' : 'N',
    };
    try {
      if (editando) await api.put(`/lotes/${editando.id}`, payload);
      else await api.post('/lotes', payload);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/lotes/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const duplicar = async (id: number) => {
    try {
      const r = await api.post(`/lotes/${id}/duplicar`);
      message.success('Lote duplicado — complete os dados restantes');
      const novoLote = await api.get(`/lotes/${r.data.id}`);
      const imgs = await api.get(`/lotes/${r.data.id}/imagens`);
      const d = novoLote.data;
      form.setFieldsValue({ ...d, datnas: d.datnas ? dayjs(d.datnas) : null, publica: d.publica === 'S', vendido: d.vendido === 'S' });
      setEditando(d);
      setImagens(imgs.data);
      carregar(busca);
      setModalOpen(true);
    } catch { message.error('Erro ao duplicar lote'); }
  };

  const colunas = [
    {
      title: '', dataIndex: 'id', width: 180, key: 'img',
      render: (id: number) => (
        <Image
          src={imgLoteUrl(id)}
          width={164}
          height={100}
          style={{ objectFit: 'cover', borderRadius: 4, display: 'block' }}
          preview={{ mask: false }}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='164' height='100'%3E%3Crect width='164' height='100' fill='%23f0f0f0' rx='4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23bbb' font-size='11'%3ESem foto%3C/text%3E%3C/svg%3E"
        />
      ),
    },
    { title: 'Lote', dataIndex: 'lotexx', ...rzLot('lotexx') },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true, ...rzLot('deslot') },
    { title: 'Vendedor', dataIndex: 'nomeVendedor', ellipsis: true, ...rzLot('nomeVendedor') },
    {
      title: 'Ações', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Duplicar este lote?" onConfirm={() => duplicar(r.id)}>
            <Button size="small" icon={<CopyOutlined />} title="Duplicar lote" />
          </Popconfirm>
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const imgUrl = (num: number) => imagens.find(i => i.num === num)?.url;

  const tabItens = [
    {
      key: 'dados',
      label: 'Dados',
      children: (
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Row gutter={12}>
            <Col xs={12} md={6}><Form.Item name="lotexx" label="Nº Lote" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="catego" label="Categoria"><Select options={CATEGO} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="ordem" label="Ordem"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="datnas" label="Data Nasc."><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
            <Col span={24}><Form.Item name="deslot" label="Descrição"><Input /></Form.Item></Col>
            <Col xs={24} sm={12}>
              <Form.Item name="idleilao" label="Leilão" rules={[{ required: true }]}>
                <Select showSearch options={leiloes} filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="racaxx" label="Raça">
                <Select showSearch options={racas} filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="codven" label="Vendedor">
                <Select showSearch options={clientes} filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="condic" label="Condição de Pagamento">
                <Select showSearch options={condicoes} filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} allowClear />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}><Form.Item name="rpxxx" label="RP"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="sbbxxx" label="SBB"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="tatxxx" label="TAT"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="pesoxx" label="Peso"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="pelage" label="Pelagem"><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="filiacao" label="Filiação"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="vlrins" label="Valor Inscrição"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="lanmax" label="Lance Máximo"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="multiplo" label="Múltiplo"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={6} md={3}><Form.Item name="publica" label="Público" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col xs={6} md={3}><Form.Item name="vendido" label="Vendido" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="urlvideo" label="URL Vídeo"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="obslot" label="Observações"><TextArea rows={2} /></Form.Item></Col>
            <Col span={24}><Form.Item name="comentario" label="Comentário"><TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      ),
    },
    ...(editando ? [{
      key: 'imagens',
      label: <span><PictureOutlined /> Fotos do Animal</span>,
      children: (
        <div>
          <Divider plain style={{ marginTop: 0 }}>Fotos do Lote (até 4 imagens)</Divider>
          <Row gutter={16}>
            {[1, 2, 3, 4].map(num => (
              <Col span={12} key={num} style={{ marginBottom: 16 }}>
                <ImageUpload
                  label={`Foto ${num}`}
                  uploadUrl={`/lotes/${editando.id}/imagens/${num}`}
                  deleteUrl={`/lotes/${editando.id}/imagens/${num}`}
                  initialUrl={imgUrl(num)}
                  accept=".jpg,.jpeg,.png"
                />
              </Col>
            ))}
          </Row>
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f0fff4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(22,163,74,0.35)', flexShrink: 0 }}>
            <AppstoreOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f172a' }}>Lotes</Title>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{dados.length} registro{dados.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()} style={{ background: '#16a34a', borderColor: '#16a34a' }}>Novo Lote</Button>
      </div>

      {/* ── Filtros ── */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={{ flex: '0 0 220px' }}>
          <Select placeholder="Filtrar por leilão" allowClear style={{ width: '100%' }}
            options={leiloes} onChange={v => setLeilaoFiltro(v)}
            showSearch filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
        </Col>
        <Col xs={24} sm={{ flex: 'auto' }}>
          <Input.Search placeholder="Buscar lote..." value={busca} onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca)} enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        components={{ header: { cell: ResizableTitle } }}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros`, simple: isMobile }}
        size="small" scroll={{ x: 'max-content' }} />

      <Modal title={editando ? `Editar Lote ${editando.lotexx}` : 'Novo Lote'}
        open={modalOpen} onOk={form.submit} onCancel={() => setModalOpen(false)}
        width={isMobile ? '95vw' : 860} styles={{ body: { paddingTop: 0 } }}>
        <Tabs items={tabItens} size="small" />
      </Modal>
    </>
  );
}
