import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Table, Typography, Space, Button, Select, DatePicker, Modal, Form, InputNumber, Input, Drawer, Descriptions,
  Tag, Popconfirm, Card, Row, Col, Statistic, message, Tooltip, Timeline, Empty,
} from 'antd';
import { CheckOutlined, EditOutlined, FileExcelOutlined, FilePdfOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { AxiosInstance } from 'axios';
import api from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { exportarPlanilha, SeletorLeilao } from '../financeiro/comum';
import { DESTINOS, fmtData, fmtValor, nomeDestino, SeletorCliente, SITUACOES, TagSituacao } from './comum';

const { Title, Text } = Typography;

export interface Parcela {
  id: number; idLote: number; idLeilao: number; leilao: string; lote: string; animal: string;
  idVendedor: number; vendedor: string; idComprador: number; comprador: string; ordxxx: string;
  vencimento: string; valor: number; pago: number; saldo: number; dataPagamento: string | null;
  situacao: string; destino: string; taxa: number;
}

const ACOES: Record<string, string> = {
  BAIXA: 'Baixa', BAIXA_DESFEITA: 'Baixa desfeita', RENEGOCIACAO: 'Renegociação', LOTE_INCLUIDO: 'Lote incluído na cobrança',
  LOTE_ALTERADO: 'Lote alterado', LOTE_REMOVIDO: 'Lote retirado da cobrança', QUITACAO_ANTERIOR: 'Quitação das antigas',
};
export const nomeAcao = (a: string) => ACOES[a] || a;

export function Historico({ itens }: { itens: any[] }) {
  if (!itens.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem alterações" />;
  return (
    <Timeline items={itens.map(h => ({
      color: h.acao === 'RENEGOCIACAO' ? 'orange' : h.acao.includes('DESFEITA') || h.acao.includes('REMOVIDO') ? 'red' : 'blue',
      children: (
        <div>
          <Text strong>{nomeAcao(h.acao)}</Text>{h.parcela ? <Text type="secondary"> · parcela {h.parcela}</Text> : null}
          <div>{h.antes ? <><Text delete type="secondary">{h.antes}</Text> → </> : null}{h.depois}</div>
          {h.motivo ? <div><Text type="secondary">Motivo: {h.motivo}</Text></div> : null}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(h.data).toLocaleString('pt-BR')} · {h.autor === 'VENDEDOR' ? 'pelo vendedor' : 'pela leiloeira'}{h.usuario ? ` (${h.usuario})` : ''}
          </Text>
        </div>
      ),
    }))} />
  );
}

export default function CobrancaParcelas() {
  const config = useConfig();
  const [params] = useSearchParams();
  const [filtro, setFiltro] = useState<any>(() => ({
    situacao: params.get('situacao') || 'EM_ABERTO',
    idComprador: params.get('idComprador') ? Number(params.get('idComprador')) : undefined,
    comprador: params.get('comprador') || undefined,
    idVendedor: params.get('idVendedor') ? Number(params.get('idVendedor')) : undefined,
    vendedor: params.get('vendedor') || undefined,
  }));
  const [dados, setDados] = useState<Parcela[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [baixa, setBaixa] = useState<Parcela[] | null>(null);
  const [reneg, setReneg] = useState<Parcela | null>(null);
  const [detalhe, setDetalhe] = useState<Parcela | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get('/cobranca/parcelas', { params: {
        idVendedor: filtro.idVendedor, idComprador: filtro.idComprador, idLeilao: filtro.idLeilao, situacao: filtro.situacao,
        vencDe: filtro.venc?.[0]?.format('YYYY-MM-DD'), vencAte: filtro.venc?.[1]?.format('YYYY-MM-DD'),
      } });
      setDados(r.data);
      setSelecionadas([]);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao carregar'); }
    finally { setCarregando(false); }
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  const totais = useMemo(() => ({
    valor: dados.reduce((a, p) => a + p.valor, 0), pago: dados.reduce((a, p) => a + p.pago, 0), saldo: dados.reduce((a, p) => a + p.saldo, 0),
  }), [dados]);

  const tituloRelatorio = filtro.vendedor ? `Cobrança — ${filtro.vendedor}` : filtro.comprador ? `Parcelas de ${filtro.comprador}` : 'Parcelas em cobrança';
  const subtitulo = [
    filtro.situacao ? (filtro.situacao === 'EM_ABERTO' ? 'Em aberto' : SITUACOES[filtro.situacao]?.label) : 'Todas',
    filtro.venc ? `vencimento ${filtro.venc[0].format('DD/MM/YYYY')} a ${filtro.venc[1].format('DD/MM/YYYY')}` : null,
    filtro.leilao,
  ].filter(Boolean).join(' · ');

  const pdf = async () => {
    setGerandoPdf(true);
    try {
      await baixarRelatorioFinanceiro({
        titulo: tituloRelatorio, subtitulo, empresa: config.empresa, logoBase64: config.logoBase64,
        resumo: [
          { label: 'Parcelas', valor: String(dados.length) },
          { label: 'Valor', valor: fmtValor(totais.valor) },
          { label: 'Recebido', valor: fmtValor(totais.pago) },
          { label: 'A receber', valor: fmtValor(totais.saldo) },
        ],
        colunas: [
          { titulo: 'Vencimento', flex: 0.8 }, { titulo: 'Leilão', flex: 1.6 }, { titulo: 'Lote', flex: 0.4 },
          ...(filtro.idVendedor ? [] : [{ titulo: 'Vendedor', flex: 1.6 }]),
          { titulo: 'Comprador', flex: 2 }, { titulo: 'Parcela', flex: 0.6 },
          { titulo: 'Valor', direita: true }, { titulo: 'Recebido', direita: true }, { titulo: 'Pago em', flex: 0.8 }, { titulo: 'Situação', flex: 0.9 },
        ],
        linhas: dados.map(p => ({ destaque: p.situacao === 'VENCIDA', celulas: [
          fmtData(p.vencimento), p.leilao || '', p.lote || '', ...(filtro.idVendedor ? [] : [p.vendedor || '']),
          p.comprador || '', p.ordxxx, fmtValor(p.valor), p.pago ? fmtValor(p.pago) : '—', fmtData(p.dataPagamento),
          SITUACOES[p.situacao]?.label || p.situacao,
        ] })),
        total: ['', 'Total', '', ...(filtro.idVendedor ? [] : ['']), '', '', fmtValor(totais.valor), fmtValor(totais.pago), '', ''],
        rodapeNota: 'Intermediação de cobrança · Recebido = baixas na Cobrança e créditos conciliados no extrato',
      }, `cobranca-${(filtro.vendedor || filtro.comprador || 'parcelas').replace(/[^\w-]+/g, '_').slice(0, 50)}`);
    } catch { message.error('Erro ao gerar o PDF'); }
    finally { setGerandoPdf(false); }
  };

  const excel = () => exportarPlanilha(dados.map(p => ({
    Vencimento: fmtData(p.vencimento), Leilão: p.leilao, Lote: p.lote, Animal: p.animal, Vendedor: p.vendedor, Comprador: p.comprador,
    Parcela: p.ordxxx, Valor: p.valor, Recebido: p.pago, 'A receber': p.saldo, 'Pago em': fmtData(p.dataPagamento),
    Situação: SITUACOES[p.situacao]?.label, 'Dinheiro vai para': nomeDestino(p.destino), 'Taxa %': p.taxa,
  })), 'cobranca-parcelas', 'Parcelas');

  const selecionadasObj = dados.filter(p => selecionadas.includes(p.id));

  return (
    <>
      <Title level={4}>Parcelas em cobrança</Title>
      <Space wrap style={{ marginBottom: 12 }}>
        <SeletorCliente placeholder="Vendedor" value={filtro.idVendedor} rotulo={filtro.vendedor} style={{ width: 260 }}
          onChange={(id, nome) => setFiltro((f: any) => ({ ...f, idVendedor: id, vendedor: nome }))} />
        <SeletorCliente placeholder="Comprador" value={filtro.idComprador} rotulo={filtro.comprador} style={{ width: 260 }}
          onChange={(id, nome) => setFiltro((f: any) => ({ ...f, idComprador: id, comprador: nome }))} />
        <SeletorLeilao value={filtro.idLeilao} rotulo={filtro.leilao} style={{ width: 280 }} placeholder="Leilão"
          onChange={(id, nome) => setFiltro((f: any) => ({ ...f, idLeilao: id, leilao: nome }))} />
        <Select style={{ width: 170 }} value={filtro.situacao ?? ''} onChange={v => setFiltro((f: any) => ({ ...f, situacao: v || undefined }))}
          options={[
            { value: 'EM_ABERTO', label: 'Em aberto' }, { value: 'VENCIDA', label: 'Vencidas' }, { value: 'ABERTA', label: 'A vencer' },
            { value: 'PARCIAL', label: 'Pagas em parte' }, { value: 'PAGA', label: 'Pagas' }, { value: '', label: 'Todas' },
          ]} />
        <DatePicker.RangePicker format="DD/MM/YYYY" placeholder={['Vencimento de', 'até']} value={filtro.venc}
          onChange={v => setFiltro((f: any) => ({ ...f, venc: v && v[0] && v[1] ? [v[0], v[1]] : undefined }))} />
        <Button icon={<ReloadOutlined />} onClick={carregar} />
      </Space>

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Parcelas" value={dados.length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Valor" value={fmtValor(totais.valor)} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Recebido" value={fmtValor(totais.pago)} valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="A receber" value={fmtValor(totais.saldo)} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 8 }} wrap>
        <Button type="primary" icon={<CheckOutlined />} disabled={!selecionadasObj.some(p => p.saldo > 0)}
          onClick={() => setBaixa(selecionadasObj.filter(p => p.saldo > 0))}>
          Dar baixa{selecionadas.length ? ` (${selecionadas.length})` : ''}
        </Button>
        <Button icon={<FileExcelOutlined />} disabled={!dados.length} onClick={excel}>Excel</Button>
        <Button icon={<FilePdfOutlined />} disabled={!dados.length} loading={gerandoPdf} onClick={pdf}>
          {filtro.idVendedor ? 'Relatório do vendedor' : 'PDF'}
        </Button>
      </Space>

      <Table size="small" rowKey="id" loading={carregando} dataSource={dados}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [50, 100, 500] }}
        rowSelection={{ selectedRowKeys: selecionadas, onChange: k => setSelecionadas(k as number[]),
          getCheckboxProps: (p: Parcela) => ({ disabled: p.saldo <= 0 }) }}
        scroll={{ x: 1200 }}
        columns={[
          { title: 'Vencimento', dataIndex: 'vencimento', render: fmtData, width: 100, sorter: (a: Parcela, b: Parcela) => a.vencimento.localeCompare(b.vencimento) },
          { title: 'Leilão', dataIndex: 'leilao', ellipsis: true },
          { title: 'Lote', dataIndex: 'lote', width: 60, render: (v: string, p: Parcela) => <Tooltip title={p.animal}>{v}</Tooltip> },
          { title: 'Vendedor', dataIndex: 'vendedor', ellipsis: true },
          { title: 'Comprador', dataIndex: 'comprador', ellipsis: true },
          { title: 'Parcela', dataIndex: 'ordxxx', width: 75 },
          { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: fmtValor, width: 110 },
          { title: 'Recebido', dataIndex: 'pago', align: 'right' as const, width: 110, render: (v: number) => (v ? fmtValor(v) : '—') },
          { title: 'Pago em', dataIndex: 'dataPagamento', render: fmtData, width: 95 },
          { title: 'Situação', dataIndex: 'situacao', width: 120, render: (s: string) => <TagSituacao s={s} /> },
          { title: 'Vai para', dataIndex: 'destino', width: 95, render: (d: string) => <Tag>{d === 'MACEDO' ? 'Leiloeira' : 'Vendedor'}</Tag> },
          {
            title: '', width: 110, fixed: 'right' as const, render: (_: any, p: Parcela) => (
              <Space size={2}>
                <Tooltip title="Dar baixa"><Button size="small" type="text" icon={<CheckOutlined />} disabled={p.saldo <= 0} onClick={() => setBaixa([p])} /></Tooltip>
                <Tooltip title="Renegociar"><Button size="small" type="text" icon={<EditOutlined />} disabled={p.saldo <= 0} onClick={() => setReneg(p)} /></Tooltip>
                <Tooltip title="Baixas e histórico"><Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => setDetalhe(p)} /></Tooltip>
              </Space>
            ),
          },
        ]} />

      {baixa && <ModalBaixa parcelas={baixa} onClose={ok => { setBaixa(null); if (ok) carregar(); }} />}
      {reneg && <ModalRenegociar parcela={reneg} onClose={ok => { setReneg(null); if (ok) carregar(); }} />}
      {detalhe && <DrawerParcela parcela={detalhe} onClose={mudou => { setDetalhe(null); if (mudou) carregar(); }} />}
    </>
  );
}

