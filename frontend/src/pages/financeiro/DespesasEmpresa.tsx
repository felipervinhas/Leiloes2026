import React, { useEffect, useState } from 'react';
import { Table, Typography, Space, Button, DatePicker, Select, Row, Col, Card, Statistic, message } from 'antd';
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { fmtDataUTC } from '../../utils/data';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { fmtValor, docFmt } from './Lancamentos';
import { exportarPlanilha } from './comum';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/** Despesas da própria empresa registradas na conciliação, com o total por categoria. */
export default function DespesasEmpresa() {
  const config = useConfig();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('month').subtract(1, 'month'), dayjs()]);
  const [idsCategoria, setIdsCategoria] = useState<number[]>([]);
  const [categorias, setCategorias] = useState<{ value: number; label: string }[]>([]);
  const [dados, setDados] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    api.get('/conciliacao/config/categorias', { params: { todas: '1' } })
      .then(r => setCategorias(r.data.map((c: any) => ({ value: c.id, label: c.nome })))).catch(() => {});
  }, []);

  useEffect(() => {
    setCarregando(true);
    api.get('/conciliacao/relatorios/despesas', { params: {
      de: periodo?.[0]?.format('YYYY-MM-DD'), ate: periodo?.[1]?.format('YYYY-MM-DD'), idsCategoria: idsCategoria.join(',') || undefined,
    } }).then(r => setDados(r.data)).catch(() => message.error('Erro ao carregar as despesas')).finally(() => setCarregando(false));
  }, [periodo, idsCategoria]);

  const textoPeriodo = periodo ? `${periodo[0].format('DD/MM/YYYY')} a ${periodo[1].format('DD/MM/YYYY')}` : 'Todo o período';

  const exportar = () => exportarPlanilha(dados.linhas.map((l: any) => ({
    Data: fmtDataUTC(l.data), Categoria: l.categoria, Fornecedor: l.fornecedor, 'CPF/CNPJ': docFmt(l.docFornecedor),
    Valor: l.valor, Leilão: l.leilao || '', Observação: l.observacao || '', Conta: l.conta || '', 'Registrado por': l.usuario || '',
  })), 'despesas-empresa', 'Despesas');

  const imprimir = async () => {
    setGerandoPdf(true);
    try {
      await baixarRelatorioFinanceiro({
        titulo: 'Despesas da empresa',
        subtitulo: idsCategoria.length
          ? `${textoPeriodo} · ${categorias.filter(c => idsCategoria.includes(c.value)).map(c => c.label).join(', ')}`
          : textoPeriodo, empresa: config.empresa, logoBase64: config.logoBase64,
        resumo: [
          { label: 'Total', valor: fmtValor(dados.total) },
          ...dados.porCategoria.slice(0, 4).map((c: any) => ({ label: c.categoria, valor: fmtValor(c.total) })),
        ],
        colunas: [
          { titulo: 'Data', flex: 0.7 }, { titulo: 'Categoria', flex: 1.4 }, { titulo: 'Fornecedor', flex: 2.2 },
          { titulo: 'Leilão', flex: 1.8 }, { titulo: 'Observação', flex: 1.6 }, { titulo: 'Valor', direita: true },
        ],
        linhas: dados.linhas.map((l: any) => ({ celulas: [fmtDataUTC(l.data), l.categoria || '', l.fornecedor || '', l.leilao || '', l.observacao || '', fmtValor(l.valor)] })),
        total: ['Total', '', '', '', '', fmtValor(dados.total)],
        rodapeNota: 'Débitos do extrato registrados como despesa da empresa',
      }, 'despesas-empresa');
    } catch { message.error('Erro ao gerar o PDF'); }
    finally { setGerandoPdf(false); }
  };

  return (
    <>
      <Title level={4}>Despesas da empresa</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Débitos do extrato registrados como despesa da própria empresa (aluguel de veículo, seguro, telefone...).
        Despesas cobradas de vendedor ou comprador ficam nas Despesas do leilão.
      </Text>
      <Space wrap style={{ marginBottom: 12 }}>
        <RangePicker format="DD/MM/YYYY" value={periodo as any} onChange={v => setPeriodo(v as any)} />
        <Select mode="multiple" allowClear maxTagCount="responsive" placeholder="Todas as categorias" style={{ minWidth: 260, maxWidth: 480 }}
          options={categorias} value={idsCategoria} onChange={setIdsCategoria} optionFilterProp="label" />
        <Button icon={<FilePdfOutlined />} disabled={!dados?.linhas?.length} loading={gerandoPdf} onClick={imprimir}>PDF</Button>
        <Button icon={<FileExcelOutlined />} disabled={!dados?.linhas?.length} onClick={exportar}>Excel</Button>
      </Space>

      {dados && (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col xs={24} md={8}><Card size="small"><Statistic title={`Total · ${textoPeriodo}`} value={fmtValor(dados.total)} valueStyle={{ color: '#cf1322' }} /></Card></Col>
          <Col xs={24} md={16}>
            <Card size="small" title="Por categoria" styles={{ body: { padding: 0 } }}>
              <Table rowKey="categoria" size="small" pagination={false} dataSource={dados.porCategoria}
                columns={[
                  { title: 'Categoria', dataIndex: 'categoria' },
                  { title: 'Lançamentos', dataIndex: 'qtd', width: 120, align: 'right' as const },
                  { title: 'Total', dataIndex: 'total', width: 150, align: 'right' as const, render: fmtValor },
                ]} />
            </Card>
          </Col>
        </Row>
      )}

      <Table rowKey="id" size="small" loading={carregando} dataSource={dados?.linhas || []} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        columns={[
          { title: 'Data', dataIndex: 'data', width: 100, render: (v: string) => fmtDataUTC(v) },
          { title: 'Categoria', dataIndex: 'categoria', width: 180 },
          { title: 'Fornecedor', dataIndex: 'fornecedor', ellipsis: true,
            render: (v: string, l: any) => <span>{v || '—'}{l.docFornecedor && <Text type="secondary" style={{ fontSize: 12 }}> · {docFmt(l.docFornecedor)}</Text>}</span> },
          { title: 'Leilão', dataIndex: 'leilao', ellipsis: true, render: (v: string) => v || '—' },
          { title: 'Observação', dataIndex: 'observacao', ellipsis: true, render: (v: string) => v || '—' },
          { title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{fmtValor(v)}</Text> },
        ]} />
    </>
  );
}
