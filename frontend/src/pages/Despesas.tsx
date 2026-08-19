import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Spin, DatePicker,
  Space, Popconfirm, Typography, Row, Col, message, Tag, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, WalletOutlined, PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import { BlobProvider } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import { dataUTC, fmtDataUTC } from '../utils/data';
import api from '../services/api';
import { useConfig } from '../context/ConfigContext';
import RelatorioReciboDespesa from '../relatorios/RelatorioReciboDespesa';
import RelatorioReciboAvulso from '../relatorios/RelatorioReciboAvulso';
import { formatarMoeda, parseMoeda } from '../utils/moeda';
import { lerFiltroPersistido, salvarFiltroPersistido } from '../utils/filtroPersistido';
import { useBuscaLeiloes } from '../hooks/useBuscaLeiloes';
import { useBuscaClientes } from '../hooks/useBuscaClientes';
import { useBanco } from '../context/BancoContext';

const { Title } = Typography;
const { TextArea } = Input;

const TIPO_RECIBO_OPTS = [
  { value: 'R', label: 'Recebimento (a empresa recebe e assina)' },
  { value: 'P', label: 'Pagamento (o cliente recebe e assina)' },
];

const DC_OPTS = [
  { value: 'D', label: 'Despesa' },
  { value: 'C', label: 'Crédito' },
  { value: 'F', label: 'Fechamento (pagamento)' },
];

// D_C legado (dados antigos gravados como E/S): tratamos E como Crédito e S como Despesa.
const DC_INFO: Record<string, { label: string; color: string; sinal: 1 | -1 }> = {
  D: { label: 'Despesa', color: 'volcano', sinal: -1 },
  S: { label: 'Despesa (legado)', color: 'volcano', sinal: -1 },
  C: { label: 'Crédito', color: 'green', sinal: 1 },
  E: { label: 'Crédito (legado)', color: 'green', sinal: 1 },
  F: { label: 'Fechamento', color: 'blue', sinal: -1 },
};
const dcInfo = (v: string) => DC_INFO[v] || { label: v || '—', color: 'default', sinal: 1 as const };

