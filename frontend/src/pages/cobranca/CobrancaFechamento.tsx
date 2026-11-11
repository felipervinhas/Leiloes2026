import React, { useCallback, useEffect, useState } from 'react';
import {
  Table, Typography, Space, Button, DatePicker, Tag, Drawer, Descriptions, Modal, Input, Select, Card, message, Tooltip, Dropdown,
} from 'antd';
import { FilePdfOutlined, LockOutlined, EyeOutlined, MoreOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { exportarPlanilha } from '../financeiro/comum';
import { fmtData, fmtValor, mesAtual, nomeMes, SeletorCliente, SITUACOES_FECHAMENTO } from './comum';

const { Title, Text } = Typography;

export const textoSaldo = (s: number) =>
  s > 0.009 ? `Leiloeira repassa ${fmtValor(s)}` : s < -0.009 ? `Vendedor paga ${fmtValor(-s)}` : 'Sem saldo';

const TagFech = ({ s }: { s: string }) => <Tag color={SITUACOES_FECHAMENTO[s]?.cor}>{SITUACOES_FECHAMENTO[s]?.label || s}</Tag>;

const colunasValores = [
  { title: 'Parcelas', dataIndex: 'qtdParcelas', align: 'right' as const, width: 80 },
  { title: 'Recebido na leiloeira', dataIndex: 'recebidoMacedo', align: 'right' as const, render: fmtValor },
  { title: 'Recebido pelo vendedor', dataIndex: 'recebidoVendedor', align: 'right' as const, render: fmtValor },
  { title: 'Taxa retida', dataIndex: 'taxaRetida', align: 'right' as const, render: fmtValor },
  { title: 'Taxa a cobrar', dataIndex: 'taxaACobrar', align: 'right' as const, render: fmtValor },
  { title: 'Acerto', dataIndex: 'saldo', render: (s: number) => <Text strong type={s < 0 ? 'warning' : undefined}>{textoSaldo(s)}</Text> },
];

export default function CobrancaFechamento() {
  const config = useConfig();
  const [comp, setComp] = useState(mesAtual());
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [previa, setPrevia] = useState<{ idVendedor: number; vendedor: string } | null>(null);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [lista, setLista] = useState<any[]>([]);
  const [filtroLista, setFiltroLista] = useState<any>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setDados((await api.get(`/cobranca/fechamentos/competencia/${comp}`)).data); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao carregar'); }
    finally { setCarregando(false); }
  }, [comp]);
  const carregarLista = useCallback(async () => {
    try { setLista((await api.get('/cobranca/fechamentos', { params: { idVendedor: filtroLista.idVendedor, situacao: filtroLista.situacao } })).data); }
    catch { /* lista é secundária */ }
  }, [filtroLista]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarLista(); }, [carregarLista]);
  const recarregar = () => { carregar(); carregarLista(); };

  const fechar = (v: any) => {
    let obs = '';
    Modal.confirm({
      title: `Fechar ${nomeMes(comp)} — ${v.vendedor}`,
      content: (
        <>
          <p>{v.pendente.qtdParcelas} parcela(s) recebida(s) até {fmtData(dados.ate)}. {textoSaldo(v.pendente.saldo)}.</p>
          <p style={{ color: '#888' }}>Depois de fechado, o mês não muda: recebimentos lançados depois entram no mês seguinte.</p>
          <Input.TextArea placeholder="Observação (opcional)" rows={2} onChange={e => { obs = e.target.value; }} />
        </>
      ),
      okText: 'Fechar mês',
      onOk: async () => {
        try {
          await api.post('/cobranca/fechamentos', { competencia: comp, idVendedor: v.idVendedor, observacao: obs || undefined });
          message.success('Mês fechado'); recarregar();
        } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao fechar'); throw e; }
      },
    });
  };

  const mudar = async (id: number, situacao: string) => {
    try { await api.put(`/cobranca/fechamentos/${id}/situacao`, { situacao }); recarregar(); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro'); }
  };
  const reabrir = (id: number) => Modal.confirm({
    title: 'Reabrir este fechamento?', content: 'As baixas voltam a ficar pendentes e o mês pode ser fechado de novo.',
    okText: 'Reabrir', okButtonProps: { danger: true },
    onOk: async () => {
      try { await api.post(`/cobranca/fechamentos/${id}/reabrir`); message.success('Fechamento reaberto'); recarregar(); }
      catch (e: any) { message.error(e.response?.data?.error || 'Erro'); throw e; }
    },
  });

  const acoesFechamento = (f: any) => (
    <Space size={2}>
      <Tooltip title="Ver itens"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => setDetalhe(f.id)} /></Tooltip>
      <Tooltip title="PDF"><Button size="small" type="text" icon={<FilePdfOutlined />} onClick={() => pdfFechamento(f.id, config)} /></Tooltip>
      <Dropdown trigger={['click']} menu={{
        items: [
          { key: 'COBRADO', label: 'Marcar como cobrado', disabled: f.situacao !== 'FECHADO' },
          { key: 'PAGO', label: 'Marcar como pago', disabled: f.situacao === 'PAGO' },
          { key: 'VOLTAR', label: 'Voltar para fechado', disabled: f.situacao === 'FECHADO' },
          { type: 'divider' as const },
          { key: 'REABRIR', label: 'Reabrir (desfazer fechamento)', danger: true, disabled: f.situacao !== 'FECHADO' },
        ],
        onClick: ({ key }) => key === 'REABRIR' ? reabrir(f.id) : mudar(f.id, key === 'VOLTAR' ? 'FECHADO' : key),
      }}>
        <Button size="small" type="text" icon={<MoreOutlined />} />
      </Dropdown>
    </Space>
  );

  return (
    <>
      <Title level={4}>Fechamento mensal</Title>
      <Text type="secondary">Parcelas recebidas no mês × taxa de cada lote. Na conta da leiloeira, a taxa fica retida e o resto é repassado ao vendedor;
        na conta do vendedor, a taxa é cobrada dele.</Text>
      <Space style={{ margin: '12px 0', display: 'flex' }}>
        <DatePicker picker="month" format="MM/YYYY" allowClear={false} value={dayjs(`${comp}-01`)} onChange={d => d && setComp(d.format('YYYY-MM'))} />
        <Text>Recebimentos até {dados ? fmtData(dados.ate) : '…'}, ainda não fechados</Text>
      </Space>
      <Table size="small" rowKey="idVendedor" loading={carregando} dataSource={dados?.vendedores || []} pagination={false}
        locale={{ emptyText: 'Nenhum recebimento no mês' }} style={{ marginBottom: 24 }}
        columns={[
          { title: 'Vendedor', dataIndex: 'vendedor' },
          { title: 'Situação', width: 220, render: (_: any, v: any) => (
            <Space direction="vertical" size={0}>
              {v.fechamento ? <span><TagFech s={v.fechamento.situacao} /> {textoSaldo(v.fechamento.saldo)}</span> : null}
              {v.pendente ? <Text type="warning">{v.pendente.qtdParcelas} recebimento(s) pendente(s)</Text> : null}
            </Space>
          ) },
          ...colunasValores.map(c => ({ ...c, render: (_: any, v: any) => {
            const x = v.pendente || v.fechamento;
            return c.render ? (c.render as any)(x[c.dataIndex]) : x[c.dataIndex];
          } })),
          { title: '', width: 200, render: (_: any, v: any) => (
            <Space>
              {v.pendente && <Button size="small" onClick={() => setPrevia({ idVendedor: v.idVendedor, vendedor: v.vendedor })}>Prévia</Button>}
              {v.pendente && !v.fechamento && <Button size="small" type="primary" icon={<LockOutlined />} onClick={() => fechar(v)}>Fechar</Button>}
              {v.fechamento && acoesFechamento(v.fechamento)}
            </Space>
          ) },
        ]} />

      <Card size="small" title="Todos os fechamentos" extra={
        <Space>
          <SeletorCliente placeholder="Vendedor" value={filtroLista.idVendedor} rotulo={filtroLista.vendedor} style={{ width: 240 }}
            onChange={(id, nome) => setFiltroLista((f: any) => ({ ...f, idVendedor: id, vendedor: nome }))} />
          <Select allowClear placeholder="Situação" style={{ width: 130 }} value={filtroLista.situacao}
            onChange={v => setFiltroLista((f: any) => ({ ...f, situacao: v }))}
            options={Object.entries(SITUACOES_FECHAMENTO).map(([value, x]) => ({ value, label: x.label }))} />
        </Space>
      }>
        <Table size="small" rowKey="id" dataSource={lista} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          columns={[
            { title: 'Mês', dataIndex: 'competencia', width: 140, render: nomeMes },
            { title: 'Vendedor', dataIndex: 'vendedor' },
            ...colunasValores,
            { title: 'Situação', dataIndex: 'situacao', width: 100, render: (s: string) => <TagFech s={s} /> },
            { title: '', width: 110, render: (_: any, f: any) => acoesFechamento(f) },
          ]} />
      </Card>

      {previa && <DrawerPrevia comp={comp} {...previa} onClose={() => setPrevia(null)} />}
      {detalhe && <DrawerDetalhe id={detalhe} onClose={() => setDetalhe(null)} />}
    </>
  );
}

