import React, { useState } from 'react';
import { Table, Typography, Space, Button, Tag, Row, Col, Card, Statistic, Empty, message } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { fmtValor } from './Lancamentos';
import { fmtDataUTC } from '../../utils/data';
import { exportarPlanilha, SeletorLeilao } from './comum';

const { Title, Text } = Typography;

const SITUACAO_VENDA: Record<string, { label: string; cor: string }> = {
  QUITADO: { label: 'Quitado', cor: 'green' },
  PARCIAL: { label: 'Parcial', cor: 'gold' },
  EM_ABERTO: { label: 'Em aberto', cor: 'orange' },
};

/** Por venda do leilão: o que devia passar pela leiloeira (parcelas iniciais e comissão de compra) e o que já entrou. */
export default function Recebimentos() {
  const [idLeilao, setIdLeilao] = useState<number | undefined>();
  const [nomeLeilao, setNomeLeilao] = useState('');
  const [dados, setDados] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = async (id?: number) => {
    setDados(null);
    if (!id) return;
    setCarregando(true);
    try { setDados((await api.get('/conciliacao/relatorios/recebimentos', { params: { idLeilao: id } })).data); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao carregar'); }
    finally { setCarregando(false); }
  };

  const exportar = () => exportarPlanilha(dados.linhas.map((l: any) => ({
    Lote: l.lote, Comprador: l.comprador, Telefone: l.telefone, Vendedor: l.vendedor, Condição: l.condicao,
    'Parcelas da leiloeira (previsto)': l.previstoParcelas, 'Parcelas recebidas': l.recebidoParcelas,
    'Comissão de compra (prevista)': l.previstoComissao, 'Comissão recebida': l.recebidoComissao,
    'Total previsto': l.previsto, 'Total recebido': l.recebido, 'Vencido em aberto': l.vencidoAberto,
    'Recebido de parcelas posteriores': l.recebidoOutras, Situação: SITUACAO_VENDA[l.situacao]?.label,
  })), `recebimentos-${nomeLeilao.replace(/[^\w-]+/g, '_').slice(0, 50)}`, 'Recebimentos');

  return (
    <>
      <Title level={4}>Recebimentos por leilão</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Para cada venda, o que devia passar pela leiloeira (parcelas iniciais e comissão de compra) e o que já
        foi conciliado no extrato. "Vencido em aberto" só considera o período que já tem extrato importado.
      </Text>
      <Space style={{ marginBottom: 16 }}>
        <SeletorLeilao value={idLeilao} onChange={(id, nome) => { setIdLeilao(id); setNomeLeilao(nome || ''); carregar(id); }} />
        <Button icon={<FileExcelOutlined />} disabled={!dados?.linhas?.length} onClick={exportar}>Excel</Button>
      </Space>

      {!idLeilao ? <Empty description="Escolha o leilão" /> : (
        <>
          {dados?.totais && (
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Previsto" value={fmtValor(dados.totais.previsto)} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Recebido" value={fmtValor(dados.totais.recebido)} valueStyle={{ color: '#389e0d' }} /></Card></Col>
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
              { title: 'Previsto', dataIndex: 'previsto', align: 'right' as const, width: 120, render: fmtValor,
                sorter: (a: any, b: any) => a.previsto - b.previsto },
              { title: 'Recebido', dataIndex: 'recebido', align: 'right' as const, width: 120,
                render: (v: number) => <Text style={{ color: v > 0 ? '#389e0d' : undefined }}>{fmtValor(v)}</Text> },
              { title: 'Vencido em aberto', dataIndex: 'vencidoAberto', align: 'right' as const, width: 140,
                sorter: (a: any, b: any) => a.vencidoAberto - b.vencidoAberto,
                render: (v: number) => v > 0 ? <Text type="warning">{fmtValor(v)}</Text> : '—' },
              { title: 'Situação', dataIndex: 'situacao', width: 110,
                filters: Object.entries(SITUACAO_VENDA).map(([value, s]) => ({ value, text: s.label })),
                onFilter: (v: any, r: any) => r.situacao === v,
                render: (v: string) => <Tag color={SITUACAO_VENDA[v]?.cor}>{SITUACAO_VENDA[v]?.label}</Tag> },
            ]} />
        </>
      )}
    </>
  );
}
