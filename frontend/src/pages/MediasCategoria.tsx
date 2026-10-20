import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Row, Col, DatePicker, Select, Button, Space, Checkbox, Input, Table, Typography, Empty, Statistic, message, Tag } from 'antd';
import { BarChartOutlined, SearchOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';
import { useConfig } from '../context/ConfigContext';
import { fmtDataUTC } from '../utils/data';
import { exportarPlanilha } from './financeiro/comum';
import { baixarRelatorioFinanceiro } from '../relatorios/RelatorioFinanceiro';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/** Uma categoria num leilão, como vem do servidor. */
interface Linha {
  idCategoria: number; categoria: string; idLeilao: number; leilao: string | null; datlei: string | null;
  qtd: number; valor: number; lotes: number; pesoKg: number; valorComPeso: number;
}
interface Total { qtd: number; valor: number; lotes: number; pesoKg: number; valorComPeso: number }
interface LinhaCategoria extends Total { key: string; idCategoria: number; categoria: string; leiloes: Linha[] }

const fmtR = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: number) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const media = (t: Total) => (t.qtd > 0 ? t.valor / t.qtd : 0);
const mediaKg = (t: Total) => (t.pesoKg > 0 ? t.valorComPeso / t.pesoKg : 0);
const somar = (ls: Total[]): Total => ls.reduce((a, l) => ({
  qtd: a.qtd + l.qtd, valor: a.valor + l.valor, lotes: a.lotes + l.lotes, pesoKg: a.pesoKg + l.pesoKg, valorComPeso: a.valorComPeso + l.valorComPeso,
}), { qtd: 0, valor: 0, lotes: 0, pesoKg: 0, valorComPeso: 0 });
/**
 * "FÊMEA(S) PO TEXEL / OVINOS" → "OVINOS": a espécie agrupa as caixas de marcar. O cadastro
 * de raças escreve de vários jeitos (BOVINA, BOVINO, BOVINOS; EQUINA, EQÜINA) — junta tudo.
 */
const especieDe = (categoria: string) => {
  if (!categoria.includes(' / ')) return 'SEM ESPÉCIE';
  const e = categoria.split(' / ').pop()!.trim().toUpperCase();
  const base = e.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [raiz, nome] of [['BOVIN', 'BOVINOS'], ['EQUIN', 'EQUINOS'], ['OVIN', 'OVINOS'], ['BUBALIN', 'BUBALINOS'], ['CAPRIN', 'CAPRINOS']])
    if (base.startsWith(raiz)) return nome;
  return e;
};

/**
 * Médias por categoria num período: escolhe as datas (do leilão), marca as categorias que
 * entram e monta as médias — desmarcar uma categoria a tira dos totais na hora, sem nova
 * consulta. Mesma conta do mapa de médias da Consulta de Vendas.
 */
