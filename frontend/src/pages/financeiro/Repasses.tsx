import React, { useState } from 'react';
import { Segmented, Table, Typography, Space, Button, Empty, Alert, Popconfirm, message } from 'antd';
import { FileExcelOutlined, FilePdfOutlined, SendOutlined } from '@ant-design/icons';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { useConfig } from '../../context/ConfigContext';
import api from '../../services/api';
import { fmtValor } from './Lancamentos';
import { exportarPlanilha, SeletorLeilao } from './comum';
import MovimentosPeriodo from './MovimentosPeriodo';

const { Title, Text } = Typography;

/**
 * Por vendedor do leilão: recebido nas parcelas que passam pela leiloeira, retido
 * (comissão de venda e despesas), créditos e repasses. O saldo usa o que de fato entrou —
 * diferente do Acerto do Vendedor, que usa o valor previsto da entrada.
 */
export default function Repasses() {
  const [modo, setModo] = useState<'leilao' | 'periodo'>('leilao');
  return (
    <>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Repasses {modo === 'leilao' ? 'aos vendedores' : 'por período'}</Title>
        <Segmented value={modo} onChange={v => setModo(v as any)}
          options={[{ value: 'leilao', label: 'Por leilão' }, { value: 'periodo', label: 'Por período (data do extrato)' }]} />
      </Space>
      {modo === 'leilao' ? <RepassesPorLeilao /> : <MovimentosPeriodo lado="repasses" />}
    </>
  );
}

