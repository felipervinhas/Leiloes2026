import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, Col, DatePicker, Divider, Form, Grid, Input,
  InputNumber, message, Modal, Popconfirm, Row, Select, Space, Spin,
  Steps, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined,
  DeleteOutlined, DollarOutlined, EditOutlined, FileSearchOutlined,
  FileDoneOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UserOutlined,
  PrinterOutlined, FileTextOutlined, AuditOutlined,
} from '@ant-design/icons';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FaturaCompraPDF, { FaturaData } from '../relatorios/RelatorioFaturaCompra';
import PromissoriaPDF from '../relatorios/RelatorioPromissoria';
import { useConfig } from '../context/ConfigContext';
import ContratoEditor from '../components/ContratoEditor';
import api from '../services/api';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

const fmt = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

const fmtData = (v?: string | Date | null) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—';

// ─────────────────────────────────────────────────────────────────────────────
// LISTAGEM
// ─────────────────────────────────────────────────────────────────────────────

const TIPO_BUSCA = [
  { value: 'todos',     label: 'Todos' },
  { value: 'codigo',    label: 'Código' },
  { value: 'boleto',    label: 'Boleto' },
  { value: 'lote',      label: 'Lote' },
  { value: 'leilao',    label: 'Leilão' },
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor',  label: 'Vendedor' },
];

