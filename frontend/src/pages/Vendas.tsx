import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBanco } from '../context/BancoContext';
import ResizableTitle from '../components/ResizableTitle';
import { useColumnWidths } from '../hooks/useColumnWidths';
import { useBuscaLeiloes } from '../hooks/useBuscaLeiloes';
import {
  Alert, Badge, Button, Card, Checkbox, Col, DatePicker, Divider, Dropdown, Form, Grid, Input,
  InputNumber, message, Modal, Popconfirm, Radio, Row, Select, Space, Spin,
  Steps, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined,
  DeleteOutlined, DollarOutlined, EditOutlined, FileSearchOutlined,
  FileDoneOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UserOutlined,
  FileTextOutlined, AuditOutlined, EyeOutlined, FileExcelOutlined, FlagOutlined,
  PercentageOutlined, SyncOutlined, MoreOutlined,
} from '@ant-design/icons';
import { BlobProvider } from '@react-pdf/renderer';
import FaturaCompraPDF, { FaturaData, VarianteFatura } from '../relatorios/RelatorioFaturaCompra';
import PromissoriaPDF from '../relatorios/RelatorioPromissoria';
import PromissoriaDinamica from '../relatorios/PromissoriaDinamica';
import RelatorioFaturaCompradorDinamico from '../relatorios/RelatorioFaturaCompradorDinamico';
import { CampoLayout } from '../relatorios/tipoLayout';
import NotaVendaPDF from '../relatorios/RelatorioNotaVenda';
import { exportarVendasExcel } from '../relatorios/exportarExcel';
import { useConfig } from '../context/ConfigContext';
import ContratoEditor from '../components/ContratoEditor';
import api from '../services/api';
import dayjs, { Dayjs } from 'dayjs';
import { dataUTC, fmtDataUTC } from '../utils/data';
import { labelRP, labelSBB } from '../utils/lote';
import { lerFiltroPersistido, salvarFiltroPersistido } from '../utils/filtroPersistido';

const { Title, Text } = Typography;

const fmt = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

const fmtData = fmtDataUTC;

// Restringe os dados de Fatura/Promissória/Nota de Leilão a UM comprador —
// nunca gera o PDF com todos os compradores do lote juntos (chamado #62).
// Retorna null quando ainda falta escolher (lote dividido, nada selecionado).
function dadosDoComprador(data: FaturaData | null, compradorId: number | null): FaturaData | null {
  if (!data) return null;
  if (data.compradores.length <= 1) return data;
  if (compradorId == null) return null;
  const comp = data.compradores.find(c => c.id === compradorId);
  return comp ? { ...data, compradores: [comp] } : null;
}

/** Ordena numericamente quando os dois valores são números (ex. boleto, lote), com fallback para texto. */
const sortNumericOuTexto = (a: unknown, b: unknown) => {
  const na = parseFloat(String(a));
  const nb = parseFloat(String(b));
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return String(a ?? '').localeCompare(String(b ?? ''));
};

const TITULO_FATURA_VARIANTE: Record<VarianteFatura, string> = {
  comprador: 'Fatura de Comprador',
  sindicato: 'Fatura Sindicato',
  vendedor: 'Fatura de Vendedor',
};

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

