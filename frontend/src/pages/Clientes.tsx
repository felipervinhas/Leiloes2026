import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Drawer, Form, Input, Select, DatePicker, Space, Popconfirm,
  Typography, Row, Col, message, Tag, Tabs, Divider, Grid, Checkbox, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, AimOutlined,
  CheckCircleFilled, FileTextOutlined, FileExcelOutlined, CloseOutlined,
  TrophyOutlined, ShoppingCartOutlined, TagOutlined, AuditOutlined, TeamOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import api from '../services/api';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { BotaoBaixarPDF, ClienteCompleto } from '../relatorios/RelatorioClientes';
import { exportarClientesExcel } from '../relatorios/exportarExcel';

const { Title } = Typography;

interface Cliente { id: number; nomexx?: string; cpfxxx?: string; cnpjxx?: string; emailx?: string;
  celu1?: string; ativox?: string; blocli?: string; acessoApp?: string; datcad?: string; }

interface ClienteRanking { id: number; nomexx?: string; cpfxxx?: string; cnpjxx?: string;
  emailx?: string; celu1?: string; ativox?: string;
  qtdCompras: number; vlrCompras: number;
  qtdVendas: number;  vlrVendas: number;
  qtdLances: number;  vlrLances: number; }

const fmt = (v: number) => v > 0 ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';