function AbaDespesas() {
  const config = useConfig();
  const { banco } = useBanco();
  const filtroSalvo = lerFiltroPersistido<{ busca: string; leilaoFiltro?: number }>(banco, 'despesas', { busca: '' });
  const [dados, setDados]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);
  const [busca, setBusca]         = useState(filtroSalvo.busca);
  const { opcoes: leiloes, carregando: carregandoLeiloes, buscar: buscarLeiloes, garantirOpcao: garantirOpcaoLeilao } = useBuscaLeiloes();
  const { opcoes: clientes, carregando: carregandoClientes, buscar: buscarClientes, garantirOpcao: garantirOpcaoCliente } = useBuscaClientes();
  const [leilaoFiltro, setLeilaoFiltro] = useState<number | undefined>(filtroSalvo.leilaoFiltro);
  const [recibo, setRecibo]       = useState<any | null>(null);
  const [form] = Form.useForm();

  const carregar = async (b = '', idLeilao?: number) => {
    setLoading(true);
    try {
      salvarFiltroPersistido(banco, 'despesas', { busca: b, leilaoFiltro: idLeilao });
      const r = await api.get('/despesas', { params: { busca: b, idLeilao } });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    carregar(filtroSalvo.busca, filtroSalvo.leilaoFiltro);
    // Se um filtro de leilão foi restaurado da sessão, busca só esse
    // registro pra mostrar o nome no Select (que agora busca por digitação
    // em vez de pré-carregar todos os leilões).
    if (filtroSalvo.leilaoFiltro) {
      api.get(`/leiloes/${filtroSalvo.leilaoFiltro}`).then(r => garantirOpcaoLeilao(r.data.id, r.data.leilao)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirModal = (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item
      ? { ...item }
      : { dc: 'D', valor: 0 });
    if (item) {
      garantirOpcaoLeilao(item.codLei, item.leilao);
      garantirOpcaoCliente(item.codigoCliente, item.cliente);
    }
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) await api.put(`/despesas/${editando.id}`, values);
      else await api.post('/despesas', values);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca, leilaoFiltro);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/despesas/${id}`); message.success('Excluído'); carregar(busca, leilaoFiltro); }
    catch { message.error('Erro ao excluir'); }
  };

  const totalDespesas    = dados.filter(d => dcInfo(d.dc).sinal === -1 && d.dc !== 'F').reduce((a, d) => a + (d.valor || 0), 0);
  const totalCreditos    = dados.filter(d => dcInfo(d.dc).sinal === 1).reduce((a, d) => a + (d.valor || 0), 0);
  const totalFechamentos = dados.filter(d => d.dc === 'F').reduce((a, d) => a + (d.valor || 0), 0);
  const saldo            = totalCreditos - totalDespesas - totalFechamentos;

  const colunas = [
    { title: 'Tipo', dataIndex: 'dc', width: 130,
      render: (v: string) => <Tag color={dcInfo(v).color}>{dcInfo(v).label}</Tag> },
    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true, width: 180 },
    { title: 'Cliente', dataIndex: 'cliente', ellipsis: true },
    { title: 'Observações', dataIndex: 'observacoes', ellipsis: true },
    { title: 'Valor', dataIndex: 'valor', width: 140, align: 'right' as const,
      render: (v: number, r: any) => (
        <span style={{ color: dcInfo(r.dc).sinal === 1 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {dcInfo(r.dc).sinal === -1 ? '- ' : '+ '}R$ {Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { title: 'Inclusão', dataIndex: 'dataInclusao', width: 110,
      render: (v: string) => fmtDataUTC(v) },
    {
      title: 'Ações', width: 130,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => setRecibo(r)} title="Imprimir recibo" />
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
      {dados.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {[
            { label: 'Total Créditos',    value: totalCreditos,    color: '#52c41a' },
            { label: 'Total Despesas',    value: totalDespesas,    color: '#ff4d4f' },
            { label: 'Total Fechamentos', value: totalFechamentos, color: '#1677ff' },
            { label: 'Saldo',             value: saldo,            color: saldo >= 0 ? '#52c41a' : '#ff4d4f' },
          ].map(({ label, value, color }) => (
            <Col span={6} key={label}>
              <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 16px' }}>
                <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>
                  R$ {Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col style={{ width: 240 }}>
          <Select
            placeholder="Digite para buscar o leilão..."
            style={{ width: '100%' }}
            allowClear
            value={leilaoFiltro}
            options={leiloes}
            onChange={v => { setLeilaoFiltro(v); carregar(busca, v); }}
            onSearch={buscarLeiloes}
            showSearch
            filterOption={false}
            loading={carregandoLeiloes}
            notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
          />
        </Col>
        <Col flex="auto">
          <Input.Search
            placeholder="Buscar por observação ou cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca, leilaoFiltro)}
            enterButton={<SearchOutlined />}
            allowClear
            onClear={() => carregar('', leilaoFiltro)}
          />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Nova Despesa</Button>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={dados}
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }}
        scroll={{ x: 900 }}
      />

      <Modal
        title={editando ? 'Editar Lançamento' : 'Novo Lançamento'}
        open={modalOpen}
        onOk={form.submit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dc" label="Tipo" rules={[{ required: true }]}>
                <Select options={DC_OPTS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  decimalSeparator=","
                  formatter={formatarMoeda}
                  parser={v => parseMoeda(v) as any}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="codLei" label="Leilão" rules={[{ required: true, message: 'Selecione o leilão' }]}>
                <Select
                  showSearch
                  allowClear
                  placeholder="Digite para buscar o leilão..."
                  options={leiloes}
                  onSearch={buscarLeiloes}
                  filterOption={false}
                  loading={carregandoLeiloes}
                  notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="codigoCliente" label="Cliente">
                <Select
                  showSearch
                  allowClear
                  placeholder="Digite para buscar o cliente..."
                  options={clientes}
                  onSearch={buscarClientes}
                  filterOption={false}
                  loading={carregandoClientes}
                  notFoundContent={carregandoClientes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="observacoes" label="Observações">
                <TextArea rows={3} placeholder="Descrição do lançamento..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Recibo"
        open={!!recibo}
        onCancel={() => setRecibo(null)}
        footer={null}
        width={400}
      >
        {recibo && (
          <BlobProvider document={<RelatorioReciboDespesa dados={recibo} empresa={config.empresa} logoBase64={config.logoBase64} />}>
            {({ url, loading: gerandoPdf, error }) => (
              <>
                <Button
                  type="primary" icon={<PrinterOutlined />} loading={gerandoPdf} disabled={!url}
                  onClick={() => url && window.open(url, '_blank')} block size="large"
                >
                  {gerandoPdf ? 'Gerando PDF...' : 'Visualizar / Imprimir Recibo'}
                </Button>
                {error ? (
                  <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
                    Erro ao gerar PDF: {String((error as any)?.message || error)}
                  </div>
                ) : null}
              </>
            )}
          </BlobProvider>
        )}
      </Modal>
    </>
  );
}

// Recibo avulso: recibo assinável, separado de Despesas (que é lançamento
// contábil sem assinatura) — chamado #10, aberto porque usar Despesas pra
// isso gerava um recibo com o texto invertido ("pagamos" em vez de
// "recebemos") e nem era o conceito certo (despesa x recebimento).
// Tipo Recebimento/Pagamento (chamado #53) decide quem assina: em
// Recebimento a empresa recebe e assina; em Pagamento o cliente recebe e assina.
function AbaRecibos() {
  const config = useConfig();
  const { banco } = useBanco();
  const filtroSalvo = lerFiltroPersistido<{ busca: string }>(banco, 'despesas-recibos', { busca: '' });
  const [dados, setDados]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);
  const [busca, setBusca]         = useState(filtroSalvo.busca);
  const { opcoes: clientes, carregando: carregandoClientes, buscar: buscarClientes, garantirOpcao: garantirOpcaoCliente } = useBuscaClientes();
  const [recibo, setRecibo]       = useState<any | null>(null);
  const [form] = Form.useForm();
  const tipoSel = Form.useWatch('tipo', form) ?? 'R';

  const carregar = async (b = '') => {
    setLoading(true);
    try {
      salvarFiltroPersistido(banco, 'despesas-recibos', { busca: b });
      const r = await api.get('/recibos', { params: { busca: b } });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(filtroSalvo.busca); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const abrirModal = (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item
      ? { ...item, data: item.data ? dataUTC(item.data) : dayjs() }
      : { valor: 0, data: dayjs(), tipo: 'R' });
    if (item) garantirOpcaoCliente(item.codigoCliente, item.nomeCliente);
    setModalOpen(true);
  };

  const clienteSelecionado = (id: number | undefined) => {
    const c = clientes.find(o => o.value === id);
    if (c) form.setFieldValue('pagador', c.label);
  };

  const salvar = async (values: any) => {
    const payload = { ...values, data: values.data ? values.data.format('YYYY-MM-DD') : undefined };
    try {
      if (editando) await api.put(`/recibos/${editando.id}`, payload);
      else await api.post('/recibos', payload);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/recibos/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'Tipo', dataIndex: 'tipo', width: 110,
      render: (v: string) => v === 'P'
        ? <Tag color="volcano">Pagamento</Tag>
        : <Tag color="green">Recebimento</Tag>,
    },
    { title: 'Pagador', dataIndex: 'pagador', ellipsis: true },
    { title: 'Observações', dataIndex: 'observacoes', ellipsis: true },
    { title: 'Valor', dataIndex: 'valor', width: 140, align: 'right' as const,
      render: (v: number, r: any) => (
        <span style={{ color: r.tipo === 'P' ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
          {r.tipo === 'P' ? '-' : '+'} R$ {Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { title: 'Data', dataIndex: 'data', width: 110,
      render: (v: string) => fmtDataUTC(v) },
    {
      title: 'Ações', width: 130,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => setRecibo(r)} title="Imprimir recibo" />
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
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search
            placeholder="Buscar por pagador ou observação..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca)}
            enterButton={<SearchOutlined />}
            allowClear
            onClear={() => carregar('')}
          />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Novo Recibo</Button>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={dados}
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }}
        scroll={{ x: 700 }}
      />

      <Modal
        title={editando ? 'Editar Recibo' : 'Novo Recibo'}
        open={modalOpen}
        onOk={form.submit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Select options={TIPO_RECIBO_OPTS} />
          </Form.Item>
          <Form.Item name="codigoCliente" label="Cliente cadastrado (opcional)">
            <Select
              showSearch
              allowClear
              placeholder="Digite para buscar o cliente..."
              options={clientes}
              onSearch={buscarClientes}
              onChange={clienteSelecionado}
              filterOption={false}
              loading={carregandoClientes}
              notFoundContent={carregandoClientes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
            />
          </Form.Item>
          <Form.Item
            name="pagador" label={tipoSel === 'P' ? 'Beneficiário' : 'Pagador'}
            rules={[{ required: true, message: tipoSel === 'P' ? 'Informe o beneficiário' : 'Informe o pagador' }]}
            extra="Selecionar um cliente acima preenche este campo, mas dá pra digitar qualquer nome."
          >
            <Input placeholder={tipoSel === 'P' ? 'Nome de quem está recebendo' : 'Nome de quem está pagando'} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  decimalSeparator=","
                  formatter={formatarMoeda}
                  parser={v => parseMoeda(v) as any}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="data" label="Data" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="observacoes" label="Referente a">
            <TextArea rows={3} placeholder="Ex.: Comissão do leilão X..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Recibo"
        open={!!recibo}
        onCancel={() => setRecibo(null)}
        footer={null}
        width={400}
      >
        {recibo && (
          <BlobProvider document={<RelatorioReciboAvulso dados={recibo} empresa={config.empresa} empresaEndereco={config.empresaEndereco} logoBase64={config.logoBase64} />}>
            {({ url, loading: gerandoPdf, error }) => (
              <>
                <Button
                  type="primary" icon={<PrinterOutlined />} loading={gerandoPdf} disabled={!url}
                  onClick={() => url && window.open(url, '_blank')} block size="large"
                >
                  {gerandoPdf ? 'Gerando PDF...' : 'Visualizar / Imprimir Recibo'}
                </Button>
                {error ? (
                  <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
                    Erro ao gerar PDF: {String((error as any)?.message || error)}
                  </div>
                ) : null}
              </>
            )}
          </BlobProvider>
        )}
      </Modal>
    </>
  );
}

export default function Despesas() {
  return (
    <>
      <Title level={4}><WalletOutlined style={{ marginRight: 8 }} />Despesas</Title>
      <Tabs
        items={[
          { key: 'despesas', label: 'Despesas', children: <AbaDespesas /> },
          { key: 'recibos', label: <><FileTextOutlined /> Recibos Avulsos</>, children: <AbaRecibos /> },
        ]}
      />
    </>
  );
}