function ModalBaixa({ parcelas, onClose }: { parcelas: Parcela[]; onClose: (ok: boolean) => void }) {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const uma = parcelas.length === 1 ? parcelas[0] : null;
  const total = parcelas.reduce((a, p) => a + p.saldo, 0);
  const destinos = new Set(parcelas.map(p => p.destino));
  const salvar = async () => {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      await api.post('/cobranca/parcelas/baixar', {
        ids: parcelas.map(p => p.id), dataPagamento: (v.data as Dayjs).format('YYYY-MM-DD'),
        valor: uma && v.valor !== uma.saldo ? v.valor : undefined, recebidoEm: v.recebidoEm || undefined, observacao: v.observacao,
      });
      message.success(parcelas.length > 1 ? `${parcelas.length} parcelas baixadas` : 'Baixa registrada');
      onClose(true);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao dar baixa'); }
    finally { setSalvando(false); }
  };
  return (
    <Modal open title={uma ? `Baixa da parcela ${uma.ordxxx} — lote ${uma.lote}` : `Baixa de ${parcelas.length} parcelas`}
      onCancel={() => onClose(false)} onOk={salvar} okText="Registrar baixa" confirmLoading={salvando} destroyOnHidden>
      {uma
        ? <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Comprador">{uma.comprador}</Descriptions.Item>
            <Descriptions.Item label="Vencimento">{fmtData(uma.vencimento)}</Descriptions.Item>
            <Descriptions.Item label="Saldo">{fmtValor(uma.saldo)}</Descriptions.Item>
          </Descriptions>
        : <Text>Total: <Text strong>{fmtValor(total)}</Text> (saldo de cada parcela)</Text>}
      <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}
        initialValues={{ data: dayjs(), valor: uma?.saldo, recebidoEm: destinos.size === 1 ? Array.from(destinos)[0] : undefined }}>
        <Form.Item name="data" label="Data do pagamento" rules={[{ required: true, message: 'Informe a data' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: 180 }} />
        </Form.Item>
        {uma && (
          <Form.Item name="valor" label="Valor recebido" rules={[{ required: true, message: 'Informe o valor' }]}
            extra="Menor que o saldo deixa a parcela paga em parte.">
            <InputNumber min={0.01} max={uma.saldo} precision={2} decimalSeparator="," prefix="R$" style={{ width: 180 }} />
          </Form.Item>
        )}
        <Form.Item name="recebidoEm" label="Onde o dinheiro caiu"
          extra={destinos.size > 1 ? 'Em branco: o destino configurado em cada lote.' : 'Na conta da leiloeira a taxa é retida no repasse; na do vendedor, entra na cobrança mensal da taxa.'}>
          <Select allowClear options={DESTINOS} style={{ width: 220 }} placeholder="Destino do lote" />
        </Form.Item>
        <Form.Item name="observacao" label="Observação"><Input maxLength={255} /></Form.Item>
      </Form>
    </Modal>
  );
}