const colunasItens = [
  { title: 'Pago em', dataIndex: 'dataPagamento', render: fmtData, width: 90 },
  { title: 'Leilão', dataIndex: 'leilao', ellipsis: true },
  { title: 'Lote', dataIndex: 'lote', width: 55 },
  { title: 'Comprador', dataIndex: 'comprador', ellipsis: true },
  { title: 'Parcela', dataIndex: 'ordxxx', width: 70 },
  { title: 'Caiu na', dataIndex: 'recebidoEm', width: 85, render: (d: string) => (d === 'MACEDO' ? 'Leiloeira' : 'Vendedor') },
  { title: 'Valor', dataIndex: 'valor', render: fmtValor, align: 'right' as const, width: 105 },
  { title: 'Taxa', render: (_: any, i: any) => `${fmtValor(i.taxaValor)} (${i.taxaPerc}%)`, align: 'right' as const, width: 130 },
];

function DrawerPrevia({ comp, idVendedor, vendedor, onClose }: { comp: string; idVendedor: number; vendedor: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    api.get('/cobranca/fechamentos/previa', { params: { competencia: comp, idVendedor } }).then(r => setD(r.data))
      .catch(() => message.error('Erro ao carregar a prévia'));
  }, [comp, idVendedor]);
  return (
    <Drawer open width={980} title={`Prévia — ${vendedor} — ${nomeMes(comp)}`} onClose={onClose}>
      {d && <Totais t={d.totais} />}
      <Table size="small" rowKey={(i: any) => `${i.origem}${i.idBaixa}`} loading={!d} dataSource={d?.itens || []} pagination={false} columns={colunasItens} />
    </Drawer>
  );
}

