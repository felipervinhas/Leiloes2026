import React, { useEffect, useState } from 'react';
import { Table, Typography, Row, Col, Card, Statistic, Alert, Button, Space, Spin, message } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { fmtDataUTC } from '../../utils/data';
import { fmtValor } from './Lancamentos';
import { exportarPlanilha } from './comum';

const { Title, Text } = Typography;

/**
 * Dois lados do que falta: lançamentos do extrato ainda sem dono, e o que devia ter
 * entrado (parcelas iniciais e comissão de compra vencidas no período já importado)
 * e não entrou — por comprador, para servir de lista de cobrança.
 */
export default function Pendencias() {
  const { banco } = useBanco();
  const navigate = useNavigate();
  const [dados, setDados] = useState<any | null>(null);

  useEffect(() => {
    api.get('/conciliacao/pendencias').then(r => setDados(r.data))
      .catch(e => { setDados({ lancamentos: [], compradores: [] }); message.error(e.response?.data?.error || 'Erro ao carregar'); });
  }, []);

  if (!dados) return <Spin />;
  const soma = (f: (x: any) => boolean, k: 'qtd' | 'valor') => dados.lancamentos.filter(f).reduce((a: number, x: any) => a + x[k], 0);
  const semDono = soma((x: any) => !x.comCliente, 'qtd');
  const comClienteSemBaixa = soma((x: any) => x.comCliente && x.situacao === 'PENDENTE', 'qtd');
  const sugeridos = soma((x: any) => x.situacao === 'SUGERIDO', 'qtd');
  const parciais = soma((x: any) => x.situacao === 'PARCIAL', 'qtd');
  const totalCobrar = dados.compradores.reduce((a: number, c: any) => a + c.total, 0);

  const exportar = () => exportarPlanilha(dados.compradores.flatMap((c: any) => c.itens.map((i: any) => ({
    Comprador: c.nome, Telefone: c.telefone, Leilão: i.leilao, Lote: i.lote, Item: i.descricao,
    Vencimento: fmtDataUTC(i.vencimento), 'Em aberto': i.emAberto,
  }))), 'cobranca', 'Cobrança');

  const irLancamentos = () => navigate(`/${banco}/financeiro/lancamentos`);

  return (
    <>
      <Title level={4}>Pendências</Title>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Sugestões para conferir" value={sugeridos} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Com cliente, sem baixa" value={comClienteSemBaixa} valueStyle={{ color: '#d46b08' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Sem cliente identificado" value={semDono} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Pagos em parte" value={parciais} valueStyle={{ color: '#d4b106' }} /></Card></Col>
      </Row>

      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>Vencido e não recebido</Title>
        <Button icon={<FileExcelOutlined />} disabled={!dados.compradores.length} onClick={exportar}>Excel para cobrança</Button>
      </Space>
      {!dados.periodo ? (
        <Alert type="info" showIcon message="Importe um extrato para ver o que venceu e não entrou." />
      ) : (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Parcelas iniciais e comissões de compra vencidas entre {fmtDataUTC(dados.periodo.inicio)} e {fmtDataUTC(dados.periodo.fim)} — o
            período que já tem extrato importado — sem pagamento conciliado. Total: <Text strong>{fmtValor(totalCobrar)}</Text>
          </Text>
          <Table rowKey="idCliente" size="small" dataSource={dados.compradores} pagination={{ pageSize: 30, hideOnSinglePage: true }}
            expandable={{
              expandedRowRender: (c: any) => (
                <Table rowKey={(i: any, idx?: number) => `${i.tipo}-${i.lote}-${idx}`} size="small" pagination={false} dataSource={c.itens}
                  columns={[
                    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true },
                    { title: 'Lote', dataIndex: 'lote', width: 70 },
                    { title: 'Item', dataIndex: 'descricao' },
                    { title: 'Vencimento', dataIndex: 'vencimento', width: 110, render: (v: string) => fmtDataUTC(v) },
                    { title: 'Em aberto', dataIndex: 'emAberto', width: 130, align: 'right' as const, render: fmtValor },
                  ]} />
              ),
            }}
            columns={[
              { title: 'Comprador', dataIndex: 'nome', ellipsis: true },
              { title: 'Telefone', dataIndex: 'telefone', width: 150, render: (v: string) => v || '—' },
              { title: 'Itens', width: 70, align: 'center' as const, render: (_: any, c: any) => c.itens.length },
              { title: 'Vencido desde', dataIndex: 'maisAntigo', width: 120, render: (v: string) => fmtDataUTC(v) },
              { title: 'Em aberto', dataIndex: 'total', width: 140, align: 'right' as const, render: (v: number) => <Text strong>{fmtValor(v)}</Text>,
                sorter: (a: any, b: any) => a.total - b.total },
            ]} />
        </>
      )}
    </>
  );
}