export function ModalRenegociar({ parcela, onClose, rota = '/cobranca/parcelas', http = api }: {
  parcela: Pick<Parcela, 'id' | 'ordxxx' | 'lote' | 'comprador' | 'valor' | 'vencimento'>; onClose: (ok: boolean) => void;
  rota?: string; http?: AxiosInstance;
}) {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      await http.put(`${rota}/${parcela.id}/renegociar`, {
        vencimento: (v.vencimento as Dayjs)?.format('YYYY-MM-DD'), valor: v.valor, motivo: v.motivo,
      });
      message.success('Parcela renegociada');
      onClose(true);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao renegociar'); }
    finally { setSalvando(false); }
  };
  return (
    <Modal open title={`Renegociar parcela ${parcela.ordxxx} — lote ${parcela.lote}`} onCancel={() => onClose(false)}
      onOk={salvar} okText="Salvar" confirmLoading={salvando} destroyOnHidden>
      <Text type="secondary">{parcela.comprador} · hoje: {fmtValor(parcela.valor)} com vencimento em {fmtData(parcela.vencimento)}</Text>
      <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}
        initialValues={{ vencimento: parcela.vencimento ? dayjs(parcela.vencimento) : undefined, valor: parcela.valor }}>
        <Form.Item name="vencimento" label="Novo vencimento" rules={[{ required: true, message: 'Informe o vencimento' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="valor" label="Novo valor" rules={[{ required: true, message: 'Informe o valor' }]}>
          <InputNumber min={0.01} precision={2} decimalSeparator="," prefix="R$" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="motivo" label="Motivo" rules={[{ required: true, message: 'Conte o motivo — fica no histórico' }]}>
          <Input.TextArea rows={2} maxLength={255} />
        </Form.Item>
      </Form>
      <Text type="secondary" style={{ fontSize: 12 }}>A mudança vale na hora e fica no histórico da parcela, com o valor de antes.</Text>
    </Modal>
  );
}

function DrawerParcela({ parcela, onClose }: { parcela: Parcela; onClose: (mudou: boolean) => void }) {
  const [baixas, setBaixas] = useState<any[] | null>(null);
  const [hist, setHist] = useState<any[]>([]);
  const [mudou, setMudou] = useState(false);
  const carregar = useCallback(() => {
    Promise.all([api.get(`/cobranca/parcelas/${parcela.id}/baixas`), api.get(`/cobranca/parcelas/${parcela.id}/historico`)])
      .then(([b, h]) => { setBaixas(b.data); setHist(h.data); })
      .catch(() => message.error('Erro ao carregar'));
  }, [parcela.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const desfazer = async (id: number) => {
    try { await api.post(`/cobranca/baixas/${id}/desfazer`); message.success('Baixa desfeita'); setMudou(true); carregar(); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao desfazer'); }
  };

  return (
    <Drawer open width={560} title={`Parcela ${parcela.ordxxx} — lote ${parcela.lote}`} onClose={() => onClose(mudou)}>
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Leilão">{parcela.leilao}</Descriptions.Item>
        <Descriptions.Item label="Animal">{parcela.animal || '—'}</Descriptions.Item>
        <Descriptions.Item label="Vendedor">{parcela.vendedor}</Descriptions.Item>
        <Descriptions.Item label="Comprador">{parcela.comprador}</Descriptions.Item>
        <Descriptions.Item label="Vencimento">{fmtData(parcela.vencimento)}</Descriptions.Item>
        <Descriptions.Item label="Valor">{fmtValor(parcela.valor)} · recebido {fmtValor(parcela.pago)}</Descriptions.Item>
        <Descriptions.Item label="Dinheiro vai para">{nomeDestino(parcela.destino)} · taxa {parcela.taxa}%</Descriptions.Item>
      </Descriptions>
      <Title level={5}>Baixas</Title>
      <Table size="small" rowKey={(b: any) => `${b.origemTabela}${b.id}`} loading={!baixas} dataSource={baixas || []} pagination={false}
        locale={{ emptyText: 'Nenhuma baixa' }} style={{ marginBottom: 16 }}
        columns={[
          { title: 'Pago em', dataIndex: 'dataPagamento', render: fmtData, width: 90 },
          { title: 'Valor', dataIndex: 'valor', render: fmtValor, align: 'right' as const },
          { title: 'Origem', render: (_: any, b: any) => (
            <>{b.origem === 'EXTRATO' ? 'Extrato' : b.origem === 'ANTERIOR' ? 'Quitada antes' : 'Manual'}
              {b.desfeita ? <Tag color="red" style={{ marginLeft: 4 }}>desfeita</Tag> : null}
              {b.fechamento ? <Tag style={{ marginLeft: 4 }}>fechamento</Tag> : null}</>
          ) },
          { title: 'Caiu na', dataIndex: 'recebidoEm', render: (d: string) => (d === 'MACEDO' ? 'Leiloeira' : 'Vendedor') },
          { title: '', width: 80, render: (_: any, b: any) => b.origemTabela === 'COBR' && !b.desfeita && !b.fechamento ? (
            <Popconfirm title="Desfazer esta baixa?" onConfirm={() => desfazer(b.id)}><Button size="small" danger type="link">Desfazer</Button></Popconfirm>
          ) : b.origemTabela === 'CONC' && !b.desfeita ? <Tooltip title="Baixa do extrato: desfaz-se na Conciliação"><Text type="secondary">—</Text></Tooltip> : null },
        ]} />
      <Title level={5}>Histórico</Title>
      <Historico itens={hist} />
    </Drawer>
  );
}
