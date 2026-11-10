import React, { useState } from 'react';
import { Segmented, Table, Typography, Space, Button, Tag, Row, Col, Card, Statistic, Empty, message } from 'antd';
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { useConfig } from '../../context/ConfigContext';
import api from '../../services/api';
import { fmtValor } from './Lancamentos';
import { fmtDataUTC } from '../../utils/data';
import { exportarPlanilha, SeletorLeilao } from './comum';
import MovimentosPeriodo from './MovimentosPeriodo';

const { Title, Text } = Typography;

const SITUACAO_VENDA: Record<string, { label: string; cor: string }> = {
  QUITADO: { label: 'Quitado', cor: 'green' },
  PARCIAL: { label: 'Parcial', cor: 'gold' },
  EM_ABERTO: { label: 'Em aberto', cor: 'orange' },
};

// Comissão e entrada podem ser pagas em dias diferentes: mostra as duas datas quando diferem
const textoPagoEm = (l: any): string[] => {
  const c = l.dataPagamentoComissao, p = l.dataPagamentoParcelas;
  if (c && p && c !== p) return [`Entrada ${fmtDataUTC(p)}`, `Comissão ${fmtDataUTC(c)}`];
  return c || p ? [fmtDataUTC(c || p)] : [];
};

// "Entrada" = parcelas iniciais que passam pela leiloeira; "Comissão" = comissão de compra do comprador
const detalhePorTipo = (entrada: number, comissao: number) => `Entrada ${fmtValor(entrada)} · Comissão ${fmtValor(comissao)}`;
const valorOuTraco = (v: number) => (v ? fmtValor(v) : '—');
const renderRecebido = (v: number) => (v ? <Text style={{ color: '#389e0d' }}>{fmtValor(v)}</Text> : '—');

/** Por venda do leilão: o que devia passar pela leiloeira (parcelas iniciais e comissão de compra) e o que já entrou. */
export default function Recebimentos() {
  const [modo, setModo] = useState<'leilao' | 'periodo'>('leilao');
  return (
    <>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Recebimentos {modo === 'leilao' ? 'por leilão' : 'por período'}</Title>
        <Segmented value={modo} onChange={v => setModo(v as any)}
          options={[{ value: 'leilao', label: 'Por leilão' }, { value: 'periodo', label: 'Por período (data do extrato)' }]} />
      </Space>
      {modo === 'leilao' ? <RecebimentosPorLeilao /> : <MovimentosPeriodo lado="recebimentos" />}
    </>
  );
}