export default function MediasCategoria() {
  const config = useConfig();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs]>([dayjs().startOf('year'), dayjs()]);
  // padrão: só vendidos — lote em defesa entra com valor zero e puxaria a média para baixo
  const [defesa, setDefesa] = useState<'' | 'S' | 'N'>('S');
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [busca, setBusca] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  // só vale a resposta da última consulta: uma anterior que chegue depois não sobrescreve
  const ultimaConsulta = useRef(0);

  const consultar = async () => {
    const minha = ++ultimaConsulta.current;
    setCarregando(true);
    try {
      const r = await api.get('/consulta-vendas/medias-categoria', { params: {
        de: periodo[0].format('YYYY-MM-DD'), ate: periodo[1].format('YYYY-MM-DD'), defesa: defesa || undefined,
      } });
      if (minha !== ultimaConsulta.current) return;
      setLinhas(r.data);
      // nova consulta: todas as categorias do período entram
      setMarcadas(Array.from(new Set<number>(r.data.map((l: Linha) => l.idCategoria))));
    } catch (e: any) {
      if (minha === ultimaConsulta.current) message.error(e.response?.data?.error || 'Erro ao consultar as médias');
    } finally { if (minha === ultimaConsulta.current) setCarregando(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { consultar(); }, []);

  // categorias do período (para as caixas), agrupadas por espécie
  const categorias = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of linhas || []) m.set(l.idCategoria, l.categoria);
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [linhas]);
  const porEspecie = useMemo(() => {
    const t = busca.trim().toUpperCase();
    const g = new Map<string, { id: number; nome: string }[]>();
    for (const c of categorias.filter(c => !t || c.nome.toUpperCase().includes(t)))
      g.set(especieDe(c.nome), [...(g.get(especieDe(c.nome)) || []), c]);
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [categorias, busca]);

  const resultado: LinhaCategoria[] = useMemo(() => {
    const m = new Map<number, LinhaCategoria>();
    for (const l of (linhas || []).filter(l => marcadas.includes(l.idCategoria))) {
      const c = m.get(l.idCategoria) || { key: String(l.idCategoria), idCategoria: l.idCategoria, categoria: l.categoria, leiloes: [], qtd: 0, valor: 0, lotes: 0, pesoKg: 0, valorComPeso: 0 };
      c.leiloes.push(l);
      Object.assign(c, somar([c, l]));
      m.set(l.idCategoria, c);
    }
    return Array.from(m.values()).sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [linhas, marcadas]);
  const geral = somar(resultado);
  const qtdLeiloes = new Set(resultado.flatMap(c => c.leiloes.map(l => l.idLeilao))).size;

  const alternarGrupo = (ids: number[], marcar: boolean) =>
    setMarcadas(m => marcar ? Array.from(new Set(m.concat(ids))) : m.filter(id => !ids.includes(id)));

  const textoPeriodo = `${periodo[0].format('DD/MM/YYYY')} a ${periodo[1].format('DD/MM/YYYY')}`;
  const textoStatus = defesa === 'S' ? 'Só vendidos' : defesa === 'N' ? 'Só não vendidos' : '';

  const exportarExcel = () => exportarPlanilha(resultado.flatMap(c => [
    { Categoria: c.categoria, Leilão: '', Data: '', Leilões: c.leiloes.length, Lotes: c.lotes, Quantidade: c.qtd,
      'Valor total': Number(c.valor.toFixed(2)), 'Média por animal': Number(media(c).toFixed(2)), 'Média por kg': mediaKg(c) ? Number(mediaKg(c).toFixed(2)) : '' },
    ...c.leiloes.map(l => ({ Categoria: c.categoria, Leilão: l.leilao || '', Data: fmtDataUTC(l.datlei), Leilões: '', Lotes: l.lotes, Quantidade: l.qtd,
      'Valor total': Number(l.valor.toFixed(2)), 'Média por animal': Number(media(l).toFixed(2)), 'Média por kg': mediaKg(l) ? Number(mediaKg(l).toFixed(2)) : '' })),
  ]), `medias-por-categoria-${periodo[0].format('YYYY-MM-DD')}-a-${periodo[1].format('YYYY-MM-DD')}`, 'Médias');

  const imprimir = async (comLeiloes: boolean) => {
    setGerandoPdf(true);
    try {
      await baixarRelatorioFinanceiro({
        titulo: 'Médias por categoria', subtitulo: [textoPeriodo, textoStatus].filter(Boolean).join(' · '),
        empresa: config.empresa, logoBase64: config.logoBase64,
        resumo: [
          { label: 'Leilões', valor: String(qtdLeiloes) }, { label: 'Categorias', valor: String(resultado.length) },
          { label: 'Animais', valor: fmtN(geral.qtd) }, { label: 'Total', valor: fmtR(geral.valor) },
          { label: 'Média geral', valor: fmtR(media(geral)) },
        ],
        colunas: [
          { titulo: 'Categoria / leilão', flex: 3.2 }, { titulo: 'Lotes', flex: 0.6, direita: true }, { titulo: 'Qtd.', flex: 0.7, direita: true },
          { titulo: 'Valor total', flex: 1.4, direita: true }, { titulo: 'Média', flex: 1.2, direita: true }, { titulo: 'Média/kg', flex: 1, direita: true },
        ],
        linhas: resultado.flatMap(c => [
          { destaque: comLeiloes, celulas: [c.categoria, String(c.lotes), fmtN(c.qtd), fmtR(c.valor), fmtR(media(c)), mediaKg(c) ? fmtR(mediaKg(c)) : '—'] },
          ...(comLeiloes ? c.leiloes.map(l => ({ recuo: true, celulas: [`${fmtDataUTC(l.datlei)} · ${l.leilao || ''}`, String(l.lotes), fmtN(l.qtd), fmtR(l.valor), fmtR(media(l)), mediaKg(l) ? fmtR(mediaKg(l)) : '—'] })) : []),
        ]),
        total: ['Total', String(geral.lotes), fmtN(geral.qtd), fmtR(geral.valor), fmtR(media(geral)), mediaKg(geral) ? fmtR(mediaKg(geral)) : '—'],
        rodapeNota: categorias.length > resultado.length
          ? `${categorias.length - resultado.length} categoria(s) do período fora do relatório (desmarcadas)` : undefined,
      }, 'medias-por-categoria');
    } catch { message.error('Erro ao gerar o PDF'); }
    finally { setGerandoPdf(false); }
  };

  const colunas = (leilao: boolean) => [
    leilao
      ? { title: 'Leilão', key: 'leilao', render: (_: any, l: Linha) => <span>{fmtDataUTC(l.datlei)} · {l.leilao}</span> }
      : { title: 'Categoria', dataIndex: 'categoria', key: 'categoria', render: (v: string, c: LinhaCategoria) =>
          <span><Text strong>{v}</Text> <Tag style={{ marginLeft: 4 }}>{c.leiloes.length === 1 ? '1 leilão' : `${c.leiloes.length} leilões`}</Tag></span> },
    { title: 'Lotes', dataIndex: 'lotes', key: 'lotes', width: 60, align: 'right' as const },
    { title: 'Qtd.', dataIndex: 'qtd', key: 'qtd', width: 70, align: 'right' as const, render: fmtN },
    { title: 'Valor total', dataIndex: 'valor', key: 'valor', width: 140, align: 'right' as const, render: fmtR },
    { title: 'Média', key: 'media', width: 130, align: 'right' as const, render: (_: any, t: Total) => <Text strong>{fmtR(media(t))}</Text> },
    { title: 'Média/kg', key: 'mediaKg', width: 100, align: 'right' as const, render: (_: any, t: Total) => (mediaKg(t) ? fmtR(mediaKg(t)) : '—') },
  ];

  return (
    <>
      <Space align="center" style={{ marginBottom: 16 }}>
        <BarChartOutlined style={{ fontSize: 22, color: '#7c3aed' }} />
        <Title level={4} style={{ margin: 0 }}>Médias por categoria</Title>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={9}>
            <Text type="secondary" style={{ fontSize: 12 }}>Período (data do leilão)</Text>
            <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} value={periodo} allowClear={false}
              onChange={v => v && v[0] && v[1] && setPeriodo([v[0], v[1]])}
              presets={[
                { label: 'Este ano', value: [dayjs().startOf('year'), dayjs()] },
                { label: 'Ano passado', value: [dayjs().subtract(1, 'year').startOf('year'), dayjs().subtract(1, 'year').endOf('year')] },
                { label: 'Últimos 12 meses', value: [dayjs().subtract(12, 'month'), dayjs()] },
                { label: 'Este mês', value: [dayjs().startOf('month'), dayjs()] },
              ]} />
          </Col>
          <Col xs={24} md={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>Status da venda</Text>
            <Select style={{ width: '100%' }} value={defesa} onChange={setDefesa}
              options={[{ value: '', label: 'Todos' }, { value: 'S', label: 'Vendidos' }, { value: 'N', label: 'Não vendidos' }]} />
          </Col>
          <Col xs={24} md={9}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} loading={carregando} onClick={consultar}>Consultar</Button>
              <Button icon={<FilePdfOutlined />} disabled={!resultado.length} loading={gerandoPdf} onClick={() => imprimir(false)}>PDF</Button>
              <Button icon={<FilePdfOutlined />} disabled={!resultado.length} loading={gerandoPdf} onClick={() => imprimir(true)}>PDF com leilões</Button>
              <Button icon={<FileExcelOutlined />} disabled={!resultado.length} onClick={exportarExcel}>Excel</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {linhas && !linhas.length ? <Empty description="Nenhuma venda no período" /> : linhas && (
        <Row gutter={16}>
          <Col xs={24} lg={7}>
            <Card size="small" title={`Categorias (${marcadas.length} de ${categorias.length})`}
              extra={<Space size={4}>
                <Button size="small" type="link" onClick={() => setMarcadas(categorias.map(c => c.id))}>Todas</Button>
                <Button size="small" type="link" onClick={() => setMarcadas([])}>Nenhuma</Button>
              </Space>}
              styles={{ body: { maxHeight: 620, overflowY: 'auto' } }}>
              <Input.Search allowClear placeholder="Buscar categoria" size="small" style={{ marginBottom: 8 }}
                onChange={e => setBusca(e.target.value)} />
              {porEspecie.map(([especie, cats]) => {
                const ids = cats.map(c => c.id);
                const qtdMarcadas = ids.filter(id => marcadas.includes(id)).length;
                return (
                  <div key={especie} style={{ marginBottom: 10 }}>
                    <Checkbox checked={qtdMarcadas === ids.length} indeterminate={qtdMarcadas > 0 && qtdMarcadas < ids.length}
                      onChange={e => alternarGrupo(ids, e.target.checked)}>
                      <Text strong>{especie}</Text> <Text type="secondary">({qtdMarcadas}/{ids.length})</Text>
                    </Checkbox>
                    <div style={{ paddingLeft: 22, marginTop: 4 }}>
                      {cats.map(c => (
                        <div key={c.id}>
                          <Checkbox checked={marcadas.includes(c.id)} onChange={e => alternarGrupo([c.id], e.target.checked)}>
                            <span style={{ fontSize: 13 }}>{c.nome.replace(/ \/ [^/]+$/, '')}</span>
                          </Checkbox>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          </Col>

          <Col xs={24} lg={17}>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Leilões" value={qtdLeiloes} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Animais" value={fmtN(geral.qtd)} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Total" value={fmtR(geral.valor)} valueStyle={{ fontSize: 18 }} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="Média geral" value={fmtR(media(geral))} valueStyle={{ fontSize: 18, color: '#7c3aed' }} /></Card></Col>
            </Row>
            <Table<LinhaCategoria> size="small" rowKey="key" loading={carregando} dataSource={resultado} pagination={false}
              tableLayout="fixed"
              locale={{ emptyText: 'Marque ao menos uma categoria' }}
              columns={colunas(false) as any}
              expandable={{
                expandedRowRender: c => (
                  <Table<Linha> size="small" rowKey={l => `${l.idCategoria}-${l.idLeilao}`} dataSource={c.leiloes} pagination={false}
                    columns={colunas(true) as any} showHeader={false} />
                ),
              }}
              summary={() => resultado.length ? (
                <Table.Summary.Row style={{ background: '#fafafa' }}>
                  <Table.Summary.Cell index={0} />
                  <Table.Summary.Cell index={1}><Text strong>Total ({resultado.length} categorias)</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{geral.lotes}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{fmtN(geral.qtd)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><Text strong>{fmtR(geral.valor)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right"><Text strong>{fmtR(media(geral))}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">{mediaKg(geral) ? fmtR(mediaKg(geral)) : '—'}</Table.Summary.Cell>
                </Table.Summary.Row>
              ) : null} />
          </Col>
        </Row>
      )}
    </>
  );
}