function RepassesPorLeilao() {
  const [idLeilao, setIdLeilao] = useState<number | undefined>();
  const [nomeLeilao, setNomeLeilao] = useState('');
  const [dados, setDados] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [lancando, setLancando] = useState<number | 'todos' | null>(null);
  const config = useConfig();

  const carregar = async (id?: number) => {
    setDados(null);
    if (!id) return;
    setCarregando(true);
    try { setDados((await api.get('/conciliacao/repasses', { params: { idLeilao: id } })).data); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao carregar'); }
    finally { setCarregando(false); }
  };

  // grava o fechamento (F) no Acerto do Vendedor com o saldo a repassar, recalculado no servidor
  const lancar = async (idVendedor?: number) => {
    setLancando(idVendedor ?? 'todos');
    try {
      const r = (await api.post('/conciliacao/repasses/lancar', { idLeilao, idsVendedor: idVendedor ? [idVendedor] : undefined })).data;
      message.success(r.lancados.length === 1
        ? `Repasse de ${fmtValor(r.total)} lançado no Acerto de ${r.lancados[0].vendedor}`
        : `${r.lancados.length} repasses lançados, total ${fmtValor(r.total)}`);
      await carregar(idLeilao);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao lançar o repasse'); }
    finally { setLancando(null); }
  };
  const comSaldo = (dados?.linhas || []).filter((l: any) => l.saldo > 0.009);

  const imprimir = async () => {
    setGerandoPdf(true);
    try {
      const t = dados.totais;
      await baixarRelatorioFinanceiro({
        titulo: 'Repasses aos vendedores', subtitulo: nomeLeilao, empresa: config.empresa, logoBase64: config.logoBase64,
        resumo: [
          { label: 'Recebido', valor: fmtValor(t.recebido) }, { label: 'Comissão de venda', valor: fmtValor(t.comissao) },
          { label: 'Repassado', valor: fmtValor(t.repassado) }, { label: 'Saldo a repassar', valor: fmtValor(t.saldo) },
        ],
        colunas: [
          { titulo: 'Vendedor', flex: 2.4 }, { titulo: 'Previsto', direita: true }, { titulo: 'Recebido', direita: true },
          { titulo: 'Comissão', direita: true }, { titulo: 'Despesas', direita: true }, { titulo: 'Créditos', direita: true },
          { titulo: 'Repassado', direita: true }, { titulo: 'Conferido', direita: true }, { titulo: 'Saldo a repassar', direita: true },
        ],
        linhas: dados.linhas.map((l: any) => ({ celulas: [l.vendedor, ...[l.previsto, l.recebido, l.comissao, l.despesas, l.creditos, l.repassado, l.conferido, l.saldo].map(fmtValor)] })),
        total: ['Total', ...[t.previsto, t.recebido, t.comissao, t.despesas, t.creditos, t.repassado, t.conferido, t.saldo].map(fmtValor)],
        rodapeNota: 'Saldo = recebido + créditos − comissão de venda − despesas − repassado. Recebido = conciliado no extrato',
      }, `repasses-${nomeLeilao.replace(/[^\w-]+/g, '_').slice(0, 50)}`);
    } catch { message.error('Erro ao gerar o PDF'); }
    finally { setGerandoPdf(false); }
  };

  const exportar = () => exportarPlanilha(dados.linhas.map((l: any) => ({
    Vendedor: l.vendedor, 'Previsto pela leiloeira': l.previsto, Recebido: l.recebido, 'A receber': l.aReceber,
    'Comissão de venda': l.comissao, Despesas: l.despesas, Créditos: l.creditos,
    'Repassado (lançado)': l.repassado, 'Repasse conferido no extrato': l.conferido, 'Saldo a repassar': l.saldo,
  })), `repasses-${nomeLeilao.replace(/[^\w-]+/g, '_').slice(0, 50)}`, 'Repasses');

  const t = dados?.totais;
  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <SeletorLeilao value={idLeilao} onChange={(id, nome) => { setIdLeilao(id); setNomeLeilao(nome || ''); carregar(id); }} />
        <Button icon={<FilePdfOutlined />} disabled={!dados?.linhas?.length} loading={gerandoPdf} onClick={imprimir}>PDF</Button>
        <Button icon={<FileExcelOutlined />} disabled={!dados?.linhas?.length} onClick={exportar}>Excel</Button>
        <Popconfirm disabled={!comSaldo.length} okText="Lançar" cancelText="Cancelar" onConfirm={() => lancar()}
          title={`Lançar o repasse de ${comSaldo.length} vendedor${comSaldo.length > 1 ? 'es' : ''}?`}
          description={`Total ${fmtValor(comSaldo.reduce((a: number, l: any) => a + l.saldo, 0))}, gravado no Acerto do Vendedor de cada um`}>
          <Button icon={<SendOutlined />} disabled={!comSaldo.length} loading={lancando === 'todos'}>Lançar todos</Button>
        </Popconfirm>
      </Space>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Saldo a repassar = recebido + créditos − comissão de venda − despesas − já repassado"
        description="Recebido é só o que foi conciliado no extrato. Saldo negativo quer dizer que ainda não entrou o suficiente para cobrir o que fica retido." />
      {!idLeilao ? <Empty description="Escolha o leilão" /> : (
        <Table rowKey="idVendedor" size="small" loading={carregando} dataSource={dados?.linhas || []} pagination={false}
          scroll={{ x: 1250 }}
          summary={() => t ? (
            <Table.Summary.Row style={{ fontWeight: 600 }}>
              <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
              {[t.previsto, t.recebido, t.comissao, t.despesas, t.creditos, t.repassado, t.conferido, t.saldo].map((v: number, i: number) =>
                <Table.Summary.Cell key={i} index={i + 1} align="right">{fmtValor(v)}</Table.Summary.Cell>)}
              <Table.Summary.Cell index={9} />
            </Table.Summary.Row>
          ) : null}
          columns={[
            { title: 'Vendedor', dataIndex: 'vendedor', ellipsis: true, width: 240 },
            { title: 'Previsto', dataIndex: 'previsto', align: 'right' as const, render: fmtValor },
            { title: 'Recebido', dataIndex: 'recebido', align: 'right' as const,
              render: (v: number, r: any) => <span>{fmtValor(v)}{r.aReceber > 0.009 && <div><Text type="secondary" style={{ fontSize: 12 }}>falta {fmtValor(r.aReceber)}</Text></div>}</span> },
            { title: 'Comissão de venda', dataIndex: 'comissao', align: 'right' as const, render: fmtValor },
            { title: 'Despesas', dataIndex: 'despesas', align: 'right' as const, render: fmtValor },
            { title: 'Créditos', dataIndex: 'creditos', align: 'right' as const, render: fmtValor },
            { title: 'Repassado', dataIndex: 'repassado', align: 'right' as const, render: fmtValor },
            { title: 'Conferido no extrato', dataIndex: 'conferido', align: 'right' as const,
              render: (v: number, r: any) => <Text type={r.repassado > 0 && Math.abs(v - r.repassado) > 0.009 ? 'warning' : undefined}>{fmtValor(v)}</Text> },
            { title: 'Saldo a repassar', dataIndex: 'saldo', align: 'right' as const,
              sorter: (a: any, b: any) => a.saldo - b.saldo,
              render: (v: number) => <Text strong type={v < -0.009 ? 'danger' : v > 0.009 ? 'success' : undefined}>{fmtValor(v)}</Text> },
            { title: '', key: 'lancar', width: 150, align: 'center' as const,
              render: (_: any, r: any) => r.saldo > 0.009 && (
                <Popconfirm okText="Lançar" cancelText="Cancelar" onConfirm={() => lancar(r.idVendedor)}
                  title={`Lançar repasse de ${fmtValor(r.saldo)}?`} description={`Gravado no Acerto do Vendedor de ${r.vendedor}`}>
                  <Button size="small" icon={<SendOutlined />} loading={lancando === r.idVendedor} disabled={lancando !== null}>Lançar repasse</Button>
                </Popconfirm>) },
          ]} />
      )}
    </>
  );
}
