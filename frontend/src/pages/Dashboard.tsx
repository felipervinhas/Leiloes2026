import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Spin, Typography, Tag, Progress, Empty, Badge, Drawer, Button, message, Popconfirm, List, Collapse, Tooltip } from 'antd';
import {
  DollarOutlined, TrophyOutlined, TeamOutlined, CalendarOutlined,
  RiseOutlined, BarChartOutlined, FieldTimeOutlined, TagsOutlined,
  UserAddOutlined, CheckOutlined, CloseOutlined, EditOutlined,
  WarningOutlined, DeleteOutlined, ShoppingCartOutlined, TagOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useBanco } from '../context/BancoContext';
import api from '../services/api';

const { Title, Text } = Typography;

const fmtR = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}M`
    : v >= 1_000
    ? `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}k`
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const fmtFull = (v: number) =>
  `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const CHART_COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f759ab', '#722ed1', '#13c2c2'];
const MEDAL = ['🥇', '🥈', '🥉', '4º', '5º'];

interface DashData {
  kpis: {
    totalGeral: number; comissaoGeral: number; liquidoGeral: number;
    totalCompradores: number; totalVendas: number; totalLeiloes: number;
    totalLotesCad: number; parcProximas: number; valorParcProximas: number;
  };
  ultimoLeilao: {
    id: number; nome: string; data: string;
    valorTotal: number; comissao: number; liquido: number;
    vendas: number; totalLotes: number;
  } | null;
  historico: {
    nome: string; nomeCompleto: string; periodo: string; data: string;
    valorTotal: number; comissao: number; liquido: number;
    vendas: number; totalLotes: number;
  }[];
  categorias: { id: number | null; nome: string; vendas: number; valorTotal: number }[];
  topRacas: { raca: string; vendas: number; valorTotal: number }[];
  vencimentos: {
    comprador: string; ordxxx: string; vencimento: string;
    valor: number; lotexx: string; deslot: string; leilao: string;
  }[];
  permissoes?: {
    idUsuario: number;
    verComissoes: string;
    verValoresLiquidos: string;
    verInfoFinanceira: string;
    verTopCompradores: string;
    verTopVendedores: string;
    verVencimentos: string;
  };
}

interface TopsPorCategoria {
  topCompradores: { pos: number; id: number; nome: string; compras: number; valorTotal: number; valorLiq: number }[];
  topVendedores: { pos: number; id: number; nome: string; vendas: number; valorTotal: number; valorLiq: number }[];
}

interface CadastroIncompleto {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  celular: string;
  camposVazios: number;
  totalCampos: number;
  pctVazio: number;
  totalCompras: number;
  totalVendas: number;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

// Função auxiliar para mascarar valor baseado em permissão
const mascararSePreciso = (valor: number, pode: string | undefined): number | string => {
  if (!pode || pode !== 'S') return '[RESTRITO]';
  return valor;
};

const fmtComRestricao = (valor: number, pode: string | undefined): string => {
  const resultado = mascararSePreciso(valor, pode);
  if (resultado === '[RESTRITO]') return resultado;
  return fmtR(resultado as number);
};

function KpiCard({
  icon, label, value, sub, color, loading,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: string; loading?: boolean;
}) {
  return (
    <Card
      style={{
        borderRadius: 12,
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        borderColor: `${color}30`,
        height: '100%',
      }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      {loading ? (
        <Spin />
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: color, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
              boxShadow: `0 4px 14px ${color}55`,
            }}
          >
            <span style={{ fontSize: 22, color: '#fff' }}>{icon}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </Text>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#141414', lineHeight: 1.2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {value}
            </div>
            {sub && (
              <Text style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2, display: 'block' }}>{sub}</Text>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Tooltip customizado para o BarChart ─────────────────────────────────────
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ fontSize: 11, color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtFull(p.value)}
        </div>
      ))}
    </div>
  );
}

