import React, { useEffect, useState } from 'react';
import { Table, Typography, Row, Col, Card, Statistic, Alert, Button, Space, Spin, DatePicker, message } from 'antd';
import { Dayjs } from 'dayjs';
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { useConfig } from '../../context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { fmtDataUTC } from '../../utils/data';
import { fmtValor } from './Lancamentos';
import { exportarPlanilha } from './comum';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * Dois lados do que falta: lançamentos do extrato ainda sem dono, e o que devia ter
 * entrado (parcelas iniciais e comissão de compra vencidas no período já importado)
 * e não entrou — por comprador, para servir de lista de cobrança.
 */
export default function Pendencias() {
  const { banco } = useBanco();
  const navigate = useNavigate();
  const [dados, setDados] = useState<any | null>(null);
  // vazio = todo o período com extrato importado
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const config = useConfig();

  useEffect(() => {
    api.get('/conciliacao/pendencias', { params: periodo ? { de: periodo[0].format('YYYY-MM-DD'), ate: periodo[1].format('YYYY-MM-DD') } : {} })
      .then(r => setDados(r.data))
      .catch(e => { setDados({ lancamentos: [], compradores: [] }); message.error(e.response?.data?.error || 'Erro ao carregar'); });
  }, [periodo]);

  if (!dados) return <Spin />;
  const soma = (f: (x: any) => boolean, k: 'qtd' | 'valor') => dados.lancamentos.filter(f).reduce((a: number, x: any) => a + x[k], 0);
  const semDono = soma((x: any) => !x.comCliente, 'qtd');
  const comClienteSemBaixa = soma((x: any) => x.comCliente && x.situacao === 'PENDENTE', 'qtd');
  const sugeridos = soma((x: any) => x.situacao === 'SUGERIDO', 'qtd');
  const parciais = soma((x: any) => x.situacao === 'PARCIAL', 'qtd');
  const totalCobrar = dados.compradores.reduce((a: number, c: any) => a + c.total, 0);

  // lista de cobrança: uma linha por comprador (com o total) e os itens dele logo abaixo
  const imprimir = async () => {
    setGerandoPdf(true);
    try {
      await baixarRelatorioFinanceiro({
        titulo: 'Vencido e não recebido', empresa: config.empresa, logoBase64: config.logoBase64,
        subtitulo: `Vencimentos de ${fmtDataUTC(dados.periodo.inicio)} a ${fmtDataUTC(dados.periodo.fim)}, período com extrato importado`,
        resumo: [
          { label: 'Compradores', valor: String(dados.compradores.length) },
          { label: 'Total em aberto', valor: fmtValor(totalCobrar) },
        ],
        colunas: [
          { titulo: 'Comprador / item', flex: 2.6 }, { titulo: 'Telefone / leilão', flex: 2.2 }, { titulo: 'Lote', flex: 0.5 },
          { titulo: 'Vencimento', flex: 0.8 }, { titulo: 'Em aberto', direita: true },
        ],
        linhas: dados.compradores.flatMap((c: any) => [
          { destaque: true, celulas: [c.nome, c.telefone || '', '', `desde ${fmtDataUTC(c.maisAntigo)}`, fmtValor(c.total)] },
          ...c.itens.map((i: any) => ({ recuo: true, celulas: [i.descricao, i.leilao || '', i.lote || '', fmtDataUTC(i.vencimento), fmtValor(i.emAberto)] })),
        ]),
        total: ['Total', '', '', '', fmtValor(totalCobrar)],
        rodapeNota: 'Parcelas iniciais e comissões de compra sem pagamento conciliado',
      }, 'cobranca');
    } catch { message.error('Erro ao gerar o PDF'); }
    finally { setGerandoPdf(false); }
  };

  const exportar = () => exportarPlanilha(dados.compradores.flatMap((c: any) => c.itens.map((i: any) => ({
    Comprador: c.nome, Telefone: c.telefone, Leilão: i.leilao, Lote: i.lote, Item: i.descricao,
    Vencimento: fmtDataUTC(i.vencimento), 'Em aberto': i.emAberto,
  }))), 'cobranca', 'Cobrança');

  const irLancamentos = () => navigate(`/${banco}/financeiro/lancamentos`);

  return (
    <>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Pendências</Title>
        <Space>
          <Text type="secondary">Período</Text>
          <RangePicker format="DD/MM/YYYY" allowClear placeholder={['Desde o início', 'Até hoje']}
            value={periodo as any} onChange={v => setPeriodo(v as any)} />
        </Space>
      </Space>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Sugestões para conferir" value={sugeridos} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Com cliente, sem baixa" value={comClienteSemBaixa} valueStyle={{ color: '#d46b08' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Sem cliente identificado" value={semDono} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={irLancamentos}><Statistic title="Pagos em parte" value={parciais} valueStyle={{ color: '#d4b106' }} /></Card></Col>
      </Row>

      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>Vencido e não recebido</Title>
        <Space>
          <Button icon={<FilePdfOutlined />} disabled={!dados.compradores.length} loading={gerandoPdf} onClick={imprimir}>PDF</Button>
          <Button icon={<FileExcelOutlined />} disabled={!dados.compradores.length} onClick={exportar}>Excel para cobrança</Button>
        </Space>
      </Space>
      {!dados.periodo ? (
        <Alert type="info" showIcon message={dados.foraDoExtrato
          ? 'O período escolhido está fora das datas com extrato importado — não há como saber o que não entrou.'
          : 'Importe um extrato para ver o que venceu e não entrou.'} />
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