function Totais({ t }: { t: any }) {
  return (
    <Descriptions size="small" bordered column={2} style={{ marginBottom: 12 }}>
      <Descriptions.Item label="Recebido na leiloeira">{fmtValor(t.recebidoMacedo)}</Descriptions.Item>
      <Descriptions.Item label="Taxa retida">{fmtValor(t.taxaRetida)}</Descriptions.Item>
      <Descriptions.Item label="Recebido pelo vendedor">{fmtValor(t.recebidoVendedor)}</Descriptions.Item>
      <Descriptions.Item label="Taxa a cobrar do vendedor">{fmtValor(t.taxaACobrar)}</Descriptions.Item>
      <Descriptions.Item label="Acerto" span={2}><Text strong>{textoSaldo(t.saldo)}</Text></Descriptions.Item>
    </Descriptions>
  );
}

function DrawerDetalhe({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get(`/cobranca/fechamentos/${id}`).then(r => setD(r.data)).catch(() => message.error('Erro ao carregar')); }, [id]);
  const f = d?.fechamento;
  return (
    <Drawer open width={980} title={f ? `${f.vendedor} — ${nomeMes(f.competencia)}` : 'Fechamento'} onClose={onClose}
      extra={f && <Button icon={<FileExcelOutlined />} onClick={() => exportarPlanilha(d.itens.map((i: any) => ({
        'Pago em': fmtData(i.dataPagamento), Leilão: i.leilao, Lote: i.lote, Comprador: i.comprador, Parcela: i.ordxxx,
        'Caiu na': i.recebidoEm === 'MACEDO' ? 'Leiloeira' : 'Vendedor', Valor: i.valor, 'Taxa %': i.taxaPerc, Taxa: i.taxaValor,
      })), `fechamento-${f.competencia}`, 'Fechamento')}>Excel</Button>}>
      {f && <>
        <Space style={{ marginBottom: 8 }}>
          <TagFech s={f.situacao} />
          <Text type="secondary">fechado em {new Date(f.dataFechamento).toLocaleDateString('pt-BR')}{f.usuario ? ` por ${f.usuario}` : ''}</Text>
          {f.observacao && <Text type="secondary">· {f.observacao}</Text>}
        </Space>
        <Totais t={f} />
      </>}
      <Table size="small" rowKey={(i: any) => `${i.origem}${i.idBaixa}`} loading={!d} dataSource={d?.itens || []} pagination={false} columns={colunasItens} />
    </Drawer>
  );
}

