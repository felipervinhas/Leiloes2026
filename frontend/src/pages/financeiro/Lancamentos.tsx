import React, { useEffect, useRef, useState } from 'react';
import { Table, Select, DatePicker, Input, Space, Tag, Typography, Row, Col, Card, Statistic, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { fmtDataUTC } from '../../utils/data';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const fmtValor = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const SITUACOES: Record<string, { label: string; cor: string }> = {
  PENDENTE:   { label: 'Pendente',     cor: 'orange' },
  SUGERIDO:   { label: 'Sugerido',     cor: 'blue' },
  CONCILIADO: { label: 'Conciliado',   cor: 'green' },
  PARCIAL:    { label: 'Parcial',      cor: 'gold' },
  NAO_VENDA:  { label: 'Não é venda',  cor: 'default' },
};

/** O extrato traz só os dígitos: 529.982.247-25 / 11.222.333/0001-81 */
export const docFmt = (d?: string | null) => {
  if (!d) return '';
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
};

export default function Lancamentos() {
  const [contas, setContas] = useState<{ value: number; label: string }[]>([]);
  const [idConta, setIdConta] = useState<number | undefined>();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>([dayjs().subtract(60, 'day'), dayjs()]);
  const [sentido, setSentido] = useState<string | undefined>();
  const [situacao, setSituacao] = useState<string | undefined>();
  const [busca, setBusca] = useState('');
  const [dados, setDados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    api.get('/conciliacao/contas').then(r =>
      setContas(r.data.map((c: any) => ({ value: c.id, label: c.descricao || c.acctid })))).catch(() => {});
  }, []);

  // termo vem do onSearch: o valor do campo pode ainda não estar no estado quando o Enter dispara
  // só a consulta mais recente vale: a da abertura da tela chegando depois da busca apagava o filtro
  const ultimaConsulta = useRef(0);
  const carregar = async (termo = busca) => {
    const minha = ++ultimaConsulta.current;
    setCarregando(true);
    try {
      const r = await api.get('/conciliacao/lancamentos', { params: {
        idConta, sentido, situacao, busca: termo.trim() || undefined,
        de: periodo?.[0]?.format('YYYY-MM-DD'), ate: periodo?.[1]?.format('YYYY-MM-DD'),
      } });
      if (minha === ultimaConsulta.current) setDados(r.data);
    } catch { if (minha === ultimaConsulta.current) message.error('Erro ao carregar os lançamentos'); }
    finally { if (minha === ultimaConsulta.current) setCarregando(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [idConta, periodo, sentido, situacao]);

  const creditos = dados.filter(d => d.sentido === 'C');
  const debitos = dados.filter(d => d.sentido === 'D');
  const pendentes = dados.filter(d => d.situacao === 'PENDENTE').length;

  return (
    <>
      <Title level={4}>Lançamentos</Title>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="Todas as contas" style={{ width: 220 }} options={contas} value={idConta} onChange={setIdConta} />
        <RangePicker format="DD/MM/YYYY" value={periodo as any} onChange={v => setPeriodo(v as any)} />
        <Select allowClear placeholder="Créditos e débitos" style={{ width: 170 }} value={sentido} onChange={setSentido}
          options={[{ value: 'C', label: 'Só créditos' }, { value: 'D', label: 'Só débitos' }]} />
        <Select allowClear placeholder="Todas as situações" style={{ width: 180 }} value={situacao} onChange={setSituacao}
          options={Object.entries(SITUACOES).map(([value, s]) => ({ value, label: s.label }))} />
        <Input.Search allowClear placeholder="Nome, CPF/CNPJ ou histórico" style={{ width: 260 }}
          value={busca} onChange={e => setBusca(e.target.value)} onSearch={v => carregar(v)} />
      </Space>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Lançamentos" value={dados.length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Pendentes" value={pendentes} valueStyle={{ color: '#d46b08' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Créditos" value={fmtValor(creditos.reduce((a, d) => a + d.valor, 0))} valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Débitos" value={fmtValor(debitos.reduce((a, d) => a + d.valor, 0))} valueStyle={{ color: '#cf1322' }} /></Card></Col>
      </Row>

      <Table rowKey="id" size="small" loading={carregando} dataSource={dados}
        pagination={{ pageSize: 50, showTotal: t => `${t} lançamentos` }}
        columns={[
          { title: 'Data', dataIndex: 'data', width: 100, render: (v: string) => fmtDataUTC(v),
            sorter: (a: any, b: any) => String(a.data).localeCompare(String(b.data)) },
          { title: 'Contraparte no extrato', render: (_: any, r: any) => (
              <div>
                <div>{r.nomeContraparte || r.memo}</div>
                {r.docContraparte && <Text type="secondary" style={{ fontSize: 12 }}>{docFmt(r.docContraparte)}</Text>}
              </div>) },
          { title: 'Cliente', dataIndex: 'nomeCliente',
            render: (v: string, r: any) => v || <Text type="secondary">{r.docContraparte ? 'Não cadastrado' : 'Sem CPF/CNPJ'}</Text> },
          { title: 'Valor', dataIndex: 'valor', align: 'right' as const, width: 140,
            sorter: (a: any, b: any) => a.valor - b.valor,
            render: (v: number) => <Text strong style={{ color: v < 0 ? '#cf1322' : '#389e0d' }}>{fmtValor(v)}</Text> },
          { title: 'Situação', dataIndex: 'situacao', width: 120,
            render: (v: string) => <Tag color={SITUACOES[v]?.cor}>{SITUACOES[v]?.label || v}</Tag> },
          { title: 'Conta', dataIndex: 'descricaoConta', width: 180, ellipsis: true },
        ]} />
    </>
  );
}