function Listagem({
  onNova, onEditar,
  tipoBusca, setTipoBusca, busca, setBusca, idLeilao, setIdLeilao,
  leiloes, carregandoLeiloes, buscarLeiloes,
  dados, setDados, loading, jaBuscou, setJaBuscou, carregar,
}: {
  onNova: (leilaoAtual?: { id: number; nome: string }) => void;
  onEditar: (id: number) => void;
  tipoBusca: string; setTipoBusca: (v: string) => void;
  busca: string; setBusca: (v: string) => void;
  idLeilao: number | undefined; setIdLeilao: (v: number | undefined) => void;
  leiloes: { value: number; label: string }[]; carregandoLeiloes: boolean; buscarLeiloes: (v: string) => void;
  dados: any[]; setDados: React.Dispatch<React.SetStateAction<any[]>>;
  loading: boolean; jaBuscou: boolean; setJaBuscou: (v: boolean) => void;
  carregar: () => Promise<void>;
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const { rz: rzV } = useColumnWidths('vendas', {
    id: 70, defesa: 100, codnot: 100, leilao: 200, datlan: 110,
    lotexx: 70, deslot: 200, nomexx: 180, qtdxxx: 70, vlrpar: 120, vlrtot: 120,
  });

  const config = useConfig();
  const [faturaLoading, setFaturaLoading]           = useState<number | null>(null);
  const [faturaData, setFaturaData]                 = useState<FaturaData | null>(null);
  const [faturaModal, setFaturaModal]               = useState(false);
  const [promissoriaLoading, setPromissoriaLoading] = useState<number | null>(null);
  const [promissoriaData, setPromissoriaData]       = useState<FaturaData | null>(null);
  const [promissoriaModal, setPromissoriaModal]     = useState(false);
  const [promissoriaLayout, setPromissoriaLayout]   = useState<CampoLayout[] | null>(null);

  // Contrato
  const [contratoModal, setContratoModal]           = useState(false);
  const [contratoVenda, setContratoVenda]           = useState<any | null>(null);
  const [contratoTemplates, setContratoTemplates]   = useState<any[]>([]);
  const [contratoIdTemplate, setContratoIdTemplate] = useState<number | undefined>();
  const [contratoHtml, setContratoHtml]             = useState('');
  const [contratoStep, setContratoStep]             = useState<'select' | 'edit'>('select');
  const [contratoLoading, setContratoLoading]       = useState(false);

  const [faturaVariante, setFaturaVariante] = useState<VarianteFatura>('comprador');
  const [faturaLayout, setFaturaLayout] = useState<CampoLayout[] | null>(null);
  const [notaVendaModal, setNotaVendaModal] = useState(false);
  const [notaVendaData, setNotaVendaData]   = useState<FaturaData | null>(null);
  const [notaVendaLoading, setNotaVendaLoading] = useState<number | null>(null);
  const [notaVendaLayout, setNotaVendaLayout] = useState<CampoLayout[] | null>(null);

  // Quando o lote é dividido entre vários compradores (percentual quebrado),
  // Fatura/Promissória/Nota de Leilão exigem escolher UM comprador por vez —
  // nunca gerar um PDF único misturando todos (chamado #62).
  const [docCompradorId, setDocCompradorId] = useState<number | null>(null);

  // Pré-seleciona o único comprador quando não há divisão; força escolha
  // explícita (null) quando o lote foi rateado entre vários.
  const definirCompradorInicial = (data: FaturaData) => {
    setDocCompradorId(data.compradores.length === 1 ? data.compradores[0].id : null);
  };

  const abrirFatura = async (id: number, variante: VarianteFatura = 'comprador') => {
    setFaturaLoading(id);
    try {
      const [rDados, rLayout] = await Promise.all([
        api.get(`/vendas/${id}/fatura`),
        api.get(`/relatorio-layouts/ativo/fatura_${variante}`).catch(() => ({ data: null })),
      ]);
      setFaturaData(rDados.data);
      definirCompradorInicial(rDados.data);
      setFaturaVariante(variante);
      setFaturaLayout(rLayout.data?.conteudo || null);
      setFaturaModal(true);
    } catch { message.error('Erro ao carregar fatura'); }
    finally { setFaturaLoading(null); }
  };

  const abrirPromissoria = async (id: number) => {
    setPromissoriaLoading(id);
    try {
      const [rDados, rLayout] = await Promise.all([
        api.get(`/vendas/${id}/fatura`),
        api.get('/relatorio-layouts/ativo/promissoria').catch(() => ({ data: null })),
      ]);
      setPromissoriaData(rDados.data);
      definirCompradorInicial(rDados.data);
      setPromissoriaLayout(rLayout.data?.conteudo || null);
      setPromissoriaModal(true);
    } catch { message.error('Erro ao carregar promissórias'); }
    finally { setPromissoriaLoading(null); }
  };

  const abrirNotaVenda = async (id: number) => {
    setNotaVendaLoading(id);
    try {
      const [rDados, rLayout] = await Promise.all([
        api.get(`/vendas/${id}/fatura`),
        api.get('/relatorio-layouts/ativo/nota_venda').catch(() => ({ data: null })),
      ]);
      setNotaVendaData(rDados.data);
      definirCompradorInicial(rDados.data);
      setNotaVendaLayout(rLayout.data?.conteudo || null);
      setNotaVendaModal(true);
    } catch { message.error('Erro ao carregar nota de venda'); }
    finally { setNotaVendaLoading(null); }
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


  const excluir = async (id: number) => {
    await api.delete(`/vendas/${id}`);
    message.success('Venda excluída');
    carregar();
  };

  // ── Encaminhamento (status comissão/parcela/contrato/embarque + forma pagto) ──
  const [encModal, setEncModal] = useState(false);
  const [encRow, setEncRow]     = useState<any | null>(null);

  const abrirEncaminhamento = (row: any) => { setEncRow(row); setEncModal(true); };

  const atualizarCampoStatus = async (
    campo: 'stComissao' | 'stParcela' | 'stContrato' | 'stEmbarque',
    campoApi: 'ST_COMISSAO' | 'ST_PARCELA' | 'ST_CONTRATO' | 'ST_EMBARQUE',
    valor: string,
  ) => {
    if (!encRow) return;
    await api.put(`/vendas/${encRow.id}/encaminhamento`, { campo: campoApi, valor });
    setEncRow((r: any) => ({ ...r, [campo]: valor }));
    setDados(ds => ds.map(d => d.id === encRow.id ? { ...d, [campo]: valor } : d));
    message.success('Encaminhamento atualizado');
  };

  const atualizarFormaPagtoVenda = async (forma: string) => {
    if (!encRow) return;
    await api.put(`/vendas/${encRow.id}/forma-pagamento`, { forma });
    setEncRow((r: any) => ({ ...r, formaPagamento: forma }));
    message.success('Forma de pagamento atualizada');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const emCampo = ['INPUT', 'TEXTAREA'].includes(alvo?.tagName) || alvo?.isContentEditable;
      if (e.key === 'Insert' && !emCampo && !encModal && !faturaModal && !promissoriaModal && !contratoModal && !notaVendaModal) {
        e.preventDefault();
        onNova();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encModal, faturaModal, promissoriaModal, contratoModal, notaVendaModal]);

  const colunas: any[] = [
    {
      title: 'Cód', dataIndex: 'id', ...rzV('id'), fixed: 'left' as const,
      sorter: (a: any, b: any) => a.id - b.id,
      render: (v: number) => <Text strong>#{v}</Text>,
    },
    {
      title: 'Status', dataIndex: 'defesa', ...rzV('defesa'),
      render: (v: string) => v === 'S'
        ? <Tag color="green">Vendido</Tag>
        : <Tag color="orange">Pendente</Tag>,
    },
    { title: 'Boleto', dataIndex: 'codnot', ...rzV('codnot'), sorter: (a: any, b: any) => sortNumericOuTexto(a.codnot, b.codnot) },
    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true, ...rzV('leilao'), sorter: (a: any, b: any) => String(a.leilao).localeCompare(String(b.leilao)) },
    {
      title: 'Data', dataIndex: 'datlan', ...rzV('datlan'),
      sorter: (a: any, b: any) => new Date(a.datlan).getTime() - new Date(b.datlan).getTime(),
      render: fmtData,
    },
    { title: 'Lote', dataIndex: 'lotexx', ...rzV('lotexx'), sorter: (a: any, b: any) => sortNumericOuTexto(a.lotexx, b.lotexx) },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true, ...rzV('deslot') },
    {
      title: 'Comprador', dataIndex: 'nomexx', ellipsis: true, ...rzV('nomexx'),
      sorter: (a: any, b: any) => String(a.nomexx).localeCompare(String(b.nomexx)),
      render: (v: string, row: any) => (
        // Cliente fictício "DEFESA" (placeholder legado para lotes retirados/não vendidos)
        v === 'DEFESA' && !row.vlrtot
          ? <Text type="secondary" italic>Lote não vendido</Text>
          : (v || '—')
      ),
    },
    {
      title: 'Qtd', dataIndex: 'qtdxxx', ...rzV('qtdxxx'), align: 'right' as const,
      sorter: (a: any, b: any) => (a.qtdxxx ?? 0) - (b.qtdxxx ?? 0),
      render: (v: number) => v ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—',
    },
    {
      title: 'Vlr. Parcela', dataIndex: 'vlrpar', ...rzV('vlrpar'), align: 'right' as const,
      sorter: (a: any, b: any) => (a.vlrpar ?? 0) - (b.vlrpar ?? 0),
      render: fmt,
    },
    {
      title: 'Vlr. Total', dataIndex: 'vlrtot', ...rzV('vlrtot'), align: 'right' as const,
      sorter: (a: any, b: any) => (a.vlrtot ?? 0) - (b.vlrtot ?? 0),
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
      title: '', width: 90, fixed: 'right' as const,
      render: (_: any, row: any) => (
        <Space size={4}>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => onEditar(row.id)} />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'documentos', label: 'Documentos', icon: <FileTextOutlined />,
                  children: [
                    { key: 'fatura',          label: 'Fatura de Compras',  icon: <FileDoneOutlined />, onClick: () => abrirFatura(row.id) },
                    { key: 'promissoria',     label: 'Promissórias',       icon: <AuditOutlined />,    onClick: () => abrirPromissoria(row.id) },
                    { key: 'notaVenda',       label: 'Nota de Leilão',     onClick: () => abrirNotaVenda(row.id) },
                    { key: 'faturaSindicato', label: 'Fatura Sindicatos',  onClick: () => abrirFatura(row.id, 'sindicato') },
                    { key: 'faturaVendedor',  label: 'Fatura de Vendedor', onClick: () => abrirFatura(row.id, 'vendedor') },
                    { key: 'contrato',        label: 'Contrato',           onClick: () => abrirContrato(row) },
                  ],
                },
                { key: 'encaminhamento', label: 'Encaminhamento', icon: <FlagOutlined />, onClick: () => abrirEncaminhamento(row) },
                { type: 'divider' },
                {
                  key: 'excluir', label: 'Excluir', icon: <DeleteOutlined />, danger: true,
                  onClick: () => Modal.confirm({
                    title: 'Excluir esta venda?',
                    content: 'Parcelas e compradores também serão excluídos.',
                    okText: 'Excluir', okButtonProps: { danger: true }, cancelText: 'Cancelar',
                    onOk: () => excluir(row.id),
                  }),
                },
              ],
            }}
          >
            <Button
              size="small" icon={<MoreOutlined />}
              loading={faturaLoading === row.id || promissoriaLoading === row.id || notaVendaLoading === row.id}
            />
          </Dropdown>
        </Space>
      ),
    },
  ];

  // Select "escolha o comprador" mostrado só quando o lote foi dividido
  // (compradores.length > 1) — nas vendas normais (1 comprador) não aparece.
  const seletorComprador = (data: FaturaData) => data.compradores.length <= 1 ? null : (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16, textAlign: 'left' }}
      message="Lote dividido entre vários compradores"
      description={
        <>
          <div style={{ marginBottom: 8 }}>
            Escolha para qual comprador gerar o documento — cada um recebe o seu próprio PDF, sem dados dos demais.
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="Selecione o comprador..."
            value={docCompradorId ?? undefined}
            onChange={setDocCompradorId}
            options={data.compradores.map(c => ({
              value: c.id,
              label: `${c.nomexx || 'Sem nome'}${c.percen != null ? ` — ${c.percen}%` : ''}`,
            }))}
          />
        </>
      }
    />
  );

  return (
    <>
      {/* Modal Fatura de Compras */}
      <Modal
        open={faturaModal}
        onCancel={() => { setFaturaModal(false); setFaturaData(null); setFaturaLayout(null); }}
        footer={null}
        title={
          <Space>
            <FileDoneOutlined />
            <span>Fatura de Compras {faturaData ? `#${faturaData.id}` : ''}</span>
          </Space>
        }
        width={480}
      >
        {faturaData && (() => {
          const dadosSel = dadosDoComprador(faturaData, docCompradorId);
          return (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            {seletorComprador(faturaData)}
            <div style={{ marginBottom: 16, textAlign: 'left', lineHeight: 1.8 }}>
              <div><strong>Leilão:</strong> {faturaData.leilao || '—'}</div>
              <div><strong>Lote:</strong> {faturaData.lote?.lotexx} — {faturaData.lote?.deslot}</div>
              <div><strong>Comprador(es):</strong> {faturaData.compradores.map(c => c.nomexx).filter(Boolean).join(', ')}</div>
              <div><strong>Vendedor:</strong> {faturaData.lote?.nomeVendedor || '—'}</div>
              <div><strong>Parcelas:</strong> {faturaData.compradores.reduce((t, c) => t + c.parcelas.length, 0)}</div>
            </div>
            {dadosSel && (
              <BlobProvider
                document={
                  faturaLayout
                    ? <RelatorioFaturaCompradorDinamico dados={dadosSel} layout={faturaLayout} empresa={config.empresa} logoBase64={config.logoBase64} titulo={TITULO_FATURA_VARIANTE[faturaVariante]} />
                    : <FaturaCompraPDF dados={dadosSel} empresa={config.empresa} variante={faturaVariante} logoBase64={config.logoBase64} />
                }
              >
                {({ url, loading }) => (
                  <Button
                    type="primary"
                    size="large"
                    icon={<EyeOutlined />}
                    loading={loading}
                    disabled={!url}
                    onClick={() => url && window.open(url, '_blank')}
                    style={{ width: '100%' }}
                  >
                    {loading ? 'Gerando PDF...' : 'Visualizar / Imprimir Fatura'}
                  </Button>
                )}
              </BlobProvider>
            )}
          </div>
          );
        })()}
      </Modal>

      {/* Modal Promissórias */}
      <Modal
        open={promissoriaModal}
        onCancel={() => { setPromissoriaModal(false); setPromissoriaData(null); setPromissoriaLayout(null); }}
        footer={null}
        title={
          <Space>
            <AuditOutlined />
            <span>Promissórias {promissoriaData ? `— Boleto ${promissoriaData.codnot || promissoriaData.id}` : ''}</span>
          </Space>
        }
        width={480}
      >
        {promissoriaData && (() => {
          const dadosSel = dadosDoComprador(promissoriaData, docCompradorId);
          return (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            {seletorComprador(promissoriaData)}
            <div style={{ marginBottom: 16, textAlign: 'left', lineHeight: 1.8 }}>
              <div><strong>Leilão:</strong> {promissoriaData.leilao || '—'}</div>
              <div><strong>Lote:</strong> {promissoriaData.lote?.lotexx} — {promissoriaData.lote?.deslot}</div>
              <div><strong>Vendedor:</strong> {promissoriaData.lote?.nomeVendedor || '—'}</div>
              <div>
                <strong>Compradores:</strong>{' '}
                {promissoriaData.compradores.map(c => c.nomexx).filter(Boolean).join(', ')}
              </div>
              <div>
                <strong>Total de promissórias:</strong>{' '}
                {promissoriaData.compradores.reduce((t, c) => t + (c.qtdparCond ?? c.parcelas.length), 0)} parcelas
              </div>
            </div>
            {dadosSel && (
              <BlobProvider
                document={
                  promissoriaLayout
                    ? <PromissoriaDinamica dados={dadosSel} layout={promissoriaLayout} empresa={config.empresa} logoBase64={config.logoBase64} />
                    : <PromissoriaPDF dados={dadosSel} empresa={config.empresa} logoBase64={config.logoBase64} />
                }
              >
                {({ url, loading }) => (
                  <Button
                    type="primary"
                    size="large"
                    icon={<EyeOutlined />}
                    loading={loading}
                    disabled={!url}
                    onClick={() => url && window.open(url, '_blank')}
                    style={{ width: '100%' }}
                  >
                    {loading ? 'Gerando PDF...' : 'Visualizar / Imprimir Promissória'}
                  </Button>
                )}
              </BlobProvider>
            )}
          </div>
          );
        })()}
      </Modal>

      {/* Modal Nota de Leilão */}
      <Modal
        open={notaVendaModal}
        onCancel={() => { setNotaVendaModal(false); setNotaVendaData(null); setNotaVendaLayout(null); }}
        footer={null}
        title={
          <Space>
            <FileTextOutlined />
            <span>Nota de Leilão {notaVendaData ? `— Boleto ${notaVendaData.codnot || notaVendaData.id}` : ''}</span>
          </Space>
        }
        width={480}
      >
        {notaVendaData && (() => {
          const dadosSel = dadosDoComprador(notaVendaData, docCompradorId);
          return (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            {seletorComprador(notaVendaData)}
            <div style={{ marginBottom: 16, textAlign: 'left', lineHeight: 1.8 }}>
              <div><strong>Leilão:</strong> {notaVendaData.leilao || '—'}</div>
              <div><strong>Lote:</strong> {notaVendaData.lote?.lotexx} — {notaVendaData.lote?.deslot}</div>
              <div><strong>Vendedor:</strong> {notaVendaData.lote?.nomeVendedor || '—'}</div>
              <div>
                <strong>Compradores:</strong>{' '}
                {notaVendaData.compradores.map(c => c.nomexx).filter(Boolean).join(', ')}
              </div>
            </div>
            {dadosSel && (
              <BlobProvider
                document={
                  notaVendaLayout
                    ? <PromissoriaDinamica dados={dadosSel} layout={notaVendaLayout} empresa={config.empresa} logoBase64={config.logoBase64} titulo="Nota de Leilão" />
                    : <NotaVendaPDF dados={dadosSel} empresa={config.empresa} logoBase64={config.logoBase64} />
                }
              >
                {({ url, loading }) => (
                  <Button
                    type="primary"
                    size="large"
                    icon={<EyeOutlined />}
                    loading={loading}
                    disabled={!url}
                    onClick={() => url && window.open(url, '_blank')}
                    style={{ width: '100%' }}
                  >
                    {loading ? 'Gerando PDF...' : 'Visualizar / Imprimir Nota de Leilão'}
                  </Button>
                )}
              </BlobProvider>
            )}
          </div>
          );
        })()}
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

      {/* Modal Encaminhamento */}
      <Modal
        open={encModal}
        onCancel={() => { setEncModal(false); setEncRow(null); }}
        footer={null}
        title={
          <Space>
            <FlagOutlined />
            <span>Encaminhamento {encRow ? `— Venda #${encRow.id}` : ''}</span>
          </Space>
        }
        width={420}
      >
        {encRow && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 4 }}><Text strong>Pagamento Comissão</Text></div>
              <Radio.Group
                value={encRow.stComissao === 'C' ? 'C' : 'A'}
                onChange={e => atualizarCampoStatus('stComissao', 'ST_COMISSAO', e.target.value)}
              >
                <Radio value="A">Em andamento</Radio>
                <Radio value="C">Concluído</Radio>
              </Radio.Group>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 4 }}><Text strong>Pagamento Parcelas</Text></div>
              <Radio.Group
                value={encRow.stParcela === 'C' ? 'C' : 'A'}
                onChange={e => atualizarCampoStatus('stParcela', 'ST_PARCELA', e.target.value)}
              >
                <Radio value="A">Em andamento</Radio>
                <Radio value="C">Concluído</Radio>
              </Radio.Group>
              {encRow.stParcela === 'C' && (
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Forma de pagamento"
                  value={encRow.formaPagamento}
                  onChange={atualizarFormaPagtoVenda}
                  options={FORMA_PAGAMENTO_OPTS}
                />
              )}
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <Checkbox
              checked={encRow.stContrato === 'C'}
              onChange={e => atualizarCampoStatus('stContrato', 'ST_CONTRATO', e.target.checked ? 'C' : 'A')}
              style={{ display: 'block', marginBottom: 8 }}
            >
              Contrato Concluído
            </Checkbox>
            <Checkbox
              checked={encRow.stEmbarque === 'C'}
              onChange={e => atualizarCampoStatus('stEmbarque', 'ST_EMBARQUE', e.target.checked ? 'C' : 'A')}
            >
              Embarque Concluído
            </Checkbox>
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
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => onNova(
            tipoBusca === 'leilao' && idLeilao
              ? { id: idLeilao, nome: leiloes.find(l => l.value === idLeilao)?.label || '' }
              : undefined
          )}
          style={{ background: '#d97706', borderColor: '#d97706' }}>Nova Venda</Button>
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
                options={leiloes} onChange={setIdLeilao} onSearch={buscarLeiloes}
                filterOption={false} loading={carregandoLeiloes}
                placeholder="Digite para buscar..."
                notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'} />
            </Col>
          )}
          <Col xs={24} sm="auto" style={{ marginLeft: isMobile ? 0 : 'auto' }}>
            <Space wrap>
              <Button icon={<SearchOutlined />} onClick={carregar} loading={loading} block={isMobile}>Buscar</Button>
              <Button icon={<ReloadOutlined />} block={isMobile} onClick={() => {
                setTipoBusca('todos'); setBusca(''); setIdLeilao(undefined);
                setDados([]); setJaBuscou(false);
              }}>Limpar</Button>
              <Button icon={<FileExcelOutlined />} block={isMobile}
                onClick={() => exportarVendasExcel(dados)}>Excel</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        rowKey={(r: any) => `${r.id}-${r.idcli}`} columns={colunas} dataSource={dados} loading={loading}
        components={{ header: { cell: ResizableTitle } }}
        size="small" scroll={{ x: 1600 }}
        pagination={{ pageSize: 20, showTotal: t => `${t} registros`, showSizeChanger: !isMobile, simple: isMobile }}
        locale={{ emptyText: jaBuscou ? 'Nenhuma venda encontrada' : 'Escolha um filtro (ex.: Leilão) e clique em Buscar' }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD
// ─────────────────────────────────────────────────────────────────────────────

const FORMAS_PAGAMENTO = ['PROMISSORIA', 'CHEQUE', 'DINHEIRO', 'FINANCIAMENTO', 'PIX', 'ACERTO_DIRETO'];
const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  PROMISSORIA: 'Promissória', CHEQUE: 'Cheque', DINHEIRO: 'Dinheiro',
  FINANCIAMENTO: 'Financiamento', PIX: 'PIX', ACERTO_DIRETO: 'Acerto Direto',
};
const FORMA_PAGAMENTO_OPTS = FORMAS_PAGAMENTO.map(f => ({ value: f, label: FORMA_PAGAMENTO_LABEL[f] }));