function Listagem({ onNova, onEditar }: { onNova: () => void; onEditar: (id: number) => void }) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const config = useConfig();
  const [faturaLoading, setFaturaLoading]           = useState<number | null>(null);
  const [faturaData, setFaturaData]                 = useState<FaturaData | null>(null);
  const [faturaModal, setFaturaModal]               = useState(false);
  const [promissoriaLoading, setPromissoriaLoading] = useState<number | null>(null);
  const [promissoriaData, setPromissoriaData]       = useState<FaturaData | null>(null);
  const [promissoriaModal, setPromissoriaModal]     = useState(false);

  // Contrato
  const [contratoModal, setContratoModal]           = useState(false);
  const [contratoVenda, setContratoVenda]           = useState<any | null>(null);
  const [contratoTemplates, setContratoTemplates]   = useState<any[]>([]);
  const [contratoIdTemplate, setContratoIdTemplate] = useState<number | undefined>();
  const [contratoHtml, setContratoHtml]             = useState('');
  const [contratoStep, setContratoStep]             = useState<'select' | 'edit'>('select');
  const [contratoLoading, setContratoLoading]       = useState(false);

  const abrirFatura = async (id: number) => {
    setFaturaLoading(id);
    try {
      const r = await api.get(`/vendas/${id}/fatura`);
      setFaturaData(r.data);
      setFaturaModal(true);
    } catch { message.error('Erro ao carregar fatura'); }
    finally { setFaturaLoading(null); }
  };

  const abrirPromissoria = async (id: number) => {
    setPromissoriaLoading(id);
    try {
      const r = await api.get(`/vendas/${id}/fatura`);
      setPromissoriaData(r.data);
      setPromissoriaModal(true);
    } catch { message.error('Erro ao carregar promissórias'); }
    finally { setPromissoriaLoading(null); }
  };

  const abrirContrato = async (row: any) => {
    setContratoVenda(row);
    setContratoIdTemplate(undefined);
    setContratoHtml('');
    setContratoStep('select');
    const r = await api.get('/contratos/templates');
    setContratoTemplates(r.data);
    setContratoModal(true);
  };

  const gerarContrato = async () => {
    if (!contratoIdTemplate || !contratoVenda) return;
    setContratoLoading(true);
    try {
      const r = await api.get(
        `/contratos/gerar/${contratoVenda.id}/${contratoVenda.idcli}/${contratoIdTemplate}`
      );
      setContratoHtml(r.data.html);
      setContratoStep('edit');
    } catch { message.error('Erro ao gerar contrato'); }
    finally { setContratoLoading(false); }
  };

  const [tipoBusca, setTipoBusca] = useState('todos');
  const [busca, setBusca]         = useState('');
  const [leiloes, setLeiloes]     = useState<any[]>([]);
  const [idLeilao, setIdLeilao]   = useState<number | undefined>();
  const [dados, setDados]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    api.get('/leiloes').then(r =>
      setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao }))));
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const params: any = { tipoBusca };
      if (busca)    params.busca    = busca;
      if (idLeilao) params.idLeilao = idLeilao;
      const r = await api.get('/vendas', { params });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  const excluir = async (id: number) => {
    await api.delete(`/vendas/${id}`);
    message.success('Venda excluída');
    carregar();
  };

  const colunas: any[] = [
    {
      title: 'Cód', dataIndex: 'id', width: 70, fixed: 'left' as const,
      render: (v: number) => <Text strong>#{v}</Text>,
    },
    {
      title: 'Status', dataIndex: 'defesa', width: 100,
      render: (v: string) => v === 'S'
        ? <Tag color="green">Vendido</Tag>
        : <Tag color="orange">Pendente</Tag>,
    },
    { title: 'Boleto', dataIndex: 'codnot', width: 100 },
    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true, width: 200 },
    {
      title: 'Data', dataIndex: 'datlan', width: 110,
      render: fmtData,
    },
    { title: 'Lote', dataIndex: 'lotexx', width: 70 },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true, width: 200 },
    { title: 'Comprador', dataIndex: 'nomexx', ellipsis: true, width: 180 },
    {
      title: 'Qtd', dataIndex: 'qtdxxx', width: 70, align: 'right' as const,
      render: (v: number) => v ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—',
    },
    {
      title: 'Vlr. Parcela', dataIndex: 'vlrpar', width: 120, align: 'right' as const,
      render: fmt,
    },
    {
      title: 'Vlr. Total', dataIndex: 'vlrtot', width: 120, align: 'right' as const,
      render: (v: number) => <Text strong>{fmt(v)}</Text>,
    },
    {
      title: 'Encaminhamento', width: 180,
      render: (_: any, row: any) => (
        <Space size={4}>
          {row.stParcela === 'C'  && <Tag color="blue"   style={{ fontSize: 10 }}>Parcelas</Tag>}
          {row.stComissao === 'C' && <Tag color="purple" style={{ fontSize: 10 }}>Comissão</Tag>}
          {row.stContrato === 'C' && <Tag color="cyan"   style={{ fontSize: 10 }}>Contrato</Tag>}
          {row.stEmbarque === 'C' && <Tag color="green"  style={{ fontSize: 10 }}>Embarque</Tag>}
        </Space>
      ),
    },
    {
      title: '', width: 180, fixed: 'right' as const,
      render: (_: any, row: any) => (
        <Space>
          <Tooltip title="Fatura de Compras">
            <Button
              size="small"
              icon={<FileDoneOutlined />}
              loading={faturaLoading === row.id}
              onClick={() => abrirFatura(row.id)}
            />
          </Tooltip>
          <Tooltip title="Promissórias">
            <Button
              size="small"
              icon={<AuditOutlined />}
              loading={promissoriaLoading === row.id}
              onClick={() => abrirPromissoria(row.id)}
            />
          </Tooltip>
          <Tooltip title="Contrato">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => abrirContrato(row)}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => onEditar(row.id)} />
          </Tooltip>
          <Popconfirm
            title="Excluir esta venda?"
            description="Parcelas e compradores também serão excluídos."
            onConfirm={() => excluir(row.id)}
            okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }}
          >
            <Tooltip title="Excluir">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Modal Fatura de Compras */}
      <Modal
        open={faturaModal}
        onCancel={() => { setFaturaModal(false); setFaturaData(null); }}
        footer={null}
        title={
          <Space>
            <FileDoneOutlined />
            <span>Fatura de Compras {faturaData ? `#${faturaData.id}` : ''}</span>
          </Space>
        }
        width={480}
      >
        {faturaData && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ marginBottom: 16, textAlign: 'left', lineHeight: 1.8 }}>
              <div><strong>Leilão:</strong> {faturaData.leilao || '—'}</div>
              <div><strong>Lote:</strong> {faturaData.lote?.lotexx} — {faturaData.lote?.deslot}</div>
              <div><strong>Comprador(es):</strong> {faturaData.compradores.map(c => c.nomexx).filter(Boolean).join(', ')}</div>
              <div><strong>Vendedor:</strong> {faturaData.lote?.nomeVendedor || '—'}</div>
              <div><strong>Parcelas:</strong> {faturaData.compradores.reduce((t, c) => t + c.parcelas.length, 0)}</div>
            </div>
            <PDFDownloadLink
              document={<FaturaCompraPDF dados={faturaData} empresa={config.empresa} />}
              fileName={`fatura-compra-${faturaData.id}.pdf`}
              style={{ textDecoration: 'none' }}
            >
              {({ loading }) => (
                <Button
                  type="primary"
                  size="large"
                  icon={<PrinterOutlined />}
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Gerando PDF...' : 'Baixar Fatura PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        )}
      </Modal>

      {/* Modal Promissórias */}
      <Modal
        open={promissoriaModal}
        onCancel={() => { setPromissoriaModal(false); setPromissoriaData(null); }}
        footer={null}
        title={
          <Space>
            <AuditOutlined />
            <span>Promissórias {promissoriaData ? `— Boleto ${promissoriaData.codnot || promissoriaData.id}` : ''}</span>
          </Space>
        }
        width={480}
      >
        {promissoriaData && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ marginBottom: 16, textAlign: 'left', lineHeight: 1.8 }}>
              <div><strong>Leilão:</strong> {promissoriaData.leilao || '—'}</div>
              <div><strong>Lote:</strong> {promissoriaData.lote?.lotexx} — {promissoriaData.lote?.deslot}</div>
              <div><strong>Vendedor (Credor):</strong> {promissoriaData.lote?.nomeVendedor || '—'}</div>
              <div>
                <strong>Compradores:</strong>{' '}
                {promissoriaData.compradores.map(c => c.nomexx).filter(Boolean).join(', ')}
              </div>
              <div>
                <strong>Total de promissórias:</strong>{' '}
                {promissoriaData.compradores.reduce((t, c) => t + c.parcelas.length, 0)} parcelas
              </div>
            </div>
            <PDFDownloadLink
              document={<PromissoriaPDF dados={promissoriaData} empresa={config.empresa} />}
              fileName={`promissorias-${promissoriaData.codnot || promissoriaData.id}.pdf`}
              style={{ textDecoration: 'none' }}
            >
              {({ loading }) => (
                <Button
                  type="primary"
                  size="large"
                  icon={<PrinterOutlined />}
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Gerando PDF...' : 'Baixar Promissórias PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        )}
      </Modal>

      {/* Modal Contrato */}
      <Modal
        open={contratoModal}
        onCancel={() => setContratoModal(false)}
        footer={null}
        title={
          <Space>
            <FileTextOutlined />
            <span>
              {contratoStep === 'select' ? 'Gerar Contrato' : `Contrato — ${contratoVenda?.deslot || ''}`}
            </span>
          </Space>
        }
        width={contratoStep === 'edit' ? '90%' : 480}
        style={{ top: contratoStep === 'edit' ? 20 : undefined }}
        destroyOnClose
      >
        {contratoStep === 'select' ? (
          <div style={{ padding: '8px 0' }}>
            {contratoVenda && (
              <div style={{ marginBottom: 16, padding: '10px 12px', background: '#f5f5f5', borderRadius: 6 }}>
                <Text strong>Venda #{contratoVenda.id}</Text>
                <br />
                <Text type="secondary">
                  Lote {contratoVenda.lotexx} — {contratoVenda.deslot}
                </Text>
                <br />
                <Text type="secondary">Comprador: {contratoVenda.nomexx}</Text>
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <Text>Selecione o modelo de contrato:</Text>
            </div>
            {contratoTemplates.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 16 }}>
                Nenhum modelo cadastrado. Vá em{' '}
                <Text strong>Comercial → Contratos</Text> para criar um modelo.
              </div>
            ) : (
              <Select
                style={{ width: '100%', marginBottom: 16 }}
                placeholder="Escolha um modelo..."
                value={contratoIdTemplate}
                onChange={setContratoIdTemplate}
                options={contratoTemplates.map((t: any) => ({
                  value: t.id,
                  label: `${t.nome}${t.tipo ? ` (${t.tipo})` : ''}`,
                }))}
              />
            )}
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setContratoModal(false)}>Cancelar</Button>
                <Button
                  type="primary"
                  loading={contratoLoading}
                  disabled={!contratoIdTemplate}
                  onClick={gerarContrato}
                >
                  Gerar Contrato
                </Button>
              </Space>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12, textAlign: 'right' }}>
              <Button size="small" onClick={() => setContratoStep('select')}>
                ← Trocar modelo
              </Button>
            </div>
            <ContratoEditor
              content={contratoHtml}
              onChange={setContratoHtml}
            />
          </div>
        )}
      </Modal>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #fffbeb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(217,119,6,0.35)', flexShrink: 0 }}>
            <DollarOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>Vendas</Title>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={onNova} style={{ background: '#d97706', borderColor: '#d97706' }}>Nova Venda</Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[8, 8]} align="bottom">
          <Col xs={24} sm={8} md={5}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Tipo de busca</div>
            <Select style={{ width: '100%' }} value={tipoBusca} options={TIPO_BUSCA}
              onChange={v => { setTipoBusca(v); setBusca(''); setIdLeilao(undefined); }} />
          </Col>
          {tipoBusca !== 'todos' && tipoBusca !== 'leilao' && (
            <Col xs={24} sm={12} md={8}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Pesquisa</div>
              <Input placeholder="Digite..." value={busca}
                onChange={e => setBusca(e.target.value)}
                onPressEnter={carregar} />
            </Col>
          )}
          {tipoBusca === 'leilao' && (
            <Col xs={24} sm={14} md={10}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Leilão</div>
              <Select style={{ width: '100%' }} allowClear showSearch value={idLeilao}
                options={leiloes} onChange={setIdLeilao}
                filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
            </Col>
          )}
          <Col xs={12} sm="auto">
            <Button icon={<SearchOutlined />} onClick={carregar} loading={loading} block={isMobile}>Buscar</Button>
          </Col>
          <Col xs={12} sm="auto">
            <Button icon={<ReloadOutlined />} block={isMobile} onClick={() => {
              setTipoBusca('todos'); setBusca(''); setIdLeilao(undefined);
              setTimeout(carregar, 0);
            }}>Limpar</Button>
          </Col>
        </Row>
      </Card>

      <Table
        rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        size="small" scroll={{ x: 1600 }}
        pagination={{ pageSize: 20, showTotal: t => `${t} registros`, showSizeChanger: !isMobile, simple: isMobile }}
        locale={{ emptyText: 'Nenhuma venda encontrada' }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD
// ─────────────────────────────────────────────────────────────────────────────

const FORMAS_PAGAMENTO = ['PROMISSORIA', 'CHEQUE', 'DINHEIRO', 'FINANCIAMENTO', 'PIX'];

function Wizard({ editId, onConcluir, onCancelar }: {
  editId?: number;
  onConcluir: () => void;
  onCancelar: () => void;
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const [step, setStep]     = useState(0);
  const [movId, setMovId]   = useState<number | undefined>(editId);
  const [loteId, setLoteId] = useState<number | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [mov, setMov]   = useState<any>(null);
  const [lote, setLote] = useState<any>(null);
  const [compradores, setCompradores] = useState<any[]>([]);
  const [parcelas, setParcelas]       = useState<any[]>([]);

  // ── step 0 ──────────────────────────────────────────────────────────────
  const [form0]   = Form.useForm();
  const [leiloes, setLeiloes] = useState<any[]>([]);

  // ── step 1 ──────────────────────────────────────────────────────────────
  const [form1]         = Form.useForm();
  const [lotesDisp, setLotesDisp] = useState<any[]>([]);
  const [loteDetalhes, setLoteDetalhes] = useState<any>(null);
  const [ckCalcTotal, setCkCalcTotal]   = useState(false);
  const [leilaoInfo, setLeilaoInfo]     = useState<any>(null);

  // ── step 2 ──────────────────────────────────────────────────────────────
  const [form2]         = Form.useForm();
  const [clientes, setClientes]   = useState<any[]>([]);
  const [loadingCli, setLoadingCli] = useState(false);
  const timerCli = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [condicoes, setCondicoes] = useState<any[]>([]);
  const [condicaoSel, setCondicaoSel] = useState<any>(null);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [modalProps, setModalProps] = useState(false);
  const [compSelecionado, setCompSelecionado] = useState<any>(null);

  // ── step 3 ──────────────────────────────────────────────────────────────
  const [dataBase, setDataBase] = useState<Dayjs | null>(dayjs());
  const [compParc, setCompParc] = useState<number | undefined>();
  const [loadingParc, setLoadingParc] = useState(false);
  const [editingParc, setEditingParc] = useState<{id: number; field: 'datven'|'vlrpar'; value: any}|null>(null);
  const editingValRef = useRef<any>(null);

  // ── inicialização ────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/leiloes').then(r =>
      setLeiloes(r.data.map((l: any) => ({ value: l.id, label: l.leilao }))));
    api.get('/condicoes-pagamento').then(r => setCondicoes(r.data));
  }, []);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const r  = await api.get(`/vendas/${editId}`);
      const mv = r.data;
      setMov(mv);
      form0.setFieldsValue({ idLeilao: mv.idLeilao, codnot: mv.codnot });
      await carregarLotesDisp(mv.idLeilao);

      const rl = await api.get(`/vendas/${editId}/lote`);
      if (rl.data) {
        setLote(rl.data); setLoteDetalhes(rl.data); setLoteId(rl.data.idLote);
        form1.setFieldsValue({
          idLote: rl.data.idLote, qtdxxx: rl.data.qtdxxx,
          vlrpar: rl.data.vlrpar, vlrtot: rl.data.vlrtot, vlrdes: rl.data.vlrdes ?? 0,
        });
      }

      const rc = await api.get(`/vendas/${editId}/compradores`);
      setCompradores(rc.data);

      const rp = await api.get(`/vendas/${editId}/parcelas`);
      setParcelas(rp.data);
    })();
  }, [editId]);

  // ── step 0: salvar mov ───────────────────────────────────────────────────

  const carregarLotesDisp = async (idLeilao: number) => {
    const r = await api.get(`/vendas/lotes-disponiveis/${idLeilao}`);
    setLotesDisp(r.data);
  };

  const onLeilaoChange = async (id: number) => {
    setLoteDetalhes(null); setLoteId(undefined);
    form1.resetFields();
    await carregarLotesDisp(id);
    // guarda info do leilão para calcular comissões
    const r = await api.get(`/leiloes/${id}`);
    setLeilaoInfo(r.data);
    // pré-preenche data base com data do leilão
    if (r.data.datlei) setDataBase(dayjs(r.data.datlei));
  };

  const salvarStep0 = async () => {
    const vals = await form0.validateFields();
    setSalvando(true);
    try {
      if (movId) {
        await api.put(`/vendas/${movId}`, vals);
        setMov({ ...mov, ...vals });
      } else {
        const r = await api.post('/vendas', vals);
        setMovId(r.data.id);
        const rm = await api.get(`/vendas/${r.data.id}`);
        setMov(rm.data);
        setLeilaoInfo(rm.data);
      }
      setStep(1);
    } finally { setSalvando(false); }
  };

  // ── step 1: lote ─────────────────────────────────────────────────────────

  const onLoteChange = (id: number) => {
    const det = lotesDisp.find(l => l.id === id);
    setLoteDetalhes(det ?? null);
    setLoteId(id);

    const qtdpar = Number(leilaoInfo?.qtdpar ?? 1);
    const comcom = leilaoInfo?.comcom ?? 0;
    const comven = leilaoInfo?.comven ?? 0;

    // Se o lote tem lance online (vlrins), usa como valor parcela
    const vlrpar = det?.vlrins ?? 0;
    const vlrtot = vlrpar * qtdpar;
    const comiss = vlrtot * (comcom / 100);
    const comissVend = vlrtot * (comven / 100);

    form1.setFieldsValue({
      idLote: id, qtdxxx: 1, vlrpar, vlrtot, vlrdes: 0,
      _comiss: comiss, _comissVend: comissVend,
    });
  };

  const recalcularValores = () => {
    if (!loteDetalhes) return;
    const vals  = form1.getFieldsValue();
    const qtd   = vals.qtdxxx || 1;
    const qtdpar = Number(leilaoInfo?.qtdpar ?? 1);
    const comcom = leilaoInfo?.comcom ?? 0;
    const comven = leilaoInfo?.comven ?? 0;

    let vlrpar = vals.vlrpar || 0;
    let vlrtot = vals.vlrtot || 0;

    if (ckCalcTotal && vlrtot > 0) {
      vlrpar = vlrtot / (qtdpar * qtd);
    } else if (!ckCalcTotal && vlrpar > 0) {
      vlrtot = vlrpar * qtdpar * qtd;
    }

    const comiss     = vlrtot * (comcom / 100);
    const comissVend = vlrtot * (comven / 100);
    form1.setFieldsValue({ vlrpar, vlrtot, vlrdes: vals.vlrdes || 0, _comiss: comiss, _comissVend: comissVend });
  };

  const salvarStep1 = async () => {
    const vals = await form1.validateFields();
    if (!movId) return;
    setSalvando(true);
    try {
      const comcom = leilaoInfo?.comcom ?? 0;
      const comven = leilaoInfo?.comven ?? 0;
      const comiss     = (vals.vlrtot || 0) * (comcom / 100);
      const comissVend = (vals.vlrtot || 0) * (comven / 100);

      const datlei = mov?.datlei
        ? new Date(mov.datlei).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      await api.post(`/vendas/${movId}/lote`, {
        idLote: vals.idLote,
        qtdxxx: vals.qtdxxx,
        vlrpar: vals.vlrpar,
        vlrtot: vals.vlrtot,
        vlrdes: vals.vlrdes ?? 0,
        qtdpar: leilaoInfo?.qtdpar ?? 1,
        comiss, comissVendedor: comissVend,
        datlan: datlei,
      });
      const rl = await api.get(`/vendas/${movId}/lote`);
      setLote(rl.data);
      setStep(2);
    } finally { setSalvando(false); }
  };

  // ── step 2: compradores ──────────────────────────────────────────────────

  const buscarClientes = (busca: string) => {
    clearTimeout(timerCli.current);
    if (busca.length < 2) { setClientes([]); return; }
    timerCli.current = setTimeout(async () => {
      setLoadingCli(true);
      try {
        const r = await api.get('/clientes', { params: { busca, filtro: 'nome' } });
        setClientes(r.data.map((c: any) => ({ value: c.id, label: c.nomexx })));
      } finally { setLoadingCli(false); }
    }, 350);
  };

  const onCondicaoChange = (id: number) => {
    setCondicaoSel(condicoes.find(c => c.id === id) ?? null);
  };

  const adicionarComprador = async () => {
    const vals = await form2.validateFields();
    if (!movId) return;
    setSalvando(true);
    try {
      await api.post(`/vendas/${movId}/compradores`, {
        idCli:           vals.idCli,
        idCondPagto:     vals.idCondPagto,
        percen:          vals.percen ?? 100,
        formaPagamento:  vals.formaPagamento,
        idPropriedade:   vals.idPropriedade ?? null,
      });
      const rc = await api.get(`/vendas/${movId}/compradores`);
      setCompradores(rc.data);
      form2.resetFields(['idCli', 'percen', 'formaPagamento', 'idPropriedade']);
      setClientes([]);
      message.success('Comprador adicionado');
    } finally { setSalvando(false); }
  };

  const removerComprador = async (idComp: number) => {
    await api.delete(`/vendas/${movId}/compradores/${idComp}`);
    const rc = await api.get(`/vendas/${movId}/compradores`);
    setCompradores(rc.data);
    message.success('Comprador removido');
  };

  const abrirPropriedades = async (comp: any) => {
    setCompSelecionado(comp);
    const r = await api.get(`/clientes/${comp.idCli}/propriedades`);
    setPropriedades(r.data);
    setModalProps(true);
  };

  const salvarPropriedade = async (idProp: number) => {
    await api.post(`/vendas/${movId}/compradores/${compSelecionado.id}/propriedade`, {
      idCli: compSelecionado.idCli, idPropriedade: idProp,
    });
    const rc = await api.get(`/vendas/${movId}/compradores`);
    setCompradores(rc.data);
    setModalProps(false);
    message.success('Propriedade salva');
  };

  // ── step 3: parcelas ─────────────────────────────────────────────────────

  const gerarParcelas = async (idComp: number) => {
    if (!movId || !dataBase) return;
    setLoadingParc(true);
    try {
      await api.post(`/vendas/${movId}/compradores/${idComp}/parcelas`, {
        dataBase: dataBase.format('YYYY-MM-DD'),
      });
      const rp = await api.get(`/vendas/${movId}/parcelas`);
      setParcelas(rp.data);
      message.success('Parcelamento gerado');
    } finally { setLoadingParc(false); }
  };

  const recarregarParcelas = async () => {
    if (!movId) return;
    const rp = await api.get(`/vendas/${movId}/parcelas`);
    setParcelas(rp.data);
  };

  const salvarParcela = async (id: number, field: 'datven'|'vlrpar') => {
    const value = editingValRef.current;
    if (value == null) { setEditingParc(null); return; }
    try {
      const payload: any = {};
      if (field === 'datven') payload.datven = dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : String(value);
      if (field === 'vlrpar') payload.vlrpar = Number(value);
      await api.put(`/vendas/${movId}/parcelas/${id}`, payload);
      setParcelas(prev => prev.map(p => {
        if (p.id !== id) return p;
        if (field === 'datven') return { ...p, datven: payload.datven };
        return { ...p, vlrpar: payload.vlrpar };
      }));
    } finally {
      setEditingParc(null);
      editingValRef.current = null;
    }
  };

  // ── cols parcelas ────────────────────────────────────────────────────────
  const colsParcelas: any[] = [
    { title: '#', dataIndex: 'ordxxx', width: 70, align: 'center' as const },
    {
      title: 'Comprador', dataIndex: 'nomexx', ellipsis: true, width: 180,
      render: (v: string, row: any) => (
        <span>{v} {row.pripar === 'S' && <Tag color="blue" style={{ fontSize: 10 }}>1ª</Tag>}</span>
      ),
    },
    { title: 'Vencimento', dataIndex: 'datven', width: 120, render: fmtData },
    { title: 'Valor', dataIndex: 'vlrpar', width: 120, align: 'right' as const, render: fmt },
  ];

  const colsCompradores: any[] = [
    { title: 'Comprador', dataIndex: 'nomexx', ellipsis: true },
    { title: 'Condição', dataIndex: 'desfin', width: 180, ellipsis: true },
    { title: '%', dataIndex: 'percen', width: 60, render: (v: number) => `${v}%` },
    { title: 'Forma Pag.', dataIndex: 'formaPagamento', width: 120 },
    {
      title: 'Vlr. a Pagar', dataIndex: 'valorPagar', width: 120, align: 'right' as const,
      render: fmt,
    },
    {
      title: 'Comissão', dataIndex: 'valorComissao', width: 100, align: 'right' as const,
      render: (v: number) => <Text type="warning">{fmt(v)}</Text>,
    },
    {
      title: 'Propriedade', dataIndex: 'nomePropriedade', ellipsis: true, width: 150,
      render: (v: string, row: any) => (
        <Space size={4}>
          <span>{v || '—'}</span>
          <Tooltip title="Selecionar propriedade">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => abrirPropriedades(row)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Parcelas', width: 90, align: 'center' as const,
      render: (_: any, row: any) => {
        const count = parcelas.filter(p => Number(p.idCli) === Number(row.idCli)).length;
        return (
          <Space>
            <Badge count={count} showZero color={count > 0 ? '#52c41a' : '#d9d9d9'} />
          </Space>
        );
      },
    },
    {
      title: '', width: 80, fixed: 'right' as const,
      render: (_: any, row: any) => (
        <Popconfirm title="Remover este comprador?" onConfirm={() => removerComprador(row.id)}
          okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ── render ───────────────────────────────────────────────────────────────

  const canAvancar = () => {
    if (step === 2) return compradores.length > 0;
    return true;
  };

  return (
    <div>
      {/* cabeçalho */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 20 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onCancelar}>Voltar</Button>
            <Title level={4} style={{ margin: 0 }}>
              <DollarOutlined style={{ marginRight: 8 }} />
              {movId ? `Editando Venda #${movId}` : 'Nova Venda'}
            </Title>
          </Space>
        </Col>
      </Row>

      <Steps
        current={step}
        direction={isMobile ? 'vertical' : 'horizontal'}
        size={isMobile ? 'small' : 'default'}
        style={{ marginBottom: 28 }}
        items={[
          { title: 'Leilão & Boleto',  icon: <FileSearchOutlined /> },
          { title: 'Lote & Valores',   icon: <DollarOutlined /> },
          { title: 'Compradores',      icon: <UserOutlined /> },
          { title: 'Parcelamento',     icon: <CheckCircleOutlined /> },
        ]}
      />

      {/* ── STEP 0 ── */}
      {step === 0 && (
        <Card title="Informações do Leilão">
          <Form form={form0} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="idLeilao" label="Leilão"
              rules={[{ required: true, message: 'Selecione o leilão' }]}>
              <Select showSearch placeholder="Escolha o leilão" options={leiloes}
                onChange={onLeilaoChange}
                filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="codnot" label="Nº do Boleto / Nota"
              rules={[{ required: true, message: 'Informe o número do boleto' }]}
              extra="Se não souber, informe 0 para gerar um número automático.">
              <Input placeholder="Ex: 123456"
                onBlur={e => {
                  if (e.target.value === '0') {
                    form0.setFieldValue('codnot', String(Math.floor(Math.random() * 900000) + 100000));
                  }
                }} />
            </Form.Item>
          </Form>
          <Row justify="end">
            <Button type="primary" icon={<ArrowRightOutlined />}
              loading={salvando} onClick={salvarStep0}>
              Próximo
            </Button>
          </Row>
        </Card>
      )}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <Card title="Seleção do Lote e Valores">
          {loteDetalhes && (
            <Card
              size="small"
              style={{ marginBottom: 16, background: '#f0f9ff', border: '1px solid #91caff' }}
            >
              <Row gutter={[16, 8]}>
                <Col xs={24} sm={8}>
                  <Text type="secondary">Lote</Text>
                  <div><Text strong>{loteDetalhes.lotexx} — {loteDetalhes.deslot}</Text></div>
                </Col>
                <Col xs={12} sm={4}>
                  <Text type="secondary">Raça</Text>
                  <div>{loteDetalhes.descricaoRaca || '—'}</div>
                </Col>
                <Col xs={12} sm={4}>
                  <Text type="secondary">SBB / RP</Text>
                  <div>{loteDetalhes.sbbxxx || '—'} / {loteDetalhes.rpxxx || '—'}</div>
                </Col>
                <Col xs={12} sm={4}>
                  <Text type="secondary">Pelagem / Nasc.</Text>
                  <div>{loteDetalhes.pelagem || '—'} · {fmtData(loteDetalhes.datnas)}</div>
                </Col>
                <Col xs={12} sm={4}>
                  <Text type="secondary">Vendedor</Text>
                  <div>{loteDetalhes.nomeVendedor || '—'}</div>
                </Col>
              </Row>
            </Card>
          )}

          <Form form={form1} layout="vertical" onValuesChange={recalcularValores}>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="idLote" label="Lote disponível"
                  rules={[{ required: true, message: 'Selecione um lote' }]}>
                  <Select showSearch placeholder="Selecione o lote..."
                    onChange={onLoteChange}
                    filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
                    options={lotesDisp.map(l => ({
                      value: l.id,
                      label: `${l.lotexx} — ${l.deslot}` + (l.nomeVendedor ? ` (${l.nomeVendedor})` : ''),
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={12} sm={4}>
                <Form.Item name="qtdxxx" label="Qtd. Animais"
                  rules={[{ required: true }]}>
                  <InputNumber min={0.01} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={4}>
                <Form.Item
                  name="vlrpar"
                  label={
                    <Space>
                      <span>Valor por Parcela</span>
                      <Button
                        size="small" type={!ckCalcTotal ? 'primary' : 'default'}
                        onClick={() => { setCkCalcTotal(false); recalcularValores(); }}
                        style={{ fontSize: 11, height: 20, padding: '0 6px' }}
                      >
                        Usar
                      </Button>
                    </Space>
                  }
                >
                  <InputNumber<number>
                    min={0} step={100} style={{ width: '100%' }}
                    formatter={v => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    parser={v => Number(String(v ?? '').replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0}
                    disabled={ckCalcTotal}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={4}>
                <Form.Item
                  name="vlrtot"
                  label={
                    <Space>
                      <span>Valor Total</span>
                      <Button
                        size="small" type={ckCalcTotal ? 'primary' : 'default'}
                        onClick={() => { setCkCalcTotal(true); recalcularValores(); }}
                        style={{ fontSize: 11, height: 20, padding: '0 6px' }}
                      >
                        Usar
                      </Button>
                    </Space>
                  }
                >
                  <InputNumber<number>
                    min={0} step={100} style={{ width: '100%' }}
                    formatter={v => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    parser={v => Number(String(v ?? '').replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0}
                    disabled={!ckCalcTotal}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={4}>
                <Form.Item name="vlrdes" label="Desconto (R$)">
                  <InputNumber<number> min={0} step={100} style={{ width: '100%' }}
                    formatter={v => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    parser={v => Number(String(v ?? '').replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={4}>
                <Form.Item name="_comiss" label="Comissão Leiloeiro">
                  <InputNumber<number> disabled style={{ width: '100%' }}
                    formatter={v => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={4}>
                <Form.Item name="_comissVend" label="Comissão Vendedor">
                  <InputNumber<number> disabled style={{ width: '100%' }}
                    formatter={v => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''} />
                </Form.Item>
              </Col>
            </Row>

            {leilaoInfo && (
              <Alert
                type="info" showIcon style={{ marginBottom: 12 }}
                message={
                  <span>
                    Leilão: <strong>{leilaoInfo.qtdpar || '?'}</strong> parcelas ·
                    Comissão leiloeiro: <strong>{leilaoInfo.comcom ?? 0}%</strong> ·
                    Comissão vendedor: <strong>{leilaoInfo.comven ?? 0}%</strong>
                    {leilaoInfo.descricaoCondicao && ` · Condição padrão: ${leilaoInfo.descricaoCondicao}`}
                  </span>
                }
              />
            )}
          </Form>

          <Row justify="space-between">
            <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>Voltar</Button>
            <Button type="primary" icon={<ArrowRightOutlined />}
              loading={salvando} onClick={salvarStep1}>
              Próximo
            </Button>
          </Row>
        </Card>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <Card title="Compradores">
          {/* formulário add comprador */}
          <Card size="small" title="Adicionar comprador" style={{ marginBottom: 16 }}>
            <Form form={form2} layout="vertical">
              <Row gutter={[12, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item name="idCli" label="Comprador"
                    rules={[{ required: true, message: 'Selecione o comprador' }]}>
                    <Select
                      showSearch filterOption={false} placeholder="Digite para buscar..."
                      options={clientes} loading={loadingCli} onSearch={buscarClientes}
                      notFoundContent={loadingCli ? <Spin size="small" /> : 'Digite 2+ letras'}
                      onChange={() => {
                        const id = form2.getFieldValue('idCli');
                        if (id) {
                          api.get(`/clientes/${id}/propriedades`).then(r => {
                            if (r.data.length === 1) form2.setFieldValue('idPropriedade', r.data[0].id);
                          });
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="idCondPagto" label="Condição de Pagamento"
                    rules={[{ required: true, message: 'Selecione a condição' }]}>
                    <Select showSearch placeholder="Condição..."
                      options={condicoes.map(c => ({ value: c.id, label: c.desfin }))}
                      onChange={onCondicaoChange}
                      filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Item name="percen" label="% do Lote"
                    tooltip="100% = comprador único. Divida para múltiplos compradores.">
                    <InputNumber min={1} max={100} step={1} style={{ width: '100%' }}
                      defaultValue={100} formatter={v => `${v}%`} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="formaPagamento" label="Forma de Pagamento"
                    rules={[{ required: true }]} initialValue="PROMISSORIA">
                    <Select options={FORMAS_PAGAMENTO.map(f => ({ value: f, label: f }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={6} md={3} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Form.Item style={{ marginBottom: 0, width: '100%' }}>
                    <Button type="primary" icon={<PlusOutlined />} block
                      loading={salvando} onClick={adicionarComprador}>
                      Adicionar
                    </Button>
                  </Form.Item>
                </Col>
              </Row>

              {condicaoSel && (
                <Alert type="info" showIcon style={{ marginTop: 4, marginBottom: 0 }}
                  message={
                    <span>
                      <strong>{condicaoSel.desfin}</strong> ·
                      {condicaoSel.avista === 'S' && ' À vista ·'}
                      {condicaoSel.safrax === 'S' && ' Plano Safra ·'}
                      {condicaoSel.invert === 'S' && ' Livre ·'}
                      {condicaoSel.descon > 0 && ` Desconto ${condicaoSel.descon}% ·`}
                      {` ${condicaoSel.qtdpar} parcelas`}
                    </span>
                  }
                />
              )}
            </Form>
          </Card>

          {/* grid compradores */}
          {compradores.length === 0
            ? (
              <Alert type="warning" showIcon
                message="Nenhum comprador adicionado ainda. Adicione ao menos um para prosseguir." />
            )
            : (
              <Table rowKey="id" columns={colsCompradores} dataSource={compradores}
                size="small" pagination={false} scroll={{ x: 900 }} />
            )
          }

          <Divider style={{ margin: '16px 0' }} />
          <Row justify="space-between">
            <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(1)}>Voltar</Button>
            <Button type="primary" icon={<ArrowRightOutlined />}
              disabled={!canAvancar()}
              onClick={async () => {
                const rp = await api.get(`/vendas/${movId}/parcelas`);
                setParcelas(rp.data);
                setStep(3);
              }}>
              Próximo
            </Button>
          </Row>

          {/* Modal propriedades */}
          <Modal
            title="Selecionar propriedade de envio" open={modalProps}
            onCancel={() => setModalProps(false)} footer={null}
          >
            {propriedades.length === 0
              ? <Text type="secondary">Nenhuma propriedade cadastrada para este cliente.</Text>
              : (
                <Table
                  rowKey="id" size="small"
                  dataSource={propriedades}
                  pagination={false}
                  columns={[
                    { title: 'Propriedade', dataIndex: 'nomePropriedade', ellipsis: true },
                    { title: 'Cidade', dataIndex: 'cidade', width: 120 },
                    { title: 'Estado', dataIndex: 'estado', width: 60 },
                    {
                      title: '', width: 80,
                      render: (_: any, row: any) => (
                        <Button size="small" type="primary"
                          onClick={() => salvarPropriedade(row.id)}>
                          Selecionar
                        </Button>
                      ),
                    },
                  ]}
                />
              )
            }
          </Modal>
        </Card>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <Card title="Parcelamento">
          <Row gutter={[16, 8]} align="bottom" style={{ marginBottom: 16 }}>
            <Col xs={24} sm="auto">
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Data base de vencimento</div>
              <DatePicker format="DD/MM/YYYY" value={dataBase} onChange={setDataBase} style={{ width: '100%' }} />
            </Col>
            <Col xs={24} sm="auto">
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Gerar para</div>
              <Select
                style={{ width: isMobile ? '100%' : 220 }} placeholder="Escolha o comprador..."
                value={compParc} onChange={setCompParc}
                options={compradores.map(c => ({ value: c.id, label: c.nomexx }))}
              />
            </Col>
            <Col xs={12} sm="auto">
              <Button type="primary" icon={<ReloadOutlined />}
                loading={loadingParc}
                disabled={!compParc}
                block={isMobile}
                onClick={() => compParc && gerarParcelas(compParc)}>
                Gerar Parcelamento
              </Button>
            </Col>
            <Col xs={12} sm="auto">
              <Button icon={<ReloadOutlined />} onClick={recarregarParcelas} block={isMobile}>
                Atualizar
              </Button>
            </Col>
          </Row>

          {/* Resumo por comprador */}
          {compradores.map(c => {
            const parcsComp = parcelas.filter(p => Number(p.idCli) === Number(c.idCli));
            const totalParc = parcsComp.reduce((a: number, p: any) => a + (p.vlrpar || 0), 0);
            return (
              <Card
                key={c.id} size="small"
                title={<span><UserOutlined style={{ marginRight: 6 }} />{c.nomexx}</span>}
                extra={
                  <Space>
                    <Text type="secondary">{parcsComp.length} parcelas ·</Text>
                    <Text strong style={{ color: '#52c41a' }}>{fmt(totalParc)}</Text>
                  </Space>
                }
                style={{ marginBottom: 12 }}
              >
                {parcsComp.length === 0
                  ? <Text type="secondary">Nenhuma parcela gerada. Use "Gerar Parcelamento" acima.</Text>
                  : (
                    <Table
                      rowKey="id" size="small" pagination={false}
                      dataSource={parcsComp}
                      columns={[
                        { title: 'Parcela', dataIndex: 'ordxxx', width: 80, align: 'center' as const },
                        {
                          title: 'Vencimento', dataIndex: 'datven', width: 145,
                          render: (v: string, row: any) => {
                            if (editingParc && editingParc.id === row.id && editingParc.field === 'datven') {
                              return (
                                <DatePicker
                                  size="small" format="DD/MM/YYYY" autoFocus
                                  defaultValue={dayjs(v)}
                                  onChange={val => {
                                    editingValRef.current = val;
                                    if (val) salvarParcela(row.id, 'datven');
                                    else setEditingParc(null);
                                  }}
                                  onOpenChange={open => { if (!open) setEditingParc(null); }}
                                />
                              );
                            }
                            return (
                              <span
                                style={{ cursor: 'pointer', color: dayjs(v).isBefore(dayjs()) ? '#ff4d4f' : undefined }}
                                onClick={() => { editingValRef.current = dayjs(v); setEditingParc({ id: row.id, field: 'datven', value: dayjs(v) }); }}
                              >
                                {fmtData(v)} <EditOutlined style={{ fontSize: 10, opacity: 0.4 }} />
                              </span>
                            );
                          },
                        },
                        {
                          title: 'Valor', dataIndex: 'vlrpar', align: 'right' as const,
                          render: (v: number, row: any) => {
                            if (editingParc && editingParc.id === row.id && editingParc.field === 'vlrpar') {
                              return (
                                <InputNumber<number>
                                  size="small" style={{ width: 130 }} autoFocus
                                  min={0} defaultValue={v}
                                  formatter={val => val != null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                                  parser={val => Number(String(val ?? '').replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0}
                                  onChange={val => { editingValRef.current = val ?? v; }}
                                  onBlur={() => salvarParcela(row.id, 'vlrpar')}
                                  onPressEnter={() => salvarParcela(row.id, 'vlrpar')}
                                  onKeyDown={e => { if (e.key === 'Escape') { setEditingParc(null); editingValRef.current = null; } }}
                                />
                              );
                            }
                            return (
                              <span
                                style={{ cursor: 'pointer' }}
                                onClick={() => { editingValRef.current = v; setEditingParc({ id: row.id, field: 'vlrpar', value: v }); }}
                              >
                                <Text strong>{fmt(v)}</Text> <EditOutlined style={{ fontSize: 10, opacity: 0.4 }} />
                              </span>
                            );
                          },
                        },
                        {
                          title: '1ª?', dataIndex: 'pripar', width: 60, align: 'center' as const,
                          render: (v: string) => v === 'S' ? <Tag color="blue">Sim</Tag> : null,
                        },
                      ]}
                      summary={() => (
                        <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 700 }}>
                          <Table.Summary.Cell index={0} colSpan={2} align="right">Total</Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">
                            <Text strong style={{ color: '#52c41a' }}>{fmt(totalParc)}</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} />
                        </Table.Summary.Row>
                      )}
                    />
                  )
                }
              </Card>
            );
          })}

          <Divider style={{ margin: '16px 0' }} />
          <Row justify="space-between">
            <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(2)}>Voltar</Button>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={onConcluir}>
              Concluir
            </Button>
          </Row>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function Vendas() {
  const [modo, setModo]   = useState<'listagem' | 'wizard'>('listagem');
  const [editId, setEditId] = useState<number | undefined>();
  const [reloadKey, setReloadKey] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const id = (location.state as any)?.abrirVendaId;
    if (id) {
      setEditId(id);
      setModo('wizard');
      window.history.replaceState({}, document.title);
    }
  }, []);

  const abrirNova = () => { setEditId(undefined); setModo('wizard'); };
  const abrirEdit = (id: number) => { setEditId(id); setModo('wizard'); };
  const voltar    = () => { setModo('listagem'); setEditId(undefined); setReloadKey(k => k + 1); };

  if (modo === 'wizard') {
    return (
      <Wizard
        key={editId ?? 'novo'}
        editId={editId}
        onConcluir={voltar}
        onCancelar={voltar}
      />
    );
  }

  return <Listagem key={reloadKey} onNova={abrirNova} onEditar={abrirEdit} />;
}