// ─── Tooltip customizado para o PieChart ─────────────────────────────────────
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 3 }}>{d.name}</div>
      <div style={{ fontSize: 11, color: '#555' }}>{fmtFull(d.value)}</div>
      <div style={{ fontSize: 11, color: '#999' }}>{d.payload.vendas} venda{d.payload.vendas !== 1 ? 's' : ''}</div>
    </div>
  );
}

// ─── Active shape para o donut ────────────────────────────────────────────────
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Dashboard() {
  const { banco } = useBanco();
  const navigate = useNavigate();
  const [data, setData]     = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pieActive, setPieActive] = useState(0);

  const [selectedCategoria, setSelectedCategoria] = useState<number | undefined>(undefined);
  const [topsPorCategoria, setTopsPorCategoria] = useState<TopsPorCategoria | null>(null);
  const [topsCategoryLoading, setTopsCategoryLoading] = useState(false);

  const [pendentesCount, setPendentesCount] = useState(0);

  const [cadastrosIncompletos, setCadastrosIncompletos] = useState<CadastroIncompleto[]>([]);
  const [incompletosLoading, setIncompletosLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendentes, setPendentes]           = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [drawerLoading, setDrawerLoading]   = useState(false);
  const [actionId, setActionId]             = useState<number | null>(null);

  useEffect(() => {
    if (!banco) return;
    setLoading(true);
    api.get(`/${banco}/dashboard`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [banco]);

  useEffect(() => {
    if (!banco) return;
    const poll = async () => {
      try {
        const r = await api.get(`/${banco}/clientes/pendentes/count`);
        setPendentesCount(r.data.total);
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 60_000);
    return () => clearInterval(timer);
  }, [banco]);

  useEffect(() => {
    if (!banco) return;
    setIncompletosLoading(true);
    api.get(`/${banco}/dashboard/cadastros-incompletos`)
      .then(r => setCadastrosIncompletos(r.data))
      .catch(() => setCadastrosIncompletos([]))
      .finally(() => setIncompletosLoading(false));
  }, [banco]);

  const excluirClienteIncompleto = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/${banco}/clientes/${id}`);
      message.success('Cliente excluído com sucesso');
      setCadastrosIncompletos(prev => prev.filter(c => c.id !== id));
    } catch {
      message.error('Erro ao excluir cliente');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!banco || !data || data.categorias.length === 0) return;
    
    // Define categoria padrão como primeira categoria se não houver selecionada
    if (!selectedCategoria) {
      setSelectedCategoria(data.categorias[0].id ?? undefined);
      return;
    }
  }, [data, banco, selectedCategoria]);

  useEffect(() => {
    if (!banco || !selectedCategoria) return;
    
    setTopsCategoryLoading(true);
    api.get(`/${banco}/dashboard/tops-categoria`, { params: { categoria: selectedCategoria } })
      .then(r => setTopsPorCategoria(r.data))
      .catch(() => setTopsPorCategoria(null))
      .finally(() => setTopsCategoryLoading(false));
  }, [banco, selectedCategoria]);

  const abrirDrawer = async () => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const r = await api.get(`/${banco}/clientes/pendentes`);
      setPendentes(r.data);
      setPendentesCount(r.data.length);
    } catch {
      message.error('Erro ao carregar cadastros pendentes');
    } finally {
      setDrawerLoading(false);
    }
  };

  const aprovar = async (id: number) => {
    setActionId(id);
    try {
      await api.patch(`/${banco}/clientes/${id}/aprovar`);
      message.success('Cliente aprovado com sucesso');
      const novos = pendentes.filter(c => c.id !== id);
      setPendentes(novos);
      setPendentesCount(novos.length);
    } catch {
      message.error('Erro ao aprovar cliente');
    } finally {
      setActionId(null);
    }
  };

  const recusar = async (id: number) => {
    setActionId(id);
    try {
      await api.patch(`/${banco}/clientes/${id}/recusar`);
      message.warning('Cadastro recusado');
      const novos = pendentes.filter(c => c.id !== id);
      setPendentes(novos);
      setPendentesCount(novos.length);
    } catch {
      message.error('Erro ao recusar cliente');
    } finally {
      setActionId(null);
    }
  };

  const analisar = async (id: number) => {
    setActionId(id);
    try {
      await api.patch(`/${banco}/clientes/${id}/analisar`);
      message.info('Cadastro marcado como "Em Análise"');
      const novos = pendentes.filter(c => c.id !== id);
      setPendentes(novos);
      setPendentesCount(novos.length);
    } catch {
      message.error('Erro ao analisar cliente');
    } finally {
      setActionId(null);
    }
  };

  const k = data?.kpis;
  const ul = data?.ultimoLeilao;
  const permissoes = data?.permissoes;

  // Calcular % vendidos do último leilão
  const pctVendidos = ul && ul.totalLotes > 0
    ? Math.round((ul.vendas / ul.totalLotes) * 100)
    : 0;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* ── Título ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#001529' }}>
            <BarChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Dashboard
          </Title>
          {ul && (
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
              Último leilão: <strong>{ul.nome}</strong> em {ul.data}
            </Text>
          )}
        </div>
        {loading && <Spin />}
      </div>

      {/* ── Cadastros pendentes (Site/App) ──────────────────────────────── */}
      {pendentesCount > 0 && (
        <Card
          style={{
            borderRadius: 12, marginBottom: 14, cursor: 'pointer',
            background: 'linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%)',
            borderColor: '#ffc53d',
          }}
          styles={{ body: { padding: '12px 20px' } }}
          onClick={abrirDrawer}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Badge count={pendentesCount} color="#fa8c16" offset={[-4, 4]}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(250,140,22,0.35)',
              }}>
                <UserAddOutlined style={{ fontSize: 22, color: '#fff' }} />
              </div>
            </Badge>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#d46b08' }}>
                {pendentesCount} cadastro{pendentesCount !== 1 ? 's' : ''} aguardando aprovação
              </div>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                Clientes registrados pelo Site / App — clique para revisar
              </Text>
            </div>
            <Button
              type="primary"
              size="small"
              style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
              onClick={e => { e.stopPropagation(); abrirDrawer(); }}
            >
              Revisar
            </Button>
          </div>
        </Card>
      )}

      {/* ── KPIs principais ─────────────────────────────────────────────── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<DollarOutlined />}
            label="Total Arrecadado"
            value={loading ? '...' : fmtR(k?.totalGeral ?? 0)}
            sub={`${k?.totalVendas ?? 0} venda${(k?.totalVendas ?? 0) !== 1 ? 's' : ''}`}
            color="#1677ff"
            loading={loading}
          />
        </Col>
        {(!permissoes || permissoes.verComissoes === 'S') && (
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<RiseOutlined />}
            label="Comissões Totais"
            value={loading ? '...' : fmtR(k?.comissaoGeral ?? 0)}
            sub={(!permissoes || permissoes.verValoresLiquidos === 'S') ? `Líquido: ${loading ? '...' : fmtR(k?.liquidoGeral ?? 0)}` : undefined}
            color="#52c41a"
            loading={loading}
          />
        </Col>
        )}
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<TeamOutlined />}
            label="Compradores"
            value={loading ? '...' : String(k?.totalCompradores ?? 0)}
            sub={`${k?.totalLeiloes ?? 0} leilões · ${k?.totalLotesCad ?? 0} lotes cad.`}
            color="#722ed1"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={<FieldTimeOutlined />}
            label="Vencimentos (45 dias)"
            value={loading ? '...' : fmtR(k?.valorParcProximas ?? 0)}
            sub={`${k?.parcProximas ?? 0} parcela${(k?.parcProximas ?? 0) !== 1 ? 's' : ''} a vencer`}
            color={loading ? '#fa8c16' : (k?.parcProximas ?? 0) > 0 ? '#fa8c16' : '#52c41a'}
            loading={loading}
          />
        </Col>
      </Row>

      {/* ── Último leilão — barra de progresso ──────────────────────────── */}
      {ul && (
        <Card
          style={{ borderRadius: 12, marginBottom: 14, background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)', border: 'none' }}
          styles={{ body: { padding: '14px 20px' } }}
        >
          <Row gutter={[16, 8]} align="middle">
            <Col flex="auto">
              <Text style={{ color: '#a0b4c8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Último Leilão
              </Text>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{ul.nome}</div>
              <Progress
                percent={pctVendidos}
                strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                trailColor='rgba(255,255,255,0.15)'
                format={p => <span style={{ color: '#fff', fontSize: 11 }}>{p}%</span>}
              />
              <Text style={{ color: '#a0b4c8', fontSize: 11 }}>
                {ul.vendas} de {ul.totalLotes} lotes vendidos
              </Text>
            </Col>
            <Col>
              <div style={{ textAlign: 'right' }}>
                <Text style={{ color: '#a0b4c8', fontSize: 10, display: 'block' }}>Total Arrecadado</Text>
                <div style={{ color: '#ffc53d', fontSize: 20, fontWeight: 700 }}>{fmtFull(ul.valorTotal)}</div>
              </div>
            </Col>
            <Col>
              <div style={{ textAlign: 'right' }}>
                <Text style={{ color: '#a0b4c8', fontSize: 10, display: 'block' }}>Comissão</Text>
                <div style={{ color: '#95f560', fontSize: 16, fontWeight: 700 }}>{fmtFull(ul.comissao)}</div>
              </div>
            </Col>
            <Col>
              <div style={{ textAlign: 'right' }}>
                <Text style={{ color: '#a0b4c8', fontSize: 10, display: 'block' }}>Líquido</Text>
                <div style={{ color: '#40a9ff', fontSize: 16, fontWeight: 700 }}>{fmtFull(ul.liquido)}</div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* ── Gráficos ────────────────────────────────────────────────────── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        {/* Bar chart — histórico */}
        <Col xs={24} lg={15}>
          <Card
            title={<span><BarChartOutlined style={{ marginRight: 6, color: '#1677ff' }} />Histórico de Leilões</span>}
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { paddingTop: 8 } }}
          >
            {loading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : !data?.historico.length ? (
              <Empty description="Sem dados" style={{ height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.historico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="periodo"
                    tick={{ fontSize: 11, fill: '#8c8c8c' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#8c8c8c' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    width={52}
                  />
                  <RTooltip content={<BarTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={v => v === 'valorTotal' ? 'Total' : v === 'comissao' ? 'Comissão' : 'Líquido'}
                  />
                  <Bar dataKey="valorTotal" name="valorTotal" fill="#1677ff" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="comissao"   name="comissao"   fill="#52c41a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="liquido"    name="liquido"    fill="#722ed1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* Donut — raças */}
        <Col xs={24} lg={9}>
          <Card
            title={<span><TagsOutlined style={{ marginRight: 6, color: '#fa8c16' }} />Top Raças por Valor</span>}
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { paddingTop: 8 } }}
          >
            {loading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : !data || !data.topRacas || data.topRacas.length === 0 ? (
              <Empty description="Sem dados" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <PieChart width={260} height={180} style={{ margin: '0 auto' }}>
                  <Pie
                    data={data.topRacas}
                    dataKey="valorTotal"
                    nameKey="raca"
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={80}
                    paddingAngle={2}
                    onMouseEnter={(_: any, i: number) => setPieActive(i)}
                  >
                    {data.topRacas.map((entry: any, i: number) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        stroke={i === pieActive ? '#fff' : 'none'}
                        strokeWidth={i === pieActive ? 2 : 0}
                        style={{ filter: i === pieActive ? 'brightness(1.15)' : 'none' }}
                      />
                    ))}
                  </Pie>
                  <RTooltip content={<PieTooltip />} />
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {data.topRacas.map((r: any, i: number) => {
                    const total = data.topRacas.reduce((s: number, x: any) => s + x.valorTotal, 0);
                    const pct   = total > 0 ? Math.round((r.valorTotal / total) * 100) : 0;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        onMouseEnter={() => setPieActive(i)}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                        <Text style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.raca}</Text>
                        <Text style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 4 }}>{pct}%</Text>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Listas ──────────────────────────────────────────────────────── */}
      <Row gutter={[14, 14]}>
        {/* Selector de Categorias */}
        {data?.categorias && data.categorias.length > 0 && (
          <Col xs={24}>
            <Card
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#001529' }}>Filtrar por Categoria:</span>
                {data.categorias.map((cat) => (
                  <Button
                    key={cat.id}
                    type={selectedCategoria === cat.id ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setSelectedCategoria(cat.id ?? undefined)}
                    style={{
                      borderRadius: 6,
                    }}
                  >
                    {cat.nome}
                  </Button>
                ))}
              </div>
            </Card>
          </Col>
        )}

        {/* Top Compradores */}
        {(!permissoes || permissoes.verTopCompradores === 'S') && (
        <Col xs={24} lg={12}>
          <Card
            title={<span><TrophyOutlined style={{ marginRight: 6, color: '#ffc53d' }} />Top Compradores</span>}
            style={{ borderRadius: 12 }}
            styles={{ body: { padding: '8px 16px 16px' } }}
          >
            {topsCategoryLoading ? <Spin style={{ margin: '20px auto', display: 'block' }} />
              : !topsPorCategoria?.topCompradores.length ? <Empty description="Sem dados" />
              : topsPorCategoria.topCompradores.map((c, i) => {
                const maxVal = topsPorCategoria.topCompradores[0].valorTotal;
                const pct = maxVal > 0 ? (c.valorTotal / maxVal) * 100 : 0;
                return (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < topsPorCategoria.topCompradores.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                        {MEDAL[i]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.nome}
                        </div>
                        <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                          {c.compras} compra{c.compras !== 1 ? 's' : ''}
                        </Text>
                      </div>
                      {(!permissoes || permissoes.verValoresLiquidos === 'S') && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1677ff' }}>
                          {fmtR(c.valorTotal)}
                        </div>
                        <Text style={{ fontSize: 10, color: '#8c8c8c' }}>liq. {fmtR(c.valorLiq)}</Text>
                      </div>
                      )}
                    </div>
                    <Progress
                      percent={Math.round(pct)}
                      showInfo={false}
                      strokeColor={CHART_COLORS[i % CHART_COLORS.length]}
                      trailColor="#f5f5f5"
                      size="small"
                    />
                  </div>
                );
              })}
          </Card>
        </Col>
        )}

        {/* Top Vendedores */}
        {(!permissoes || permissoes.verTopVendedores === 'S') && (
        <Col xs={24} lg={12}>
          <Card
            title={<span><TrophyOutlined style={{ marginRight: 6, color: '#13c2c2' }} />Top Vendedores</span>}
            style={{ borderRadius: 12 }}
            styles={{ body: { padding: '8px 16px 16px' } }}
          >
            {topsCategoryLoading ? <Spin style={{ margin: '20px auto', display: 'block' }} />
              : !topsPorCategoria?.topVendedores.length ? <Empty description="Sem dados" />
              : topsPorCategoria.topVendedores.map((v, i) => {
                const maxVal = topsPorCategoria.topVendedores[0].valorTotal;
                const pct = maxVal > 0 ? (v.valorTotal / maxVal) * 100 : 0;
                return (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < topsPorCategoria.topVendedores.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                        {MEDAL[i]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.nome}
                        </div>
                        <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                          {v.vendas} venda{v.vendas !== 1 ? 's' : ''}
                        </Text>
                      </div>
                      {(!permissoes || permissoes.verValoresLiquidos === 'S') && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#13c2c2' }}>
                          {fmtR(v.valorTotal)}
                        </div>
                        <Text style={{ fontSize: 10, color: '#8c8c8c' }}>liq. {fmtR(v.valorLiq)}</Text>
                      </div>
                      )}
                    </div>
                    <Progress
                      percent={Math.round(pct)}
                      showInfo={false}
                      strokeColor="#13c2c2"
                      trailColor="#f5f5f5"
                      size="small"
                    />
                  </div>
                );
              })}
          </Card>
        </Col>
        )}

        {/* Próximos vencimentos */}
        {(!permissoes || permissoes.verVencimentos === 'S') && (
        <Col xs={24} lg={24}>
          <Card
            title={<span><CalendarOutlined style={{ marginRight: 6, color: '#fa8c16' }} />Próximos Vencimentos</span>}
            style={{ borderRadius: 12 }}
            styles={{ body: { padding: '8px 16px 16px' } }}
            extra={
              k?.parcProximas ? (
                <Tag color="orange">{k.parcProximas} parcela{k.parcProximas !== 1 ? 's' : ''} em 45 dias</Tag>
              ) : null
            }
          >
            {loading ? <Spin style={{ margin: '20px auto', display: 'block' }} />
              : !data?.vencimentos.length
              ? <Empty description="Sem vencimentos nos próximos 45 dias" />
              : data.vencimentos.map((v, i) => {
                const [d, m] = v.vencimento.split('/');
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                    borderBottom: i < data.vencimentos.length - 1 ? '1px solid #f5f5f5' : 'none',
                  }}>
                    {/* Calendário mini */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(250,140,22,0.4)',
                    }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>{d}</span>
                      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9, lineHeight: 1 }}>{m}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.comprador}
                      </div>
                      <Text style={{ fontSize: 10, color: '#8c8c8c' }}>
                        Lote {v.lotexx} · {v.deslot?.substring(0, 22)}{(v.deslot?.length ?? 0) > 22 ? '…' : ''}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#fa8c16' }}>
                        {fmtFull(v.valor)}
                      </div>
                      <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{v.ordxxx}</Text>
                    </div>
                  </div>
                );
              })}
          </Card>
        </Col>
        )}
      </Row>

      {/* ── Cadastros incompletos (>70% vazio) ─────────────────────────── */}
      <Collapse
        style={{ borderRadius: 12, marginBottom: 14, borderColor: '#ff7875' }}
        items={[{
          key: '1',
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WarningOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
              <span style={{ fontWeight: 700, color: '#cf1322', fontSize: 14 }}>
                Cadastros Incompletos
              </span>
              {incompletosLoading ? (
                <Spin size="small" />
              ) : (
                <Tag color="red">{cadastrosIncompletos.length}</Tag>
              )}
              <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>
                — clientes ativos com mais de 70% dos campos não preenchidos
              </span>
            </div>
          ),
          children: incompletosLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : cadastrosIncompletos.length === 0 ? (
            <Empty description="Nenhum cadastro com mais de 70% incompleto" style={{ padding: 16 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cadastrosIncompletos.map(c => {
                const pctPreenchido = 100 - c.pctVazio;
                const cor = pctPreenchido <= 20 ? '#ff4d4f' : pctPreenchido <= 40 ? '#fa8c16' : '#fadb14';
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '10px 14px', borderRadius: 8,
                      background: '#fff7f7', border: '1px solid #ffd6d6',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 15,
                    }}>
                      {(c.nome || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.nome}
                        {c.cpf && (
                          <Text style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 8, fontWeight: 400 }}>
                            {c.cpf}
                          </Text>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>
                        {c.email || c.celular || 'Sem contato cadastrado'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Tag
                          icon={<ShoppingCartOutlined />}
                          color={c.totalCompras > 0 ? 'blue' : 'default'}
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          {c.totalCompras > 0 ? `${c.totalCompras} compra${c.totalCompras !== 1 ? 's' : ''}` : 'Sem compras'}
                        </Tag>
                        <Tag
                          icon={<TagOutlined />}
                          color={c.totalVendas > 0 ? 'green' : 'default'}
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          {c.totalVendas > 0 ? `${c.totalVendas} venda${c.totalVendas !== 1 ? 's' : ''}` : 'Sem vendas'}
                        </Tag>
                      </div>
                      <Tooltip title={`${c.camposVazios} de ${c.totalCampos} campos vazios`}>
                        <Progress
                          percent={pctPreenchido}
                          size="small"
                          strokeColor={cor}
                          format={p => <span style={{ fontSize: 10 }}>{p}% preenchido</span>}
                        />
                      </Tooltip>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => navigate(`/${banco}/clientes`)}
                      >
                        Editar
                      </Button>
                      {c.totalCompras === 0 && c.totalVendas === 0 && (
                        <Popconfirm
                          title="Excluir cliente?"
                          description="Este cliente não possui compras nem vendas e será removido permanentemente."
                          onConfirm={() => excluirClienteIncompleto(c.id)}
                          okText="Excluir"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancelar"
                        >
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            loading={deletingId === c.id}
                          >
                            Excluir
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        }]}
      />

      {/* ── Drawer: cadastros pendentes ─────────────────────────────────── */}
      <Drawer
        title={
          <span>
            <UserAddOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
            Cadastros Pendentes
            {pendentes.length > 0 && (
              <Tag color="orange" style={{ marginLeft: 8 }}>{pendentes.length}</Tag>
            )}
          </span>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={700}
        styles={{ body: { padding: 0 } }}
      >
        {drawerLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : pendentes.length === 0 ? (
          <Empty description="Nenhum cadastro pendente" style={{ padding: 40 }} />
        ) : (
          <List
            dataSource={pendentes}
            renderItem={(c: any) => (
              <List.Item
                style={{ padding: '14px 20px', alignItems: 'flex-start' }}
                actions={[
                  <Popconfirm
                    key="aprovar"
                    title="Aprovar cadastro?"
                    description="O cliente terá acesso liberado ao App."
                    onConfirm={() => aprovar(c.id)}
                    okText="Aprovar"
                    cancelText="Cancelar"
                  >
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      loading={actionId === c.id}
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    >
                      Aprovar
                    </Button>
                  </Popconfirm>,
                  <Popconfirm
                    key="analisar"
                    title="Marcar como em análise?"
                    description="O cadastro será revisado posteriormente."
                    onConfirm={() => analisar(c.id)}
                    okText="Confirmar"
                    cancelText="Cancelar"
                  >
                    <Button
                      type="dashed"
                      size="small"
                      icon={<EditOutlined />}
                      loading={actionId === c.id}
                      style={{ color: '#1677ff', borderColor: '#1677ff' }}
                    >
                      Em Análise
                    </Button>
                  </Popconfirm>,
                  <Popconfirm
                    key="recusar"
                    title="Recusar cadastro?"
                    description="O cliente será marcado como reprovado."
                    onConfirm={() => recusar(c.id)}
                    okText="Recusar"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancelar"
                  >
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      loading={actionId === c.id}
                    >
                      Recusar
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 16,
                    }}>
                      {(c.nomexx || '?')[0].toUpperCase()}
                    </div>
                  }
                  title={
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {c.nomexx}
                      {c.cpfxxx && (
                        <Text style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 8, fontWeight: 400 }}>
                          CPF: {c.cpfxxx}
                        </Text>
                      )}
                    </span>
                  }
                  description={
                    <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.7 }}>
                      {c.emailx && <div>{c.emailx}</div>}
                      {c.celu1 && (
                        <div>
                          {c.celu1}
                          {c.nomeCidade ? ` · ${c.nomeCidade}/${c.nomeEstado}` : ''}
                        </div>
                      )}
                      {c.datcad && (
                        <div>Cadastro: {new Date(c.datcad).toLocaleDateString('pt-BR')}</div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
}