function RecebimentosPorLeilao() {
  const [idLeilao, setIdLeilao] = useState<number | undefined>();
  const [nomeLeilao, setNomeLeilao] = useState('');
  const [dados, setDados] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const config = useConfig();

  const carregar = async (id?: number) => {
    setDados(null);
    if (!id) return;
    setCarregando(true);
    try { setDados((await api.get('/conciliacao/relatorios/recebimentos', { params: { idLeilao: id } })).data); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao carregar'); }
    finally { setCarregando(false); }
  };

  const imprimir = async () => {
    setGerandoPdf(true);
    try {
      const t = dados.totais;
      await baixarRelatorioFinanceiro({
        titulo: 'Recebimentos por leilão', subtitulo: nomeLeilao, empresa: config.empresa, logoBase64: config.logoBase64,
        resumo: [
          { label: 'Previsto', valor: fmtValor(t.previsto), detalhe: detalhePorTipo(t.previstoParcelas, t.previstoComissao) },
          { label: 'Recebido', valor: fmtValor(t.recebido), detalhe: detalhePorTipo(t.recebidoParcelas, t.recebidoComissao) },
          { label: dados.periodo ? `Vencido em aberto (${fmtDataUTC(dados.periodo.inicio)} a ${fmtDataUTC(dados.periodo.fim)})` : 'Vencido em aberto', valor: fmtValor(t.vencidoAberto) },
          { label: 'Vendas quitadas', valor: `${t.quitadas} de ${t.vendas}` },
        ],
        colunas: [
          { titulo: 'Lote', flex: 0.4 }, { titulo: 'Comprador', flex: 2 }, { titulo: 'Vendedor', flex: 1.7 }, { titulo: 'Condição', flex: 1.3 },
          { titulo: 'Entrada prev.', direita: true }, { titulo: 'Entrada receb.', direita: true },
          { titulo: 'Comissão prev.', direita: true }, { titulo: 'Comissão receb.', direita: true },
          { titulo: 'Pago em', flex: 1.3 }, { titulo: 'Vencido em aberto', direita: true }, { titulo: 'Situação', flex: 0.7 },
        ],
        linhas: dados.linhas.map((l: any) => ({ celulas: [l.lote || '', l.comprador || '', l.vendedor || '', l.condicao || '',
          valorOuTraco(l.previstoParcelas), valorOuTraco(l.recebidoParcelas), valorOuTraco(l.previstoComissao), valorOuTraco(l.recebidoComissao),
          textoPagoEm(l).join(' / ') || '—', l.vencidoAberto > 0 ? fmtValor(l.vencidoAberto) : '—', SITUACAO_VENDA[l.situacao]?.label || ''] })),
        total: ['', 'Total', '', '', fmtValor(t.previstoParcelas), fmtValor(t.recebidoParcelas), fmtValor(t.previstoComissao), fmtValor(t.recebidoComissao),
          '', fmtValor(t.vencidoAberto), ''],
        rodapeNota: 'Entrada = parcelas iniciais pagas à leiloeira · Comissão = comissão de compra · Recebido = conciliado no extrato',
      }, `recebimentos-${nomeLeilao.replace(/[^\w-]+/g, '_').slice(0, 50)}`);
    } catch { message.error('Erro ao gerar o PDF'); }
    finally { setGerandoPdf(false); }
  };

  const exportar = () => exportarPlanilha(dados.linhas.map((l: any) => ({
    Lote: l.lote, Comprador: l.comprador, Telefone: l.telefone, Vendedor: l.vendedor, Condição: l.condicao,
    'Entrada (prevista)': l.previstoParcelas, 'Entrada recebida': l.recebidoParcelas,
    'Comissão de compra (prevista)': l.previstoComissao, 'Comissão recebida': l.recebidoComissao,
    'Data pagamento comissão': l.dataPagamentoComissao ? fmtDataUTC(l.dataPagamentoComissao) : '',
    'Data pagamento entrada': l.dataPagamentoParcelas ? fmtDataUTC(l.dataPagamentoParcelas) : '',
    'Total previsto': l.previsto, 'Total recebido': l.recebido, 'Vencido em aberto': l.vencidoAberto,
    'Recebido de parcelas posteriores': l.recebidoOutras, Situação: SITUACAO_VENDA[l.situacao]?.label,
  })), `recebimentos-${nomeLeilao.replace(/[^\w-]+/g, '_').slice(0, 50)}`, 'Recebimentos');

  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Para cada venda, o que devia passar pela leiloeira (a entrada, ou seja, as parcelas iniciais, e a comissão de compra) e o que já
        foi conciliado no extrato. "Vencido em aberto" só considera o período que já tem extrato importado.
      </Text>
      <Space style={{ marginBottom: 16 }}>
        <SeletorLeilao value={idLeilao} onChange={(id, nome) => { setIdLeilao(id); setNomeLeilao(nome || ''); carregar(id); }} />
        <Button icon={<FilePdfOutlined />} disabled={!dados?.linhas?.length} loading={gerandoPdf} onClick={imprimir}>PDF</Button>
        <Button icon={<FileExcelOutlined />} disabled={!dados?.linhas?.length} onClick={exportar}>Excel</Button>
      </Space>

      {!idLeilao ? <Empty description="Escolha o leilão" /> : (
        <>
          {dados?.totais && (
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Previsto" value={fmtValor(dados.totais.previsto)} />
                <Text type="secondary" style={{ fontSize: 12 }}>{detalhePorTipo(dados.totais.previstoParcelas, dados.totais.previstoComissao)}</Text></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Recebido" value={fmtValor(dados.totais.recebido)} valueStyle={{ color: '#389e0d' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>{detalhePorTipo(dados.totais.recebidoParcelas, dados.totais.recebidoComissao)}</Text></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic
                title={dados.periodo ? `Vencido em aberto (${fmtDataUTC(dados.periodo.inicio)} a ${fmtDataUTC(dados.periodo.fim)})` : 'Vencido em aberto'}
                value={fmtValor(dados.totais.vencidoAberto)} valueStyle={{ color: '#d46b08' }} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Vendas quitadas" value={`${dados.totais.quitadas} de ${dados.totais.vendas}`} /></Card></Col>
            </Row>
          )}
          <Table rowKey="idMovComprador" size="small" loading={carregando} dataSource={dados?.linhas || []}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            columns={[
              { title: 'Lote', dataIndex: 'lote', width: 70 },
              { title: 'Comprador', dataIndex: 'comprador', ellipsis: true },
              { title: 'Vendedor', dataIndex: 'vendedor', ellipsis: true },
              { title: 'Condição', dataIndex: 'condicao', ellipsis: true, width: 160 },
              { title: 'Entrada', children: [
                { title: 'Previsto', dataIndex: 'previstoParcelas', align: 'right' as const, width: 115, render: valorOuTraco,
                  sorter: (a: any, b: any) => a.previstoParcelas - b.previstoParcelas },
                { title: 'Recebido', dataIndex: 'recebidoParcelas', align: 'right' as const, width: 115, render: renderRecebido },
              ] },
              { title: 'Comissão', children: [
                { title: 'Previsto', dataIndex: 'previstoComissao', align: 'right' as const, width: 115, render: valorOuTraco,
                  sorter: (a: any, b: any) => a.previstoComissao - b.previstoComissao },
                { title: 'Recebido', dataIndex: 'recebidoComissao', align: 'right' as const, width: 115, render: renderRecebido },
              ] },
              { title: 'Pago em', dataIndex: 'dataPagamento', width: 150,
                sorter: (a: any, b: any) => String(a.dataPagamento || '').localeCompare(String(b.dataPagamento || '')),
                render: (_: any, l: any) => {
                  const t = textoPagoEm(l);
                  return t.length ? t.map(x => <div key={x} style={{ fontSize: t.length > 1 ? 12 : undefined }}>{x}</div>) : '—';
                } },
              { title: 'Vencido em aberto', dataIndex: 'vencidoAberto', align: 'right' as const, width: 140,
                sorter: (a: any, b: any) => a.vencidoAberto - b.vencidoAberto,
                render: (v: number) => v > 0 ? <Text type="warning">{fmtValor(v)}</Text> : '—' },
              { title: 'Situação', dataIndex: 'situacao', width: 110,
                filters: Object.entries(SITUACAO_VENDA).map(([value, s]) => ({ value, text: s.label })),
                onFilter: (v: any, r: any) => r.situacao === v,
                render: (v: string) => <Tag color={SITUACAO_VENDA[v]?.cor}>{SITUACAO_VENDA[v]?.label}</Tag> },
            ]}
            summary={() => dados?.totais && (
              <Table.Summary.Row style={{ fontWeight: 600 }}>
                <Table.Summary.Cell index={0} colSpan={4}>Total</Table.Summary.Cell>
                {[dados.totais.previstoParcelas, dados.totais.recebidoParcelas, dados.totais.previstoComissao, dados.totais.recebidoComissao]
                  .map((v: number, i: number) => <Table.Summary.Cell key={i} index={4 + i} align="right">{fmtValor(v)}</Table.Summary.Cell>)}
                <Table.Summary.Cell index={8} />
                <Table.Summary.Cell index={9} align="right">{fmtValor(dados.totais.vencidoAberto)}</Table.Summary.Cell>
                <Table.Summary.Cell index={10} />
              </Table.Summary.Row>
            )} />
          {dados?.totais?.recebidoOutras > 0 && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Também entraram {fmtValor(dados.totais.recebidoOutras)} de parcelas posteriores à entrada (detalhadas no Excel).
            </Text>
          )}
        </>
      )}
    </>
  );
}