const STATUS_COLOR: Record<string, string> = { S: 'green', N: 'red' };
const SN = [{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }];
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'].map(v => ({ value: v, label: v }));
const ACESSO = ['1 - Liberado', '2 - Bloqueado', '3 - Pendente', '4 - Reprovado'].map(v => ({ value: v, label: v }));
const FILTROS = [{ value: 'nome', label: 'Nome' }, { value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' }, { value: 'email', label: 'E-mail' }];

export default function Clientes() {
  const config = useConfig();
  const { usuario: usuarioLogado } = useAuth();
  const screens = Grid.useBreakpoint();
  const sm = !!screens.sm;  // ≥ 576px
  const md = !!screens.md;  // ≥ 768px
  
  // Verifica se o usuário logado é ADM com perfil 1
  const podeEditarPermissoes = usuarioLogado?.perfis?.some(p => p.id === 1) && usuarioLogado?.perfis?.some(p => p.perfil?.includes('ADM') || p.perfil?.includes('adm'));

  const [dados, setDados] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroCampo, setFiltroCampo] = useState('nome');
  const [cidades, setCidades] = useState<{ value: number; label: string }[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<Cliente[]>([]);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [clientesCompletos, setClientesCompletos] = useState<ClienteCompleto[]>([]);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [rankingMode, setRankingMode] = useState(false);
  const [dadosRanking, setDadosRanking] = useState<ClienteRanking[]>([]);

  const carregar = async (b = '') => {
    setLoading(true);
    try {
      const r = await api.get('/clientes', { params: { busca: b, filtro: filtroCampo } });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  const carregarRanking = async (b = '') => {
    setLoading(true);
    try {
      const r = await api.get('/clientes/faturamento', { params: { busca: b, filtro: filtroCampo } });
      setDadosRanking(r.data);
    } finally { setLoading(false); }
  };

  const alternarRanking = () => {
    const proximo = !rankingMode;
    setRankingMode(proximo);
    if (proximo) carregarRanking(busca);
    else carregar(busca);
  };

  const carregarCidades = async () => {
    const r = await api.get('/cidades');
    setCidades(r.data.map((c: any) => ({ value: c.id, label: `${c.cidade} - ${c.estado}` })));
  };

  const buscarCep = async () => {
    const cep = (form.getFieldValue('cepxxx') || '').replace(/\D/g, '');
    if (cep.length !== 8) { message.warning('Digite um CEP com 8 dígitos'); return; }
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (data.erro) { message.error('CEP não encontrado'); return; }
      form.setFieldsValue({ endere: data.logradouro || '', comple: data.complemento || '', bairro: data.bairro || '' });
      const label = `${data.localidade} - ${data.uf}`;
      const cidadeEncontrada = cidades.find(c => (c.label as string).toLowerCase() === label.toLowerCase());
      if (cidadeEncontrada) {
        form.setFieldValue('cidade', cidadeEncontrada.value);
      } else {
        message.info(`Cidade "${label}" não encontrada no cadastro — selecione manualmente`);
      }
    } catch {
      message.error('Erro ao consultar ViaCEP');
    } finally {
      setCepLoading(false);
    }
  };

  useEffect(() => { carregar(); carregarCidades(); }, []);

  const abrirDrawer = async (item?: Cliente) => {
    if (item) {
      const r = await api.get(`/clientes/${item.id}`);
      const d = r.data;
      form.setFieldsValue({ 
        ...d, 
        datnas: d.datnas ? dayjs(d.datnas) : null,
        // Converter S/N para true/false para checkboxes
        verComissoes: d.verComissoes === 'S',
        verValoresLiquidos: d.verValoresLiquidos === 'S',
        verInfoFinanceira: d.verInfoFinanceira === 'S',
        verTopCompradores: d.verTopCompradores === 'S',
        verTopVendedores: d.verTopVendedores === 'S',
        verVencimentos: d.verVencimentos === 'S',
      });
      setEditando(d);
    } else {
      form.resetFields();
      form.setFieldsValue({ 
        ativox: 'S', 
        blocli: 'Não', 
        // Defaults para novos usuários: todos com acesso
        verComissoes: true,
        verValoresLiquidos: true,
        verInfoFinanceira: true,
        verTopCompradores: true,
        verTopVendedores: true,
        verVencimentos: true,
      });
      setEditando(null);
    }
    setDrawerOpen(true);
  };

  const salvar = async (values: any) => {
    const payload = { 
      ...values, 
      datnas: values.datnas ? values.datnas.format('YYYY-MM-DD') : null,
      // Converter boolean para S/N para permissões
      verComissoes: values.verComissoes ? 'S' : 'N',
      verValoresLiquidos: values.verValoresLiquidos ? 'S' : 'N',
      verInfoFinanceira: values.verInfoFinanceira ? 'S' : 'N',
      verTopCompradores: values.verTopCompradores ? 'S' : 'N',
      verTopVendedores: values.verTopVendedores ? 'S' : 'N',
      verVencimentos: values.verVencimentos ? 'S' : 'N',
    };
    try {
      if (editando) await api.put(`/clientes/${editando.id}`, payload);
      else await api.post('/clientes', payload);
      message.success('Salvo com sucesso');
      setDrawerOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/clientes/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[], rows: Cliente[]) => { setSelectedRowKeys(keys); setSelectedRows(rows); },
    preserveSelectedRowKeys: true,
  };

  const limparSelecao = () => { setSelectedRowKeys([]); setSelectedRows([]); setClientesCompletos([]); };

  const gerarRelatorio = async () => {
    setCarregandoRelatorio(true);
    try {
      const resultados = await Promise.all(selectedRows.map(r => api.get(`/clientes/${r.id}`)));
      setClientesCompletos(resultados.map(r => r.data as ClienteCompleto));
      setRelatorioOpen(true);
    } catch {
      message.error('Erro ao carregar dados dos clientes');
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  // ---- Colunas da tabela principal (responsivas) ----
  const colunas = [
    ...(md ? [{ title: 'ID', dataIndex: 'id', width: 70 }] : []),
    {
      title: 'Nome', dataIndex: 'nomexx', ellipsis: true,
      render: (nome: string, r: Cliente) => !sm ? (
        <div>
          <div style={{ fontWeight: 500 }}>{nome}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {[r.cpfxxx || r.cnpjxx, r.celu1].filter(Boolean).join(' · ')}
          </div>
        </div>
      ) : nome,
    },
    ...(sm ? [{ title: 'CPF/CNPJ', width: 150, render: (_: any, r: Cliente) => r.cpfxxx || r.cnpjxx }] : []),
    ...(md ? [{ title: 'E-mail', dataIndex: 'emailx', ellipsis: true }] : []),
    ...(sm ? [{ title: 'Celular', dataIndex: 'celu1', width: 140 }] : []),
    {
      title: 'Ativo', dataIndex: 'ativox', width: 70,
      render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'Ações', width: sm ? 90 : 70,
      render: (_: any, r: Cliente) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); abrirDrawer(r); }} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const MEDALHAS = ['🥇', '🥈', '🥉'];
  const colunasRanking = [
    {
      title: '#', width: 44,
      render: (_: any, __: ClienteRanking, i: number) =>
        i < 3
          ? <span style={{ fontSize: 16 }}>{MEDALHAS[i]}</span>
          : <span style={{ color: '#999', paddingLeft: 4 }}>{i + 1}º</span>,
    },
    {
      title: 'Nome', dataIndex: 'nomexx', ellipsis: true,
      render: (nome: string, r: ClienteRanking) => !sm ? (
        <div>
          <div style={{ fontWeight: 500 }}>{nome}</div>
          <div style={{ fontSize: 11, color: '#1677ff' }}>{fmt(r.vlrCompras)}</div>
        </div>
      ) : nome,
    },
    ...(sm ? [{ title: 'CPF/CNPJ', width: 140, render: (_: any, r: ClienteRanking) => r.cpfxxx || r.cnpjxx }] : []),
    {
      title: <Tooltip title="Total comprado (R$)"><Space size={4}><ShoppingCartOutlined style={{ color: '#1677ff' }} />{sm ? 'Compras' : ''}</Space></Tooltip>,
      sorter: (a: ClienteRanking, b: ClienteRanking) => a.vlrCompras - b.vlrCompras,
      defaultSortOrder: 'descend' as const,
      width: sm ? 140 : 90,
      render: (_: any, r: ClienteRanking) => r.qtdCompras > 0 ? (
        <div>
          <div style={{ fontWeight: 600, color: '#1677ff' }}>{fmt(r.vlrCompras)}</div>
          {sm && <div style={{ fontSize: 11, color: '#888' }}>{r.qtdCompras} lote{r.qtdCompras !== 1 ? 's' : ''}</div>}
        </div>
      ) : <span style={{ color: '#ccc' }}>—</span>,
    },
    ...(md ? [{
      title: <Tooltip title="Total vendido (R$)"><Space size={4}><TagOutlined style={{ color: '#52c41a' }} />Vendas</Space></Tooltip>,
      sorter: (a: ClienteRanking, b: ClienteRanking) => a.vlrVendas - b.vlrVendas,
      width: 140,
      render: (_: any, r: ClienteRanking) => r.qtdVendas > 0 ? (
        <div>
          <div style={{ fontWeight: 600, color: '#52c41a' }}>{fmt(r.vlrVendas)}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{r.qtdVendas} lote{r.qtdVendas !== 1 ? 's' : ''}</div>
        </div>
      ) : <span style={{ color: '#ccc' }}>—</span>,
    }] : []),
    {
      title: <Tooltip title="Lances"><Space size={4}><AuditOutlined style={{ color: '#722ed1' }} />{sm ? 'Lances' : ''}</Space></Tooltip>,
      sorter: (a: ClienteRanking, b: ClienteRanking) => a.qtdLances - b.qtdLances,
      width: sm ? 120 : 70,
      render: (_: any, r: ClienteRanking) => r.qtdLances > 0 ? (
        <div>
          <div style={{ fontWeight: 600, color: '#722ed1' }}>{r.qtdLances}</div>
          {sm && <div style={{ fontSize: 11, color: '#888' }}>{fmt(r.vlrLances)}</div>}
        </div>
      ) : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Ações', width: 70,
      render: (_: any, r: ClienteRanking) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirDrawer(r as any)} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const colunasRelatorio = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Nome', dataIndex: 'nomexx', ellipsis: true },
    { title: 'CPF/CNPJ', width: 160, render: (_: any, r: Cliente) => r.cpfxxx || r.cnpjxx },
    { title: 'E-mail', dataIndex: 'emailx', ellipsis: true },
    { title: 'Celular', dataIndex: 'celu1', width: 140 },
    { title: 'Ativo', dataIndex: 'ativox', width: 70, render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag> },
  ];

  // ---- Tabs do formulário (grid responsiva) ----
  const tabPessoal = (
    <Row gutter={[12, 0]}>
      <Col xs={24} md={12}><Form.Item name="nomexx" label="Nome" rules={[{ required: true }]}><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="cpfxxx" label="CPF"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="cnpjxx" label="CNPJ"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="rgxxxx" label="RG"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="orgem" label="Órgão Emissor"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="emissa" label="Data Emissão RG"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="datnas" label="Data Nasc."><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="estciv" label="Estado Civil"><Select options={ESTADO_CIVIL} allowClear /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="paixxx" label="Pai"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="maexxx" label="Mãe"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="emailx" label="E-mail"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="email2" label="E-mail 2"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="profiss" label="Profissão"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="empres" label="Empresa"><Input /></Form.Item></Col>
      <Col xs={24} md={12}><Form.Item name="rendax" label="Renda"><Input /></Form.Item></Col>
    </Row>
  );

  const tabEndereco = (
    <Row gutter={[12, 0]}>
      <Col xs={24} sm={8} md={6}>
        <Form.Item name="cepxxx" label="CEP">
          <Input.Search placeholder="00000-000" maxLength={9} enterButton={<AimOutlined />} loading={cepLoading} onSearch={buscarCep} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={16} md={12}><Form.Item name="endere" label="Endereço"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={6}><Form.Item name="comple" label="Complemento"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={8}><Form.Item name="bairro" label="Bairro"><Input /></Form.Item></Col>
      <Col xs={24} md={16}>
        <Form.Item name="cidade" label="Cidade">
          <Select showSearch options={cidades} filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())} />
        </Form.Item>
      </Col>
    </Row>
  );

  const tabContatos = (
    <Row gutter={[12, 0]}>
      <Col xs={24} sm={12} md={8}><Form.Item name="telres" label="Tel. Residencial"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={8}><Form.Item name="telcom" label="Tel. Comercial"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={8}><Form.Item name="celu1" label="Celular 1"><Input /></Form.Item></Col>
      <Col xs={24} sm={12} md={8}><Form.Item name="celu2" label="Celular 2"><Input /></Form.Item></Col>
      <Divider plain>Referências</Divider>
      <Col xs={24} sm={14}><Form.Item name="refer1" label="Referência 1"><Input /></Form.Item></Col>
      <Col xs={24} sm={10}><Form.Item name="telrefere1" label="Telefone"><Input /></Form.Item></Col>
      <Col xs={24} sm={14}><Form.Item name="refer2" label="Referência 2"><Input /></Form.Item></Col>
      <Col xs={24} sm={10}><Form.Item name="telrefere2" label="Telefone"><Input /></Form.Item></Col>
    </Row>
  );

  const tabBancario = (
    <Row gutter={[12, 0]}>
      <Divider plain>Conta 1</Divider>
      <Col xs={24} sm={12} md={8}><Form.Item name="bancox" label="Banco"><Input /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="agenci" label="Agência"><Input /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="contax" label="Conta"><Input /></Form.Item></Col>
      <Col xs={24} sm={8} md={4}><Form.Item name="pix" label="PIX"><Input /></Form.Item></Col>
      <Divider plain>Conta 2</Divider>
      <Col xs={24} sm={12} md={8}><Form.Item name="banco1" label="Banco"><Input /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="agencia1" label="Agência"><Input /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="conta1" label="Conta"><Input /></Form.Item></Col>
      <Col xs={24} sm={8} md={4}><Form.Item name="pix1" label="PIX"><Input /></Form.Item></Col>
      <Divider plain>Conta 3</Divider>
      <Col xs={24} sm={12} md={8}><Form.Item name="banco2" label="Banco"><Input /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="agencia2" label="Agência"><Input /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="conta2" label="Conta"><Input /></Form.Item></Col>
      <Col xs={24} sm={8} md={4}><Form.Item name="pix2" label="PIX"><Input /></Form.Item></Col>
    </Row>
  );

  const tabSistema = (
    <Row gutter={[12, 0]}>
      <Col xs={12} sm={8} md={6}><Form.Item name="ativox" label="Ativo"><Select options={SN} /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="blocli" label="Bloqueado"><Select options={[{ value: 'Não', label: 'Não' }, { value: 'Sim', label: 'Sim' }]} /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="acessoApp" label="Acesso App"><Select options={ACESSO} allowClear /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="limcre" label="Limite de Crédito"><Input /></Form.Item></Col>
      <Col xs={12} sm={8} md={6}><Form.Item name="classificacao" label="Classificação"><Input type="number" /></Form.Item></Col>
      <Col xs={24} md={12}><Form.Item name="senhax" label={editando ? 'Senha (deixe em branco para manter)' : 'Senha'}><Input.Password /></Form.Item></Col>
      <Col xs={24}><Form.Item name="obsxxx" label="Observações"><Input.TextArea rows={3} /></Form.Item></Col>
    </Row>
  );

  const tabPermissoes = (
    <Card style={{ background: '#fafafa', borderRadius: 8 }}>
      {!podeEditarPermissoes && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16, padding: '12px', background: '#fff7e6', borderRadius: 6 }}>
          <Col xs={24}>
            <Typography.Text type="warning">Apenas ADMs com perfil 1 podem editar permissões</Typography.Text>
          </Col>
        </Row>
      )}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 12, fontSize: 12, color: '#8c8c8c' }}>
            Permissões de Visualização no Dashboard (Para ADMs)
          </Typography.Text>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="verComissoes" valuePropName="checked" noStyle>
            <Checkbox disabled={!podeEditarPermissoes}>Ver Comissões</Checkbox>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="verValoresLiquidos" valuePropName="checked" noStyle>
            <Checkbox disabled={!podeEditarPermissoes}>Ver Valores Líquidos</Checkbox>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="verInfoFinanceira" valuePropName="checked" noStyle>
            <Checkbox disabled={!podeEditarPermissoes}>Ver Informações Financeiras</Checkbox>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="verTopCompradores" valuePropName="checked" noStyle>
            <Checkbox disabled={!podeEditarPermissoes}>Ver Top Compradores</Checkbox>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="verTopVendedores" valuePropName="checked" noStyle>
            <Checkbox disabled={!podeEditarPermissoes}>Ver Top Vendedores</Checkbox>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="verVencimentos" valuePropName="checked" noStyle>
            <Checkbox disabled={!podeEditarPermissoes}>Ver Vencimentos</Checkbox>
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );

  const tabDocumentos = editando ? (() => {
    const base = `https://${config.bucket}.s3.us-east-2.amazonaws.com`;
    const docs = [
      { key: 'documento',  label: 'Documento de Identidade' },
      { key: 'residencia', label: 'Comprovante de Residência' },
      { key: 'renda',      label: 'Comprovante de Renda' },
      { key: 'analise',    label: 'Análise' },
    ];
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {docs.map(d => (
          <Card key={d.key} size="small" title={d.label} style={{ borderRadius: 8 }}>
            <Space>
              <Button icon={<FileTextOutlined />}
                onClick={() => window.open(`${base}/${d.key}_user_${editando.id}.jpg`, '_blank')}>
                Abrir JPG
              </Button>
              <Button icon={<AuditOutlined />}
                onClick={() => window.open(`${base}/${d.key}_user_${editando.id}.pdf`, '_blank')}>
                Abrir PDF
              </Button>
            </Space>
          </Card>
        ))}
      </Space>
    );
  })() : <Typography.Text type="secondary">Disponível apenas ao editar um cliente existente.</Typography.Text>;

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #ecfeff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(8,145,178,0.35)', flexShrink: 0 }}>
            <TeamOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#0f172a' }}>Clientes</Title>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {(rankingMode ? dadosRanking : dados).length} registro{(rankingMode ? dadosRanking : dados).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <Space size={8} wrap>
          <Button
            icon={<TrophyOutlined />}
            type={rankingMode ? 'primary' : 'default'}
            onClick={alternarRanking}
            style={rankingMode ? { background: '#0891b2', borderColor: '#0891b2' } : {}}
          >
            {sm ? 'Ranking' : ''}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirDrawer()}>
            {sm ? 'Novo Cliente' : 'Novo'}
          </Button>
        </Space>
      </div>

      {/* ── Busca ── */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm="auto" style={{ minWidth: 130 }}>
          <Select value={filtroCampo} onChange={setFiltroCampo} options={FILTROS} style={{ width: '100%' }} />
        </Col>
        <Col xs={24} sm={undefined} flex="auto">
          <Input.Search
            placeholder="Buscar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onSearch={b => rankingMode ? carregarRanking(b) : carregar(b)}
            enterButton={<SearchOutlined />}
            allowClear
            onClear={() => rankingMode ? carregarRanking('') : carregar('')}
          />
        </Col>
      </Row>

      <div style={{ paddingBottom: selectedRowKeys.length > 0 ? 72 : 0 }}>
        <Table
          rowKey="id"
          columns={(rankingMode ? colunasRanking : colunas) as any}
          dataSource={rankingMode ? dadosRanking : dados}
          loading={loading}
          rowSelection={rankingMode ? undefined : rowSelection}
          onRow={rankingMode
            ? (_, i) => ({ style: i === 0 ? { background: '#fffbe6' } : i === 1 ? { background: '#fafafa' } : i === 2 ? { background: '#fff7e6' } : {} })
            : (r) => ({ onDoubleClick: () => abrirDrawer(r as Cliente) })
          }
          pagination={{ pageSize: 20, showTotal: t => `${t} registros`, simple: !sm }}
          size="small"
          scroll={{ x: rankingMode ? (md ? 1000 : 600) : (md ? 900 : 400) }}
        />
      </div>

      {/* Barra flutuante de seleção */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#001529', color: 'white',
          padding: sm ? '10px 24px' : '10px 12px',
          display: 'flex',
          flexDirection: sm ? 'row' : 'column',
          alignItems: sm ? 'center' : 'stretch',
          gap: 8,
          justifyContent: 'space-between',
          zIndex: 1000, boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
        }}>
          <Space size={8}>
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
            <span style={{ fontSize: sm ? 15 : 13 }}>
              <strong>{selectedRowKeys.length}</strong> cliente{selectedRowKeys.length !== 1 ? 's' : ''} selecionado{selectedRowKeys.length !== 1 ? 's' : ''}
            </span>
          </Space>
          <Space size={8}>
            <Button
              icon={<CloseOutlined />}
              onClick={limparSelecao}
              size={sm ? 'middle' : 'small'}
              style={{ borderColor: '#aaa', color: '#fff', background: 'transparent' }}
            >
              Limpar
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={gerarRelatorio}
              loading={carregandoRelatorio}
              size={sm ? 'middle' : 'small'}
            >
              {sm ? 'Gerar Relatório' : 'Relatório'}
            </Button>
          </Space>
        </div>
      )}

      {/* Modal de relatório */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            {`Relatório — ${clientesCompletos.length} cliente${clientesCompletos.length !== 1 ? 's' : ''}`}
          </Space>
        }
        open={relatorioOpen}
        onCancel={() => setRelatorioOpen(false)}
        width={sm ? 900 : '100%'}
        style={!sm ? { top: 0, margin: 0, padding: 0, maxWidth: '100vw' } : undefined}
        footer={[
          <Button key="fechar" onClick={() => setRelatorioOpen(false)}>Fechar</Button>,
          <Button key="excel" icon={<FileExcelOutlined />} style={{ color: '#237804', borderColor: '#237804' }}
            onClick={() => exportarClientesExcel(clientesCompletos)}>
            Excel
          </Button>,
          <BotaoBaixarPDF key="pdf" clientes={clientesCompletos} empresa={config.empresa} />,
        ]}
      >
        <Table
          rowKey="id"
          dataSource={clientesCompletos}
          columns={colunasRelatorio}
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={6} align="right">
                <strong>Total: {clientesCompletos.length} cliente{clientesCompletos.length !== 1 ? 's' : ''}</strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Modal>

      {/* Drawer de cadastro */}
      <Drawer
        title={editando ? `Editar — ${editando.nomexx}` : 'Novo Cliente'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ wrapper: { width: 'min(860px, 100vw)' } }}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button type="primary" onClick={() => form.submit()}>Salvar</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Tabs
            size="small"
            items={[
              { key: '1', label: 'Pessoal', children: tabPessoal },
              { key: '2', label: 'Endereço', children: tabEndereco },
              { key: '3', label: 'Contatos', children: tabContatos },
              { key: '4', label: 'Bancário', children: tabBancario },
              { key: '5', label: 'Sistema', children: tabSistema },
              { key: '6', label: 'Documentos', children: tabDocumentos },
              ...(podeEditarPermissoes ? [{ key: '7', label: 'Permissões', children: tabPermissoes }] : []),
            ]}
          />
        </Form>
      </Drawer>
    </>
  );
}
