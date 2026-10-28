import React, { useEffect, useState } from 'react';
import { Table, Typography, Space, Button, DatePicker, Row, Col, Card, Statistic, message } from 'antd';
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { fmtDataUTC } from '../../utils/data';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { fmtValor, docFmt } from './Lancamentos';
import { exportarPlanilha } from './comum';

const { Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * O que entrou (recebimentos) ou saiu para vendedores (repasses) pelo extrato num período,
 * pela data do lançamento, de qualquer leilão. Uma linha por baixa: o pagamento que cobriu
 * vários itens aparece em várias linhas.
 */
export default function MovimentosPeriodo({ lado }: { lado: 'recebimentos' | 'repasses' }) {
  const config = useConfig();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('month'), dayjs()]);
  const [dados, setDados] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const recebimentos = lado === 'recebimentos';
  const rota = recebimentos ? '/conciliacao/relatorios/recebimentos' : '/conciliacao/repasses';
  const titulo = recebimentos ? 'Recebimentos por período' : 'Repasses por período';

  useEffect(() => {
    setDados(null);
    if (!periodo) return;
    setCarregando(true);
    api.get(rota, { params: { de: periodo[0].format('YYYY-MM-DD'), ate: periodo[1].format('YYYY-MM-DD') } })
      .then(r => setDados(r.data)).catch(e => message.error(e.response?.data?.error || 'Erro ao carregar'))
      .finally(() => setCarregando(false));
  }, [periodo, rota]);

  const textoPeriodo = periodo ? `${periodo[0].format('DD/MM/YYYY')} a ${periodo[1].format('DD/MM/YYYY')}` : '';
  const arquivo = `${lado}-${periodo?.[0].format('YYYY-MM-DD')}-a-${periodo?.[1].format('YYYY-MM-DD')}`;
  const pessoa = (l: any) => (recebimentos ? l.comprador : l.vendedor) || '';

  const exportar = () => exportarPlanilha(dados.linhas.map((l: any) => ({
    Data: fmtDataUTC(l.data), 'No extrato': l.noExtrato, 'CPF/CNPJ': docFmt(l.docExtrato),
    [recebimentos ? 'Comprador' : 'Vendedor']: pessoa(l), ...(recebimentos ? { Vendedor: l.vendedor } : {}),
    Leilão: l.leilao, Lote: l.lote, Item: l.descricao, Valor: l.valor, Conta: l.conta,
  })), arquivo, recebimentos ? 'Recebimentos' : 'Repasses');

  const imprimir = async () => {
    setGerandoPdf(true);
    try {
      await baixarRelatorioFinanceiro({
        titulo, subtitulo: textoPeriodo, empresa: config.empresa, logoBase64: config.logoBase64,
        resumo: [
          { label: 'Total', valor: fmtValor(dados.total) }, { label: 'Lançamentos do extrato', valor: String(dados.lancamentos) },
          ...dados.porLeilao.slice(0, 2).map((g: any) => ({ label: g.leilao, valor: fmtValor(g.total) })),
        ],
        colunas: [
          { titulo: 'Data', flex: 0.7 }, { titulo: 'No extrato', flex: 2 }, { titulo: recebimentos ? 'Comprador' : 'Vendedor', flex: 2 },
          { titulo: 'Leilão', flex: 2.2 }, { titulo: 'Lote', flex: 0.5 }, { titulo: 'Item', flex: 1.2 }, { titulo: 'Valor', direita: true },
        ],
        linhas: dados.linhas.map((l: any) => ({ celulas: [fmtDataUTC(l.data), l.noExtrato || '', pessoa(l), l.leilao || '', l.lote || '', l.descricao, fmtValor(l.valor)] })),
        total: ['Total', '', '', '', '', '', fmtValor(dados.total)],
        rodapeNota: recebimentos ? 'Créditos do extrato conciliados com parcelas e comissões de compra' : 'Débitos do extrato conciliados com repasses e acertos de vendedor',
      }, arquivo);
    } catch { message.error('Erro ao gerar o PDF'); }
    finally { setGerandoPdf(false); }
  };

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <RangePicker format="DD/MM/YYYY" value={periodo as any} onChange={v => setPeriodo(v as any)} />
        <Button icon={<FilePdfOutlined />} disabled={!dados?.linhas?.length} loading={gerandoPdf} onClick={imprimir}>PDF</Button>
        <Button icon={<FileExcelOutlined />} disabled={!dados?.linhas?.length} onClick={exportar}>Excel</Button>
      </Space>

      {dados && (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col xs={24} md={8}>
            <Card size="small"><Statistic title={`${recebimentos ? 'Recebido' : 'Repassado'} · ${textoPeriodo}`} value={fmtValor(dados.total)}
              valueStyle={{ color: recebimentos ? '#389e0d' : '#cf1322' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{dados.lancamentos} lançamento{dados.lancamentos === 1 ? '' : 's'} do extrato</Text>
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card size="small" title="Por leilão" styles={{ body: { padding: 0 } }}>
              <Table rowKey="leilao" size="small" pagination={{ pageSize: 5, hideOnSinglePage: true }} dataSource={dados.porLeilao}
                columns={[
                  { title: 'Leilão', dataIndex: 'leilao', ellipsis: true },
                  { title: 'Itens', dataIndex: 'qtd', width: 80, align: 'right' as const },
                  { title: 'Total', dataIndex: 'total', width: 150, align: 'right' as const, render: fmtValor },
                ]} />
            </Card>
          </Col>
        </Row>
      )}

      <Table rowKey="id" size="small" loading={carregando} dataSource={dados?.linhas || []} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        scroll={{ x: 1000 }}
        columns={[
          { title: 'Data', dataIndex: 'data', width: 100, render: (v: string) => fmtDataUTC(v),
            sorter: (a: any, b: any) => String(a.data).localeCompare(String(b.data)) },
          { title: 'No extrato', dataIndex: 'noExtrato', ellipsis: true,
            render: (v: string, l: any) => <span>{v || '—'}{l.docExtrato && <Text type="secondary" style={{ fontSize: 12 }}> · {docFmt(l.docExtrato)}</Text>}</span> },
          { title: recebimentos ? 'Comprador' : 'Vendedor', ellipsis: true, render: (_: any, l: any) => pessoa(l) || '—' },
          ...(recebimentos ? [{ title: 'Vendedor', dataIndex: 'vendedor', ellipsis: true, render: (v: string) => v || '—' }] : []),
          { title: 'Leilão', dataIndex: 'leilao', ellipsis: true, render: (v: string) => v || '—' },
          { title: 'Lote', dataIndex: 'lote', width: 70, render: (v: string) => v || '—' },
          { title: 'Item', dataIndex: 'descricao', width: 170 },
          { title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{fmtValor(v)}</Text>,
            sorter: (a: any, b: any) => a.valor - b.valor },
        ]} />
    </>
  );
}
