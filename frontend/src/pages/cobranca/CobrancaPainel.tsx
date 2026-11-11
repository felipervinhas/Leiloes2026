import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, Empty, Button, Spin, Table, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { fmtData, fmtValor } from './comum';

const { Title, Text } = Typography;

export default function CobrancaPainel() {
  const { banco } = useBanco();
  const navigate = useNavigate();
  const [resumo, setResumo] = useState<any>(null);
  const [vencidas, setVencidas] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.get('/cobranca/resumo'), api.get('/cobranca/parcelas', { params: { situacao: 'VENCIDA' } })])
      .then(([r, v]) => { setResumo(r.data); setVencidas(v.data); })
      .catch(() => { setResumo({}); message.error('Erro ao carregar o painel'); });
  }, []);

  if (!resumo) return <Spin />;
  if (!resumo.lotes) {
    return (
      <>
        <Title level={4}>Painel</Title>
        <Empty description="Nenhum lote em cobrança ainda">
          <Button type="primary" onClick={() => navigate(`/${banco}/cobranca/lotes`)}>Incluir lotes na cobrança</Button>
        </Empty>
      </>
    );
  }

  // vencidas agrupadas por comprador: quem cobrar primeiro
  const porComprador = new Map<number, any>();
  for (const p of vencidas) {
    const a = porComprador.get(p.idComprador) || { idComprador: p.idComprador, comprador: p.comprador, vendedores: new Set<string>(), qtd: 0, valor: 0, maisAntiga: p.vencimento };
    a.qtd++; a.valor += p.saldo; a.vendedores.add(p.vendedor);
    if (p.vencimento < a.maisAntiga) a.maisAntiga = p.vencimento;
    porComprador.set(p.idComprador, a);
  }
  const linhas = Array.from(porComprador.values()).sort((a, b) => b.valor - a.valor);

  return (
    <>
      <Title level={4}>Painel</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Lotes em cobrança" value={resumo.lotes} />
          <Text type="secondary">{resumo.vendedores} vendedor{resumo.vendedores > 1 ? 'es' : ''} · {resumo.compradores} comprador{resumo.compradores > 1 ? 'es' : ''}</Text></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="A receber" value={fmtValor(resumo.valorEmAberto)} />
          <Text type="secondary">{resumo.parcelasEmAberto} parcelas</Text></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Vencido" value={fmtValor(resumo.valorVencido)} valueStyle={{ color: resumo.valorVencido > 0 ? '#cf1322' : undefined }} />
          <Text type="secondary">{resumo.parcelasVencidas} parcelas</Text></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Vence neste mês" value={fmtValor(resumo.valorVencendoNoMes)} />
          <Text type="secondary">{resumo.vencendoNoMes} parcelas · recebido no mês {fmtValor(resumo.recebidoNoMes)}</Text></Card></Col>
      </Row>
      <Card title="Compradores com parcelas vencidas" extra={<Button onClick={() => navigate(`/${banco}/cobranca/parcelas?situacao=VENCIDA`)}>Ver parcelas</Button>}>
        <Table size="small" rowKey="idComprador" dataSource={linhas} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: 'Nenhuma parcela vencida' }}
          onRow={r => ({ style: { cursor: 'pointer' }, onClick: () => navigate(`/${banco}/cobranca/parcelas?situacao=VENCIDA&idComprador=${r.idComprador}&comprador=${encodeURIComponent(r.comprador || '')}`) })}
          columns={[
            { title: 'Comprador', dataIndex: 'comprador' },
            { title: 'Vendedor', render: (_: any, r: any) => Array.from(r.vendedores).join(', ') },
            { title: 'Parcelas', dataIndex: 'qtd', align: 'right' as const, width: 90 },
            { title: 'Mais antiga', dataIndex: 'maisAntiga', render: fmtData, width: 110 },
            { title: 'Valor vencido', dataIndex: 'valor', align: 'right' as const, render: fmtValor, width: 140 },
          ]} />
      </Card>
    </>
  );
}