export async function pdfFechamento(id: number, config: { empresa?: string; logoBase64?: string | null }) {
  try {
    const { fechamento: f, itens } = (await api.get(`/cobranca/fechamentos/${id}`)).data;
    await baixarRelatorioFinanceiro({
      titulo: `Fechamento da cobrança — ${nomeMes(f.competencia)}`, subtitulo: f.vendedor, empresa: config.empresa, logoBase64: config.logoBase64,
      resumo: [
        { label: 'Recebido na leiloeira', valor: fmtValor(f.recebidoMacedo), detalhe: `taxa retida ${fmtValor(f.taxaRetida)}` },
        { label: 'Recebido pelo vendedor', valor: fmtValor(f.recebidoVendedor), detalhe: `taxa a cobrar ${fmtValor(f.taxaACobrar)}` },
        { label: 'Total da taxa', valor: fmtValor(f.taxaRetida + f.taxaACobrar) },
        { label: 'Acerto', valor: textoSaldo(f.saldo) },
      ],
      colunas: [
        { titulo: 'Pago em', flex: 0.7 }, { titulo: 'Leilão', flex: 1.6 }, { titulo: 'Lote', flex: 0.4 }, { titulo: 'Comprador', flex: 2 },
        { titulo: 'Parcela', flex: 0.6 }, { titulo: 'Caiu na', flex: 0.7 }, { titulo: 'Valor', direita: true }, { titulo: 'Taxa %', direita: true, flex: 0.5 }, { titulo: 'Taxa', direita: true },
      ],
      linhas: itens.map((i: any) => ({ celulas: [
        fmtData(i.dataPagamento), i.leilao || '', i.lote || '', i.comprador || '', i.ordxxx || '', i.recebidoEm === 'MACEDO' ? 'Leiloeira' : 'Vendedor',
        fmtValor(i.valor), `${i.taxaPerc}%`, fmtValor(i.taxaValor),
      ] })),
      total: ['', 'Total', '', '', '', '', fmtValor(f.recebidoMacedo + f.recebidoVendedor), '', fmtValor(f.taxaRetida + f.taxaACobrar)],
      rodapeNota: `Situação: ${SITUACOES_FECHAMENTO[f.situacao]?.label || f.situacao} · Intermediação de cobrança`,
    }, `fechamento-${f.competencia}-${String(f.vendedor || '').replace(/[^\w-]+/g, '_').slice(0, 40)}`);
  } catch { message.error('Erro ao gerar o PDF'); }
}