function Wizard({ editId, leilaoInicial, onConcluir, onCancelar }: {
  editId?: number;
  leilaoInicial?: { id: number; nome: string };
  onConcluir: () => void;
  onCancelar: () => void;
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const [step, setStep]     = useState(0);
  const [movId, setMovId]   = useState<number | undefined>(editId);
  const [salvando, setSalvando] = useState(false);
  const [mov, setMov]   = useState<any>(null);
  const [compradores, setCompradores] = useState<any[]>([]);
  const [parcelas, setParcelas]       = useState<any[]>([]);

  // ── step 0 ──────────────────────────────────────────────────────────────
  const [form0]   = Form.useForm();
  const { opcoes: leiloes, carregando: carregandoLeiloes, buscar: buscarLeiloes, garantirOpcao: garantirOpcaoLeilao } = useBuscaLeiloes();

  // ── step 1 ──────────────────────────────────────────────────────────────
  const [form1]         = Form.useForm();
  const [lotesDisp, setLotesDisp] = useState<any[]>([]);
  const [loteDetalhes, setLoteDetalhes] = useState<any>(null);
  const [ckCalcTotal, setCkCalcTotal]   = useState(false);
  const [leilaoInfo, setLeilaoInfo]     = useState<any>(null);
  const [loteSimpModal, setLoteSimpModal] = useState(false);
  const [formLoteSimp]  = Form.useForm();
  const racaxxLoteSimp = Form.useWatch('racaxx', formLoteSimp);
  const [racas, setRacas] = useState<{ value: number; label: string; especies?: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ value: number; label: string }[]>([]);
  const [loadingVend, setLoadingVend] = useState(false);
  const timerVend = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── step 2 ──────────────────────────────────────────────────────────────
  const [form2]         = Form.useForm();
  const tipoDescontoFidelidadeSel = Form.useWatch('tipoDescontoFidelidade', form2);
  const [clientes, setClientes]   = useState<any[]>([]);
  const [loadingCli, setLoadingCli] = useState(false);
  const timerCli = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [condicoes, setCondicoes] = useState<any[]>([]);
  const [condicaoSel, setCondicaoSel] = useState<any>(null);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [modalProps, setModalProps] = useState(false);
  const [compSelecionado, setCompSelecionado] = useState<any>(null);
  const [pisteiros, setPisteiros] = useState<{ value: number; label: string }[]>([]);
  const [compEditando, setCompEditando] = useState<any | null>(null);
  const [comissaoModal, setComissaoModal] = useState(false);
  const [comissaoAlvo, setComissaoAlvo] = useState<any | null>(null);
  const [formComissao] = Form.useForm();

  // ── step 3 ──────────────────────────────────────────────────────────────
  const [dataBase, setDataBase] = useState<Dayjs | null>(dayjs());
  const [compParc, setCompParc] = useState<number | undefined>();
  const [loadingParc, setLoadingParc] = useState(false);
  const [editingParc, setEditingParc] = useState<{id: number; field: 'datven'|'vlrpar'; value: any}|null>(null);
  const editingValRef = useRef<any>(null);

  // ── inicialização ────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/condicoes-pagamento').then(r => setCondicoes(r.data));
    api.get('/usuarios', { params: { tipo: 'PISTEIRO' } }).then(r =>
      setPisteiros(r.data.map((u: any) => ({ value: u.id, label: u.nomexx }))));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const r  = await api.get(`/vendas/${editId}`);
      const mv = r.data;
      setMov(mv);
      // GET /vendas/:id já traz comcom/comven/qtdpar do leilão (join) — é
      // exatamente o que leilaoInfo precisa, sem chamada extra. Sem isso,
      // leilaoInfo ficava null ao editar e a Comissão Leiloeiro/Vendedor
      // (e o painel de info do leilão) apareciam em branco.
      setLeilaoInfo(mv);
      // Data base do parcelamento (equivalente ao EditDataBase do Delphi):
      // default é a data do leilão, não a data atual — sem isso ficava presa
      // no dayjs() do estado inicial ao reabrir uma venda para editar.
      if (mv.datlei) setDataBase(dayjs(mv.datlei.slice(0, 10)));
      form0.setFieldsValue({ idLeilao: mv.idLeilao, codnot: mv.codnot, defesa: mv.defesa !== 'N' });
      garantirOpcaoLeilao(mv.idLeilao, mv.leilao);
      await carregarLotesDisp(mv.idLeilao);

      const rl = await api.get(`/vendas/${editId}/lote`);
      if (rl.data) {
        setLoteDetalhes(rl.data);
        form1.setFieldsValue({
          idLote: rl.data.idLote, qtdxxx: rl.data.qtdxxx,
          vlrpar: rl.data.vlrpar, vlrtot: rl.data.vlrtot, vlrdes: rl.data.vlrdes ?? 0,
          qtdparOverride: rl.data.qtdpar,
          // Comissão já persistida no lançamento original — não recalcular
          // pelo percentual atual do leilão, que pode ter mudado desde então.
          _comiss: rl.data.comiss ?? 0, _comissVend: rl.data.comissVendedor ?? 0,
        });
        // O lote desta venda não vem na lista de "disponíveis" (já está vendido a ela mesma) —
        // injeta manualmente para o Select conseguir exibir o rótulo em vez do código bruto.
        setLotesDisp(prev => prev.some(l => l.id === rl.data.idLote)
          ? prev
          : [{ ...rl.data, id: rl.data.idLote }, ...prev]);
      } else {
        // Vendas migradas do sistema antigo às vezes não têm MOVIMENTO_LOTE gravado —
        // sem isso o Step "Lote & Valores" fica em branco e o usuário trava sem saber por quê.
        message.warning('Esta venda não possui lote vinculado nos dados. Selecione o lote e os valores manualmente para continuar.', 6);
      }

      const rc = await api.get(`/vendas/${editId}/compradores`);
      setCompradores(rc.data);

      const rp = await api.get(`/vendas/${editId}/parcelas`);
      setParcelas(rp.data);
    })();
  }, [editId]);

  // Se o usuário já tinha escolhido um leilão na listagem (filtro "Leilão")
  // antes de clicar em "Nova Venda", não faz sentido pedir pra escolher de
  // novo — pré-preenche e já carrega os lotes disponíveis desse leilão.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editId || !leilaoInicial) return;
    form0.setFieldValue('idLeilao', leilaoInicial.id);
    garantirOpcaoLeilao(leilaoInicial.id, leilaoInicial.nome);
    onLeilaoChange(leilaoInicial.id);
  }, []);

  // ── step 0: salvar mov ───────────────────────────────────────────────────

  const carregarLotesDisp = async (idLeilao: number) => {
    const r = await api.get(`/vendas/lotes-disponiveis/${idLeilao}`);
    setLotesDisp(r.data);
  };

  const onLeilaoChange = async (id: number) => {
    setLoteDetalhes(null);
    form1.resetFields();
    await carregarLotesDisp(id);
    // guarda info do leilão para calcular comissões
    const r = await api.get(`/leiloes/${id}`);
    setLeilaoInfo(r.data);
    // pré-preenche data base com data do leilão
    if (r.data.datlei) setDataBase(dayjs(r.data.datlei.slice(0, 10)));
  };

  const salvarStep0 = async () => {
    let vals;
    try { vals = await form0.validateFields(); } catch { return; }
    const payload = { idLeilao: vals.idLeilao, codnot: vals.codnot, defesa: vals.defesa === false ? 'N' : 'S' };
    setSalvando(true);
    try {
      if (movId) {
        await api.put(`/vendas/${movId}`, payload);
        setMov({ ...mov, ...payload });
      } else {
        const r = await api.post('/vendas', payload);
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

    // Se o lote tem condição de pagamento própria (diferente da padrão do
    // leilão), usa o número de parcelas dela — não da condição do leilão.
    const qtdpar = Number(det?.condicaoQtdpar ?? leilaoInfo?.qtdpar ?? 1);
    const comcom = leilaoInfo?.comcom ?? 0;
    const comven = leilaoInfo?.comven ?? 0;

    // Se o lote tem quantidade de animais cadastrada, sugere o que resta
    // vender (o lote pode já ter sido parcialmente vendido em outra venda).
    const qtdSugerida = det?.qtdRestante ?? 1;

    // Se o lote tem lance online (vlrins), usa como valor parcela
    const vlrpar = det?.vlrins ?? 0;
    const vlrtot = vlrpar * qtdpar;
    const comiss = vlrtot * (comcom / 100);
    const comissVend = vlrtot * (comven / 100);

    form1.setFieldsValue({
      idLote: id, qtdxxx: qtdSugerida, vlrpar, vlrtot, vlrdes: 0,
      _comiss: comiss, _comissVend: comissVend,
    });
  };

  const recalcularValores = () => {
    if (!loteDetalhes) return;
    const vals  = form1.getFieldsValue();
    const qtd   = vals.qtdxxx || 1;
    const qtdpar = Number(loteDetalhes?.condicaoQtdpar ?? leilaoInfo?.qtdpar ?? 1);
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

  const abrirLoteSimplificado = async () => {
    formLoteSimp.resetFields();
    setVendedores([]);
    if (racas.length === 0) {
      const r = await api.get('/racas');
      setRacas(r.data.map((x: any) => ({ value: x.id, label: `${x.descricao}${x.especies ? ` (${x.especies})` : ''}`, especies: x.especies })));
    }
    setLoteSimpModal(true);
  };

  const buscarVendedores = (busca: string) => {
    clearTimeout(timerVend.current);
    if (busca.length < 2) { setVendedores([]); return; }
    timerVend.current = setTimeout(async () => {
      setLoadingVend(true);
      try {
        const r = await api.get('/clientes', { params: { nome: busca } });
        setVendedores(r.data.map((x: any) => ({ value: x.id, label: x.nomexx })));
      } catch {
        message.error('Erro ao buscar vendedor');
      } finally { setLoadingVend(false); }
    }, 350);
  };

  const criarLoteSimplificado = async () => {
    let vals;
    try { vals = await formLoteSimp.validateFields(); } catch { return; }
    const idLeilao = form0.getFieldValue('idLeilao');
    setSalvando(true);
    try {
      const r = await api.post('/lotes', { ...vals, idleilao: idLeilao });
      await carregarLotesDisp(idLeilao);
      form1.setFieldValue('idLote', r.data.id);
      onLoteChange(r.data.id);
      setLoteSimpModal(false);
      message.success('Lote cadastrado');
    } finally { setSalvando(false); }
  };

  const atualizarInformacoes = async () => {
    if (!movId) return;
    await api.post(`/vendas/${movId}/atualizar-info`);
    const rl = await api.get(`/vendas/${movId}/lote`);
    if (rl.data) setLoteDetalhes(rl.data);
    message.success('Informações atualizadas');
  };

  const salvarStep1 = async () => {
    let vals;
    try { vals = await form1.validateFields(); } catch { return; }
    if (!movId) return;

    // Aviso não bloqueante: o lote tem quantidade de animais cadastrada e o
    // usuário está lançando mais do que resta disponível (outras vendas já
    // consumiram parte). Só avisa — o usuário pode ter um motivo legítimo
    // pra prosseguir mesmo assim (ex.: correção de cadastro).
    if (loteDetalhes?.qtdRestante != null && vals.qtdxxx > loteDetalhes.qtdRestante) {
      message.warning(
        `Atenção: restam ${loteDetalhes.qtdRestante} animal(is) neste lote, mas ${vals.qtdxxx} foram informados.`,
        6,
      );
    }

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
        qtdpar: vals.qtdparOverride || leilaoInfo?.qtdpar || 1,
        comiss, comissVendedor: comissVend,
        datlan: datlei,
      });
      aplicarCondicaoPadraoLeilao();
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
        const r = await api.get('/clientes', { params: { nome: busca } });
        setClientes(r.data.map((c: any) => ({ value: c.id, label: c.nomexx })));
      } catch {
        message.error('Erro ao buscar comprador');
      } finally { setLoadingCli(false); }
    }, 350);
  };

  const onCondicaoChange = (id: number) => {
    const condicao = condicoes.find(c => c.id === id) ?? null;
    setCondicaoSel(condicao);
    if (condicao?.avista === 'S') {
      form2.setFieldValue('formaPagamento', undefined);
    }
  };

  // Pré-preenche a condição de pagamento do comprador com a condição
  // padrão cadastrada no leilão (Leiloes.condic), em vez de deixar o
  // Select em branco a cada novo comprador.
  const aplicarCondicaoPadraoLeilao = () => {
    if (!leilaoInfo?.condic) return;
    form2.setFieldValue('idCondPagto', leilaoInfo.condic);
    onCondicaoChange(leilaoInfo.condic);
  };

  const adicionarComprador = async () => {
    let vals;
    try { vals = await form2.validateFields(); } catch { return; }
    if (!movId) return;
    setSalvando(true);
    try {
      const payload = {
        idCli:           vals.idCli,
        idCondPagto:     vals.idCondPagto,
        percen:          vals.percen ?? 100,
        formaPagamento:  vals.formaPagamento,
        idPropriedade:   vals.idPropriedade ?? null,
        idPisteiro:      vals.idPisteiro ?? null,
        tipoDescontoFidelidade: vals.tipoDescontoFidelidade ?? null,
        descontoFidelidade:     vals.descontoFidelidade ?? 0,
      };
      if (compEditando) {
        await api.put(`/vendas/${movId}/compradores/${compEditando.id}`, payload);
        message.success('Comprador atualizado');
      } else {
        await api.post(`/vendas/${movId}/compradores`, payload);
        message.success('Comprador adicionado');
      }
      const rc = await api.get(`/vendas/${movId}/compradores`);
      setCompradores(rc.data);
      cancelarEdicaoComprador();
    } finally { setSalvando(false); }
  };

  const iniciarEdicaoComprador = (comp: any) => {
    setCompEditando(comp);
    setClientes([{ value: comp.idCli, label: comp.nomexx }]);
    onCondicaoChange(comp.idCondPagto);
    form2.setFieldsValue({
      idCli:          comp.idCli,
      idCondPagto:    comp.idCondPagto,
      percen:         comp.percen,
      formaPagamento: comp.formaPagamento,
      idPropriedade:  comp.idPropriedade,
      idPisteiro:     comp.idPisteiro,
      tipoDescontoFidelidade: comp.tipoDescontoFidelidade ?? null,
      descontoFidelidade:     comp.descontoFidelidade ?? 0,
    });
  };

  const cancelarEdicaoComprador = () => {
    setCompEditando(null);
    setCondicaoSel(null);
    setClientes([]);
    form2.resetFields(['idCli', 'idCondPagto', 'percen', 'formaPagamento', 'idPropriedade', 'idPisteiro', 'tipoDescontoFidelidade', 'descontoFidelidade']);
    aplicarCondicaoPadraoLeilao();
  };

  const abrirComissaoManual = (comp: any) => {
    setComissaoAlvo(comp);
    formComissao.setFieldsValue({
      valorComissao: comp.valorComissao ?? 0,
      valorComissaoVendedor: comp.valorComissaoVendedor ?? 0,
    });
    setComissaoModal(true);
  };

  const salvarComissaoManual = async () => {
    let vals;
    try { vals = await formComissao.validateFields(); } catch { return; }
    if (!comissaoAlvo || !movId) return;
    await api.put(`/vendas/${movId}/compradores/${comissaoAlvo.id}/comissao`, vals);
    const rc = await api.get(`/vendas/${movId}/compradores`);
    setCompradores(rc.data);
    setComissaoModal(false);
    message.success('Comissão atualizada');
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

  const colsCompradores: any[] = [
    { title: 'Comprador', dataIndex: 'nomexx', ellipsis: true },
    { title: 'Condição', dataIndex: 'desfin', width: 180, ellipsis: true },
    { title: '%', dataIndex: 'percen', width: 60, render: (v: number) => `${v}%` },
    { title: 'Forma Pag.', dataIndex: 'formaPagamento', width: 120, render: (v: string) => FORMA_PAGAMENTO_LABEL[v] || v },
    {
      title: 'Vlr. a Pagar', dataIndex: 'valorPagar', width: 120, align: 'right' as const,
      render: fmt,
    },
    {
      title: 'Desc. Fidelidade', dataIndex: 'valorDescontoFidelidade', width: 130, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="danger">- {fmt(v)}</Text> : '—',
    },
    {
      title: 'Comissão', dataIndex: 'valorComissao', width: 130, align: 'right' as const,
      render: (v: number, row: any) => (
        <Space size={4}>
          <Text type="warning">{fmt(v)}</Text>
          <Tooltip title="Sobrepor comissão manualmente">
            <Button size="small" icon={<PercentageOutlined />} onClick={() => abrirComissaoManual(row)} />
          </Tooltip>
        </Space>
      ),
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
      title: 'Pisteiro', dataIndex: 'nomePisteiro', width: 130, ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span>,
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
      title: '', width: 110, fixed: 'right' as const,
      render: (_: any, row: any) => (
        <Space size={4}>
          <Tooltip title="Editar comprador">
            <Button size="small" icon={<EditOutlined />} onClick={() => iniciarEdicaoComprador(row)} />
          </Tooltip>
          <Popconfirm title="Remover este comprador?" onConfirm={() => removerComprador(row.id)}
            okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── render ───────────────────────────────────────────────────────────────

  const canAvancar = () => {
    if (step === 2) return compradores.length > 0;
    return true;
  };

  const avancarStep2 = async () => {
    if (!canAvancar() || !movId) return;
    const rp = await api.get(`/vendas/${movId}/parcelas`);
    setParcelas(rp.data);
    setStep(3);
  };

  useEffect(() => {
    const modalAberto = loteSimpModal || comissaoModal || modalProps;
    const onKeyDown = (e: KeyboardEvent) => {
      if (modalAberto) return;
      const alvo = e.target as HTMLElement;
      const emCampo = ['INPUT', 'TEXTAREA'].includes(alvo?.tagName) || alvo?.isContentEditable;
      if (emCampo) return;

      if (e.key === 'F9') {
        e.preventDefault();
        if (step === 0) salvarStep0();
        else if (step === 1) salvarStep1();
        else if (step === 2) avancarStep2();
        else if (step === 3) onConcluir();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (step === 1) setStep(0);
        else if (step === 2) setStep(1);
        else if (step === 3) setStep(2);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (step === 0) onCancelar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, movId, loteSimpModal, comissaoModal, modalProps, compradores]);

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
          <Form form={form0} layout="vertical" style={{ maxWidth: 600 }} initialValues={{ defesa: true }}>
            <Form.Item name="idLeilao" label="Leilão"
              rules={[{ required: true, message: 'Selecione o leilão' }]}>
              <Select showSearch placeholder="Digite para buscar o leilão..." options={leiloes}
                onChange={onLeilaoChange} onSearch={buscarLeiloes}
                filterOption={false} loading={carregandoLeiloes}
                notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'} />
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
            <Form.Item name="defesa" valuePropName="checked">
              <Checkbox>Vendido</Checkbox>
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
                  <Text type="secondary">{labelSBB(loteDetalhes.especies)} / {labelRP(loteDetalhes.especies)}</Text>
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
              <Col xs={24} sm={24}>
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

              <Col xs={24} sm={12} md={4}>
                <Form.Item name="qtdparOverride" label="Qtd. Parcelas"
                  tooltip="Sobrepõe a qtd. de parcelas padrão do leilão para este lote/venda">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder={String(leilaoInfo?.qtdpar ?? 1)} />
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
            <Space>
              {movId && (
                <Tooltip title="Sincroniza o vendedor gravado nesta venda com o cadastro atual do lote">
                  <Button icon={<SyncOutlined />} onClick={atualizarInformacoes}>
                    Atualizar Informações
                  </Button>
                </Tooltip>
              )}
              <Button type="primary" icon={<ArrowRightOutlined />}
                loading={salvando} onClick={salvarStep1}>
                Próximo
              </Button>
            </Space>
          </Row>

          {/* Modal Lote Simplificado */}
          <Modal
            title="Cadastrar novo lote" open={loteSimpModal}
            onCancel={() => setLoteSimpModal(false)}
            onOk={criarLoteSimplificado} okText="Salvar" confirmLoading={salvando}
          >
            <Form form={formLoteSimp} layout="vertical">
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="lotexx" label="Nº Lote" rules={[{ required: true, message: 'Informe o número do lote' }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="catego" label="Categoria">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="deslot" label="Descrição">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="racaxx" label="Raça">
                    <Select showSearch options={racas} allowClear
                      filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="codven" label="Vendedor">
                    <Select showSearch options={vendedores} allowClear
                      filterOption={false} onSearch={buscarVendedores} loading={loadingVend}
                      notFoundContent={loadingVend ? <Spin size="small" /> : 'Digite 2+ letras'} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="rpxxx" label={labelRP(racas.find(r => r.value === racaxxLoteSimp)?.especies)}><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="sbbxxx" label={labelSBB(racas.find(r => r.value === racaxxLoteSimp)?.especies)}><Input /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="pesoxx" label="Peso"><InputNumber style={{ width: '100%' }} /></Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>
        </Card>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <Card title="Compradores">
          {/* formulário add comprador */}
          <Card size="small" title={compEditando ? `Editando comprador — ${compEditando.nomexx}` : 'Adicionar comprador'} style={{ marginBottom: 16 }}>
            <Form form={form2} layout="vertical">
              <Row gutter={[12, 0]}>
                <Col xs={24} md={7}>
                  <Form.Item name="idCli" label="Comprador"
                    rules={[{ required: true, message: 'Selecione o comprador' }]}>
                    <Select
                      showSearch filterOption={false} placeholder="Digite para buscar..."
                      options={clientes} loading={loadingCli} onSearch={buscarClientes}
                      disabled={!!compEditando}
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
                <Col xs={24} sm={12} md={5}>
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
                    rules={[{ required: condicaoSel?.avista !== 'S' }]} initialValue="PROMISSORIA">
                    <Select options={FORMA_PAGAMENTO_OPTS} disabled={condicaoSel?.avista === 'S'}
                      placeholder={condicaoSel?.avista === 'S' ? 'Não se aplica (à vista)' : undefined} />
                  </Form.Item>
                </Col>
                {pisteiros.length > 0 && (
                  <Col xs={24} sm={12} md={5}>
                    <Form.Item name="idPisteiro" label="Pisteiro">
                      <Select options={pisteiros} allowClear placeholder="Opcional..."
                        showSearch filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="tipoDescontoFidelidade" label="Desconto Fidelidade" initialValue={null}>
                    <Select allowClear placeholder="Nenhum"
                      options={[{ value: 'P', label: '% Percentual' }, { value: 'V', label: 'R$ Valor' }]} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="descontoFidelidade" label="Valor" initialValue={0}>
                    <InputNumber min={0} step={1} style={{ width: '100%' }}
                      disabled={!tipoDescontoFidelidadeSel}
                      formatter={v => tipoDescontoFidelidadeSel === 'P' ? `${v}%` : `R$ ${v}`}
                      parser={v => Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')) as any} />
                  </Form.Item>
                </Col>
              </Row>

              <Row justify="end" style={{ marginTop: 4 }}>
                <Space>
                  {compEditando && (
                    <Button onClick={cancelarEdicaoComprador}>Cancelar</Button>
                  )}
                  <Button type="primary" icon={compEditando ? <EditOutlined /> : <PlusOutlined />}
                    loading={salvando} onClick={adicionarComprador}>
                    {compEditando ? 'Salvar' : 'Adicionar'}
                  </Button>
                </Space>
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

          {/* Modal comissão manual */}
          <Modal
            title={`Sobrepor comissão${comissaoAlvo ? ` — ${comissaoAlvo.nomexx}` : ''}`}
            open={comissaoModal} onCancel={() => setComissaoModal(false)}
            onOk={salvarComissaoManual} okText="Salvar"
          >
            <Form form={formComissao} layout="vertical">
              <Form.Item name="valorComissao" label="Valor Comissão (Comprador/Leiloeiro)">
                <InputNumber<number> min={0} step={100} style={{ width: '100%' }}
                  formatter={v => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                  parser={v => Number(String(v ?? '').replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0} />
              </Form.Item>
              <Form.Item name="valorComissaoVendedor" label="Valor Comissão Vendedor">
                <InputNumber<number> min={0} step={100} style={{ width: '100%' }}
                  formatter={v => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                  parser={v => Number(String(v ?? '').replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0} />
              </Form.Item>
            </Form>
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
                                  defaultValue={dataUTC(v)!}
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
                                style={{ cursor: 'pointer', color: dataUTC(v)!.isBefore(dayjs()) ? '#ff4d4f' : undefined }}
                                onClick={() => { editingValRef.current = dataUTC(v)!; setEditingParc({ id: row.id, field: 'datven', value: dataUTC(v)! }); }}
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
  const [origemClienteId, setOrigemClienteId] = useState<number | undefined>();
  const [leilaoInicial, setLeilaoInicial] = useState<{ id: number; nome: string } | undefined>();
  const location = useLocation();
  const navigate = useNavigate();
  const { banco } = useBanco();

  // Estado do filtro da Listagem vive aqui (no componente pai) e não dentro
  // de Listagem — o pai alterna entre <Wizard> e <Listagem> com returns
  // diferentes, o que desmonta Listagem por completo a cada troca de modo.
  // Se o filtro ficasse como estado local de Listagem, ele se perdia toda
  // vez que o usuário abria o wizard (Nova Venda/Editar) e voltava.
  const filtroSalvo = lerFiltroPersistido(banco, 'vendas', {
    tipoBusca: 'todos', busca: '', idLeilao: undefined as number | undefined, jaBuscou: false,
  });
  const [tipoBusca, setTipoBusca] = useState(filtroSalvo.tipoBusca);
  const [busca, setBusca]         = useState(filtroSalvo.busca);
  const { opcoes: leiloes, carregando: carregandoLeiloes, buscar: buscarLeiloes, garantirOpcao: garantirOpcaoLeilao } = useBuscaLeiloes();
  const [idLeilao, setIdLeilao]   = useState<number | undefined>(filtroSalvo.idLeilao);
  const [dados, setDados]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [jaBuscou, setJaBuscou]   = useState(false);

  const carregar = async () => {
    setLoading(true);
    setJaBuscou(true);
    try {
      salvarFiltroPersistido(banco, 'vendas', { tipoBusca, busca, idLeilao, jaBuscou: true });
      const params: any = { tipoBusca };
      if (busca)    params.busca    = busca;
      if (idLeilao) params.idLeilao = idLeilao;
      const r = await api.get('/vendas', { params });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = (location.state as any)?.abrirVendaId;
    const clienteId = (location.state as any)?.origemClienteId;
    if (id) {
      setEditId(id);
      setModo('wizard');
      if (clienteId) setOrigemClienteId(clienteId);
      window.history.replaceState({}, document.title);
    }
    // Restaura o resultado da última busca ao remontar (troca de aba) — só
    // se o usuário já tinha buscado algo antes (senão mantém a tela vazia
    // com a mensagem "escolha um filtro e clique em Buscar").
    if (filtroSalvo.jaBuscou) {
      if (filtroSalvo.idLeilao) {
        api.get(`/leiloes/${filtroSalvo.idLeilao}`).then(r => garantirOpcaoLeilao(r.data.id, r.data.leilao)).catch(() => {});
      }
      carregar();
    }
  }, []);

  const abrirNova = (leilaoAtual?: { id: number; nome: string }) => {
    setEditId(undefined); setLeilaoInicial(leilaoAtual); setModo('wizard');
  };
  const abrirEdit = (id: number) => { setEditId(id); setModo('wizard'); };
  const voltar = () => {
    if (origemClienteId) {
      navigate(`/${banco}/clientes`, { state: { abrirClienteId: origemClienteId } });
      return;
    }
    setModo('listagem'); setEditId(undefined);
    // Recarrega mantendo o filtro aplicado (dados/filtro vivem neste
    // componente, não são perdidos — só precisa buscar de novo se o
    // usuário já tinha feito alguma busca antes de abrir o wizard).
    if (jaBuscou) carregar();
  };

  if (modo === 'wizard') {
    return (
      <Wizard
        key={editId ?? 'novo'}
        editId={editId}
        leilaoInicial={leilaoInicial}
        onConcluir={voltar}
        onCancelar={voltar}
      />
    );
  }

  return (
    <Listagem
      onNova={abrirNova} onEditar={abrirEdit}
      tipoBusca={tipoBusca} setTipoBusca={setTipoBusca}
      busca={busca} setBusca={setBusca}
      idLeilao={idLeilao} setIdLeilao={setIdLeilao}
      leiloes={leiloes} carregandoLeiloes={carregandoLeiloes} buscarLeiloes={buscarLeiloes}
      dados={dados} setDados={setDados}
      loading={loading} jaBuscou={jaBuscou} setJaBuscou={setJaBuscou}
      carregar={carregar}
    />
  );
}
