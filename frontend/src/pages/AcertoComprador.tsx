import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Select, Row, Col, Typography, Button, Table, Card, Space, Spin, Tag,
  Modal, Form, Input, InputNumber, Popconfirm, message, Empty,
} from 'antd';
import {
  SearchOutlined, FileTextOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { BlobProvider } from '@react-pdf/renderer';
import api from '../services/api';
import RelatorioAcertoComprador from '../relatorios/RelatorioAcertoComprador';
import RelatorioReciboDespesa from '../relatorios/RelatorioReciboDespesa';
import { formatarMoeda, parseMoeda } from '../utils/moeda';
import { useConfig } from '../context/ConfigContext';
import { useBanco } from '../context/BancoContext';
import { useBuscaLeiloes } from '../hooks/useBuscaLeiloes';
import { lerFiltroPersistido, salvarFiltroPersistido } from '../utils/filtroPersistido';
import { fmtDataUTC } from '../utils/data';

const { Title, Text } = Typography;
const { TextArea } = Input;

const fmt = (v: number | null | undefined) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const DC_OPTS = [
  { value: 'D', label: 'Despesa' },
  { value: 'C', label: 'Crédito' },
  { value: 'F', label: 'Fechamento (pagamento)' },
];
const DC_INFO: Record<string, { label: string; color: string }> = {
  D: { label: 'Despesa', color: 'volcano' },
  S: { label: 'Despesa (legado)', color: 'volcano' },
  C: { label: 'Crédito', color: 'green' },
  E: { label: 'Crédito (legado)', color: 'green' },
  F: { label: 'Fechamento', color: 'blue' },
};
const dcInfo = (v: string) => DC_INFO[v] || { label: v || '—', color: 'default' };

// Comissão gerada automaticamente ao gerar parcelamento não é uma despesa
// qualquer — mostrar como "Despesa" genérica confundia o comprador/vendedor
// na hora de conferir o acerto. Sobrepõe o rótulo padrão nesses casos.
const tipoLancamentoInfo = (r: { dc: string; tipoOrigem?: string }) =>
  r.tipoOrigem === 'COMISSAO_VENDEDOR'  ? { label: 'Comissão Vendedor',  color: 'orange' } :
  r.tipoOrigem === 'COMISSAO_COMPRADOR' ? { label: 'Comissão Comprador', color: 'orange' } :
  dcInfo(r.dc);

interface Acerto {
  idLeilao?: number;
  leilao?: string;
  idComprador: number;
  comprador?: string;
  compras: Array<{ idMc: number; lotexx?: string; deslot?: string; nomeVendedor?: string; valorEntrada: number; leilao?: string }>;
  promissorias: Array<{ datven: string; valor: number }>;
  lancamentos: Array<{ id: number; dc: string; valor: number; observacoes?: string; dataInclusao?: string; agrupado?: boolean; tipoOrigem?: string }>;
  totais: {
    totalPrimeirasParcelas: number; totalPromissorias: number; totalComissao: number;
    totalDespesas: number; totalCreditos: number; totalFechamentos: number; saldo: number;
  };
}

export default function AcertoComprador() {
  const config = useConfig();
  const { banco } = useBanco();
  const filtroSalvo = lerFiltroPersistido<{ leilaoSel?: number; compradorSel?: number }>(banco, 'acerto-comprador', {});
  const { opcoes: leiloes, carregando: carregandoLeiloes, buscar: buscarLeiloes, garantirOpcao: garantirOpcaoLeilao } = useBuscaLeiloes();
  const [leilaoSel, setLeilaoSel] = useState<number | undefined>(filtroSalvo.leilaoSel);
  const [compradores, setCompradores] = useState<{ value: number; label: string }[]>([]);
  const [compradorSel, setCompradorSel] = useState<number | undefined>(filtroSalvo.compradorSel);
  const [loadingComp, setLoadingComp] = useState(false);
  const timerComp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [acerto, setAcerto] = useState<Acerto | null>(null);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [recibo, setRecibo] = useState<any | null>(null);
  const [form] = Form.useForm();

  const buscarCompradores = useCallback((busca: string) => {
    clearTimeout(timerComp.current);
    if (busca.length < 2) { setCompradores([]); return; }
    timerComp.current = setTimeout(async () => {
      setLoadingComp(true);
      try {
        const r = await api.get('/clientes', { params: { nome: busca } });
        setCompradores(r.data.map((c: any) => ({ value: c.id, label: c.nomexx })));
      } finally { setLoadingComp(false); }
    }, 350);
  }, []);

  const consultar = async () => {
    if (!compradorSel) { message.warning('Selecione o comprador'); return; }
    setLoading(true);
    try {
      salvarFiltroPersistido(banco, 'acerto-comprador', { leilaoSel, compradorSel });
      const params: any = { idComprador: compradorSel };
      if (leilaoSel) params.idLeilao = leilaoSel;
      const r = await api.get('/acerto-comprador', { params });
      setAcerto(r.data);
    } catch { message.error('Erro ao calcular o acerto'); }
    finally { setLoading(false); }
  };

  // Restaura o resultado da última consulta ao remontar (troca de aba) e
  // resolve o rótulo dos Selects assíncronos (leilão/comprador), que começam
  // sem opções carregadas.
  useEffect(() => {
    if (filtroSalvo.leilaoSel) {
      api.get(`/leiloes/${filtroSalvo.leilaoSel}`).then(r => garantirOpcaoLeilao(r.data.id, r.data.leilao)).catch(() => {});
    }
    if (filtroSalvo.compradorSel) {
      api.get(`/clientes/${filtroSalvo.compradorSel}`).then(r => setCompradores([{ value: r.data.id, label: r.data.nomexx }])).catch(() => {});
      consultar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirModal = (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item ? { ...item } : { dc: 'D', valor: 0 });
    setModalOpen(true);
  };

  const salvarLancamento = async (values: any) => {
    if (!acerto) return;
    const payload = { ...values, codLei: acerto.idLeilao, codigoCliente: acerto.idComprador };
    try {
      if (editando) await api.put(`/despesas/${editando.id}`, payload);
      else await api.post('/despesas', payload);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      consultar();
    } catch { message.error('Erro ao salvar'); }
  };

  const excluirLancamento = async (id: number) => {
    try { await api.delete(`/despesas/${id}`); message.success('Excluído'); consultar(); }
    catch { message.error('Erro ao excluir'); }
  };

  const exportarCSV = () => {
    if (!acerto) return;
    const linhas: string[] = [];
    const num = (v: number) => String(Number(v || 0).toFixed(2)).replace('.', ',');
    const csvEsc = (v: any) => String(v ?? '').replace(/;/g, ',');

    linhas.push(`Acerto de Comprador;${csvEsc(acerto.comprador)}`);
    linhas.push(`Leilão;${csvEsc(acerto.leilao)}`);
    linhas.push('');

    linhas.push(`PRIMEIRAS PARCELAS (${acerto.compras.length})`);
    linhas.push(['Lote', ...(!acerto.idLeilao ? ['Leilão'] : []), 'Descrição', 'Vendedor', 'Valor 1ª Parcela'].join(';'));
    for (const e of acerto.compras) {
      linhas.push([e.lotexx, ...(!acerto.idLeilao ? [e.leilao] : []), e.deslot, e.nomeVendedor, num(e.valorEntrada)].map(csvEsc).join(';'));
    }
    linhas.push('');

    linhas.push('PROMISSÓRIAS (futuro)');
    linhas.push(['Vencimento', 'Valor'].join(';'));
    for (const p of acerto.promissorias) linhas.push([p.datven, num(p.valor)].map(csvEsc).join(';'));
    linhas.push('');

    linhas.push('DESPESAS / CRÉDITOS / FECHAMENTOS');
    linhas.push(['Tipo', 'Leilão', 'Observações', 'Valor', 'Inclusão'].join(';'));
    for (const l of acerto.lancamentos) {
      linhas.push([tipoLancamentoInfo(l).label, (l as any).leilao, l.observacoes, num(l.valor),
        l.dataInclusao ? fmtDataUTC(l.dataInclusao) : ''].map(csvEsc).join(';'));
    }
    linhas.push('');

    linhas.push('TOTAIS');
    linhas.push(`Total Primeiras Parcelas;${num(acerto.totais.totalPrimeirasParcelas)}`);
    linhas.push(`Total Promissórias (futuro);${num(acerto.totais.totalPromissorias)}`);
    linhas.push(`Total Comissão;${num(acerto.totais.totalComissao)}`);
    linhas.push(`Total Créditos;${num(acerto.totais.totalCreditos)}`);
    linhas.push(`Total Despesas;${num(acerto.totais.totalDespesas)}`);
    linhas.push(`Total Fechamentos;${num(acerto.totais.totalFechamentos)}`);
    linhas.push(`Total a Pagar;${num(acerto.totais.saldo)}`);

    const csv = '﻿' + linhas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acerto_comprador_${(acerto.comprador || '').replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Coluna "Leilão" só faz sentido quando a consulta agrega vários leilões
  // (leilaoSel vazio) — com um leilão específico selecionado, seria redundante.
  const colunasCompras = [
    { title: 'Lote', dataIndex: 'lotexx', width: 70 },
    ...(!acerto?.idLeilao ? [{ title: 'Leilão', dataIndex: 'leilao', ellipsis: true, width: 160 }] : []),
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true },
    { title: 'Vendedor', dataIndex: 'nomeVendedor', ellipsis: true, width: 220 },
    { title: 'Valor 1ª Parcela', dataIndex: 'valorEntrada', width: 130, align: 'right' as const, render: fmt },
  ];

  const colunasPromissorias = [
    { title: 'Vencimento', dataIndex: 'datven', width: 130 },
    { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: fmt },
  ];

  const colunasLancamentos = [
    { title: 'Tipo', width: 130, render: (_: any, r: any) => <Tag color={tipoLancamentoInfo(r).color}>{tipoLancamentoInfo(r).label}</Tag> },
    ...(!acerto?.idLeilao ? [{ title: 'Leilão', dataIndex: 'leilao', ellipsis: true, width: 160 }] : []),
    {
      title: 'Observações', dataIndex: 'observacoes', ellipsis: true,
      render: (v: string, r: any) => r.agrupado ? <Space size={4}>{v}<Tag color="orange">Automática</Tag></Space> : v,
    },
    { title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const, render: fmt },
    { title: 'Inclusão', dataIndex: 'dataInclusao', width: 100, render: (v: string) => v ? fmtDataUTC(v) : '—' },
    {
      title: 'Ações', width: 120,
      render: (_: any, r: any) => r.agrupado ? null : (
        <Space size={4}>
          <Button size="small" icon={<PrinterOutlined />} title="Imprimir recibo"
            onClick={() => setRecibo({ ...r, cliente: acerto?.comprador, leilao: r.leilao || acerto?.leilao })} />
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => excluirLancamento(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalCards = acerto ? [
    { label: 'Total Primeiras Parcelas', value: acerto.totais.totalPrimeirasParcelas, color: '#1677ff' },
    { label: 'Total Promissórias (futuro)', value: acerto.totais.totalPromissorias, color: '#722ed1' },
    { label: 'Total Comissão', value: acerto.totais.totalComissao, color: '#fa8c16' },
    { label: 'Total Créditos', value: acerto.totais.totalCreditos, color: '#52c41a' },
    { label: 'Total Despesas', value: acerto.totais.totalDespesas, color: '#ff4d4f' },
    { label: 'Total Fechamentos', value: acerto.totais.totalFechamentos, color: '#13c2c2' },
    { label: 'Total a Pagar (Primeiras Parcelas + Comissão)', value: acerto.totais.saldo, color: Math.abs(acerto.totais.saldo) < 1 ? '#52c41a' : '#faad14' },
  ] : [];

  return (
    <>
      <Title level={4}><FileTextOutlined style={{ marginRight: 8 }} />Acerto de Comprador</Title>

      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Select
            placeholder="Leilão (opcional — vazio busca todos os leilões do comprador)"
            style={{ width: '100%' }}
            allowClear
            showSearch
            value={leilaoSel}
            options={leiloes}
            onChange={setLeilaoSel}
            onSearch={buscarLeiloes}
            filterOption={false}
            loading={carregandoLeiloes}
            notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
          />
        </Col>
        <Col xs={24} md={10}>
          <Select
            placeholder="Digite para buscar comprador..."
            style={{ width: '100%' }}
            allowClear
            showSearch
            filterOption={false}
            value={compradorSel}
            options={compradores}
            loading={loadingComp}
            onChange={v => { setCompradorSel(v); if (!v) setCompradores([]); }}
            onSearch={buscarCompradores}
            notFoundContent={loadingComp ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
          />
        </Col>
        <Col xs={24} md={4}>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={consultar} block>
            Consultar
          </Button>
        </Col>
      </Row>

      {!acerto && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <FileTextOutlined style={{ fontSize: 48, marginBottom: 12, display: 'block' }} />
          Selecione o comprador (e opcionalmente o leilão) e clique em <strong>Consultar</strong>
        </div>
      )}

      {acerto && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <Text type="secondary">{acerto.leilao}</Text> — <Text strong>{acerto.comprador}</Text>
            </div>
            <Space>
              <Button icon={<FileExcelOutlined />} onClick={exportarCSV}>
                Exportar Excel
              </Button>
              <BlobProvider document={<RelatorioAcertoComprador dados={acerto} empresa={config.empresa} logoBase64={config.logoBase64} />}>
                {({ url, loading: gerandoPdf }) => (
                  <Button
                    icon={<EyeOutlined />}
                    loading={gerandoPdf}
                    disabled={!url}
                    onClick={() => url && window.open(url, '_blank')}
                  >
                    {gerandoPdf ? 'Gerando PDF...' : 'Visualizar / Imprimir'}
                  </Button>
                )}
              </BlobProvider>
            </Space>
          </div>

          <Row gutter={12} style={{ marginBottom: 16 }}>
            {totalCards.map(({ label, value, color }) => (
              <Col xs={12} md={4} key={label}>
                <Card size="small" styles={{ body: { padding: '10px 12px' } }}>
                  <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{fmt(value)}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card size="small" title={`Primeiras Parcelas (${acerto.compras.length})`} style={{ marginBottom: 12 }}>
            <Table
              rowKey="idMc" size="small" columns={colunasCompras} dataSource={acerto.compras}
              pagination={false} scroll={{ y: 260 }}
              locale={{ emptyText: <Empty description="Nenhuma primeira parcela" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>

          <Card size="small" title="Promissórias — agrupadas por vencimento" style={{ marginBottom: 12 }}>
            <Table
              rowKey="datven" size="small" columns={colunasPromissorias} dataSource={acerto.promissorias}
              pagination={false} scroll={{ y: 220 }}
              locale={{ emptyText: <Empty description="Nenhuma promissória futura" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>

          <Card
            size="small"
            title="Despesas / Créditos / Fechamentos"
            extra={
              <Button
                size="small" type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}
                disabled={!acerto.idLeilao}
                title={!acerto.idLeilao ? 'Selecione um leilão específico para lançar despesas/créditos' : undefined}
              >
                Novo Lançamento
              </Button>
            }
          >
            <Table
              rowKey="id" size="small" columns={colunasLancamentos} dataSource={acerto.lancamentos}
              pagination={false}
              locale={{ emptyText: <Empty description="Nenhum lançamento" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </>
      )}

      <Modal
        title={editando ? 'Editar Lançamento' : 'Novo Lançamento'}
        open={modalOpen}
        onOk={form.submit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={salvarLancamento}>
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
