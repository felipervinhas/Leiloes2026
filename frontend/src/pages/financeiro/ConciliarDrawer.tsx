import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Drawer, Descriptions, Tag, Alert, Button, Select, Segmented, Table, Space, Typography, Checkbox,
  message, Modal, Input, Radio, Spin, Empty, Divider, InputNumber, Form,
} from 'antd';
import { CheckOutlined, UndoOutlined, StopOutlined, ShopOutlined, PlusOutlined } from '@ant-design/icons';
import { SeletorLeilao } from './comum';
import api from '../../services/api';
import { fmtDataUTC } from '../../utils/data';
import { fmtValor, SITUACOES, docFmt } from './Lancamentos';

const { Text } = Typography;
const r2 = (v: number) => Math.round(v * 100) / 100;

interface Item {
  chave: string; tipo: string; leilao: string | null; lote: string | null; descricao: string;
  vencimento: string | null; valor: number; pago: number; saldo: number; daLeiloeira: boolean;
}
type Papel = 'comprador' | 'vendedor' | 'despesa';

const NOMES_TIPO: Record<string, string> = {
  PARCELA: 'Parcela', COMISSAO_COMPRA: 'Comissão de compra', REPASSE: 'Repasse ao vendedor', DESPESA: 'Despesa de cliente',
  AJUSTE: 'Ajuste de arredondamento',
};
const TOLERANCIA_ARREDONDAMENTO = 1;

/** O que a baixa pagou: leilão, lote e animal, comprador e vendedor, e o dado do item. */
function DetalheBaixa({ b }: { b: any }) {
  const d = b.detalhe || {};
  const linha = (partes: (string | null | false | undefined)[]) => partes.filter(Boolean).join(' · ');
  const titulo = b.tipo === 'PARCELA' && d.parcela ? `Parcela ${d.parcela}` : NOMES_TIPO[b.tipo] || b.tipo;
  const especifico = b.tipo === 'PARCELA'
    ? linha([d.vencimento && `vencimento ${fmtDataUTC(d.vencimento)}`, d.valorParcela != null && `valor da parcela ${fmtValor(d.valorParcela)}`])
    : b.tipo === 'COMISSAO_COMPRA'
      ? linha([d.percentualComissao != null && d.baseComissao != null && `${d.percentualComissao}% sobre ${fmtValor(d.baseComissao)}`,
        d.valorComissao != null && `comissão ${fmtValor(d.valorComissao)}`])
      : linha([d.clienteDespesa, d.observacao, d.dataDespesa && `lançado em ${fmtDataUTC(d.dataDespesa)}`]);
  const venda = linha([d.lote && `Lote ${d.lote}${d.animal ? ` — ${d.animal}` : ''}`, d.valorCompra != null && `compra ${fmtValor(d.valorCompra)}`]);
  const partes = linha([d.comprador && `Comprador: ${d.comprador}`, d.vendedor && `Vendedor: ${d.vendedor}`]);
  return (
    <div style={{ lineHeight: 1.45 }}>
      <Text strong>{titulo}</Text>{especifico && <Text type="secondary"> · {especifico}</Text>}
      {d.leilao && <div>{d.leilao}{d.dataLeilao ? ` (${fmtDataUTC(d.dataLeilao)})` : ''}</div>}
      {venda && <div>{venda}</div>}
      {partes && <div><Text type="secondary" style={{ fontSize: 12 }}>{partes}</Text></div>}
    </div>
  );
}

interface Consulta {
  lancamento: any; cliente: { id: number; nome: string | null } | null; papel: Papel;
  leiloes: { id: number; nome: string }[]; itens: Item[]; baixas: any[];
}

/**
 * Conciliação de um lançamento: mostra a sugestão do motor, as baixas feitas e a
 * consulta manual por cliente e leilão. Quando a soma marcada bate com o que falta
 * do lançamento, concilia sozinho (com a opção de desfazer).
 */
export default function ConciliarDrawer({ idLancamento, onFechar, onAlterado }: {
  idLancamento: number | null; onFechar: () => void; onAlterado: () => void;
}) {
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [idCliente, setIdCliente] = useState<number | undefined>();
  const [papel, setPapel] = useState<Papel | undefined>();
  const [nomeLeilao, setNomeLeilao] = useState<string | undefined>();
  const [despesaEmpresaAberto, setDespesaEmpresaAberto] = useState(false);
  const [criarDespesaAberto, setCriarDespesaAberto] = useState(false);
  const [idLeilao, setIdLeilao] = useState<number | undefined>();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [lembrarPagador, setLembrarPagador] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [clientes, setClientes] = useState<{ value: number; label: string }[]>([]);
  const [naoVendaAberto, setNaoVendaAberto] = useState(false);
  const timerBusca = useRef<any>(null);
  const autoEnviado = useRef('');
  // só concilia sozinho depois que o usuário marca algo — a sugestão vem marcada e precisa ser conferida
  const interagiu = useRef(false);

  const carregar = useCallback(async (f: { idCliente?: number; papel?: string; idLeilao?: number } = {}) => {
    if (!idLancamento) return;
    setCarregando(true);
    try {
      const r = await api.get(`/conciliacao/lancamentos/${idLancamento}/candidatos`, { params: f });
      const c: Consulta = r.data;
      setConsulta(c);
      setPapel(c.papel);
      if (c.cliente) setClientes(cs => cs.some(x => x.value === c.cliente!.id) ? cs : [{ value: c.cliente!.id, label: c.cliente!.nome || `Cliente ${c.cliente!.id}` }, ...cs]);
      setIdCliente(c.cliente?.id);
      // a sugestão do motor já vem marcada
      const sugeridos = (c.lancamento.sugestao?.itens || []).map((i: any) => i.chave).filter((k: string) => c.itens.some(it => it.chave === k));
      setMarcados(sugeridos);
      autoEnviado.current = '';
      interagiu.current = false;
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Erro ao carregar o lançamento');
    } finally { setCarregando(false); }
  }, [idLancamento]);

  useEffect(() => {
    if (idLancamento) { setConsulta(null); setIdLeilao(undefined); setPapel(undefined); setIdCliente(undefined); carregar(); }
  }, [idLancamento, carregar]);

  const l = consulta?.lancamento;
  const restante = l ? r2(Math.abs(l.valor) - (l.baixado || 0)) : 0;
  const itensPorChave = useMemo(() => new Map((consulta?.itens || []).map(i => [i.chave, i])), [consulta]);
  const somaMarcada = r2(marcados.reduce((a, k) => a + (itensPorChave.get(k)?.saldo || 0), 0));
  const diferenca = r2(restante - somaMarcada);
  const outroCliente = !!(l && idCliente && idCliente !== l.idCliente && papel !== 'despesa');
  // crédito baixa parcela ou comissão; débito baixa repasse ou despesa (o backend recusa o resto)
  const ladoCerto = (it: Item) => (l?.sentido === 'C') !== (it.tipo === 'REPASSE' || it.tipo === 'DESPESA');
  const ladoTrocado = !!consulta?.itens.length && !consulta.itens.some(ladoCerto);
  // a sugestão fecha o lançamento com os próprios valores (parte de um pagamento dividido, ou com
  // ajuste de arredondamento) — aí confirma o que o motor propôs, não a soma dos saldos marcados
  const sugestaoFecha = useMemo(() => {
    const sg = l?.sugestao;
    if (!sg?.itens?.length) return false;
    const cabem = sg.itens.every((i: any) => (itensPorChave.get(i.chave)?.saldo ?? 0) >= i.valor - 0.01);
    const soma = sg.itens.reduce((a: number, i: any) => a + i.valor, 0) + (sg.ajuste || 0);
    return cabem && Math.abs(soma - restante) < 0.011;
  }, [l, itensPorChave, restante]);
  // marcado bate com o que falta a menos de R$ 1,00: dá para fechar com ajuste de arredondamento
  const arredondavel = marcados.length > 0 && Math.abs(diferenca) >= 0.011 && Math.abs(diferenca) <= TOLERANCIA_ARREDONDAMENTO + 0.001;

  /** Distribui o que falta do lançamento pelos itens marcados, na ordem; o último pode ficar parcial. */
  const alocar = () => {
    let falta = restante;
    const out: { chave: string; valor: number }[] = [];
    for (const k of marcados) {
      const it = itensPorChave.get(k);
      if (!it || falta <= 0.009) break;
      const v = r2(Math.min(it.saldo, falta));
      out.push({ chave: k, valor: v });
      falta = r2(falta - v);
    }
    return out;
  };

  const confirmar = async (regra: 'MANUAL' | 'SUGESTAO' = 'MANUAL', envio?: { itens: { chave: string; valor: number }[]; ajuste?: number }) => {
    const itens = envio?.itens || alocar();
    if (!itens.length) return;
    setSalvando(true);
    try {
      const r = await api.post(`/conciliacao/lancamentos/${idLancamento}/baixas`, {
        itens, idCliente, lembrarPagador: outroCliente && lembrarPagador, regra, ajuste: envio?.ajuste,
      });
      setConsulta(r.data);
      setMarcados([]);
      onAlterado();
      const conciliado = r.data.lancamento.situacao === 'CONCILIADO';
      message.success(conciliado ? 'Lançamento conciliado' : 'Baixa parcial registrada');
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Erro ao conciliar');
    } finally { setSalvando(false); }
  };

  // a ideia é não precisar de botão: bateu a soma, concilia
  useEffect(() => {
    if (!interagiu.current || !consulta || salvando || restante <= 0.009 || !marcados.length) return;
    const assinatura = marcados.join('|');
    if (Math.abs(diferenca) < 0.011 && autoEnviado.current !== assinatura) {
      autoEnviado.current = assinatura;
      confirmar(l?.sugestao && l.sugestao.itens.every((i: any) => marcados.includes(i.chave)) ? 'SUGESTAO' : 'MANUAL');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcados, diferenca]);

  const desfazer = async (idBaixa?: number) => {
    setSalvando(true);
    try {
      await api.post(`/conciliacao/lancamentos/${idLancamento}/desfazer`, { idBaixa });
      message.info('Baixa desfeita');
      onAlterado();
      await carregar({ idCliente, papel, idLeilao });
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao desfazer'); }
    finally { setSalvando(false); }
  };

  const buscarClientes = (texto: string) => {
    clearTimeout(timerBusca.current);
    if (texto.length < 2) return;
    timerBusca.current = setTimeout(async () => {
      const r = await api.get('/clientes', { params: { nome: texto } });
      setClientes((r.data || []).slice(0, 50).map((c: any) => ({ value: c.id, label: c.nomexx })));
    }, 350);
  };

  const mudarFiltro = (f: { idCliente?: number; papel?: Papel; idLeilao?: number | null }) => {
    const novo = { idCliente: f.idCliente ?? idCliente, papel: f.papel ?? papel, idLeilao: f.idLeilao === null ? undefined : (f.idLeilao ?? idLeilao) };
    // trocar de cliente limpa o leilão — menos em despesa de cliente, onde o leilão é o filtro principal
    if (f.idCliente !== undefined && f.idCliente !== idCliente && novo.papel !== 'despesa') novo.idLeilao = undefined;
    if (f.papel && f.papel !== papel) { novo.idCliente = f.papel === 'despesa' ? undefined : l?.idCliente; if (f.papel !== 'despesa') novo.idLeilao = undefined; }
    setIdLeilao(novo.idLeilao);
    carregar(novo);
  };

  return (
    <Drawer open={!!idLancamento} onClose={onFechar} width={980} destroyOnHidden
      title={l ? <Space>Conciliar lançamento <Tag color={SITUACOES[l.situacao]?.cor}>{SITUACOES[l.situacao]?.label}</Tag></Space> : 'Conciliar lançamento'}>
      {!consulta ? <Spin /> : (
        <>
          <Descriptions size="small" bordered column={2}>
            <Descriptions.Item label="Data">{fmtDataUTC(l.data)}</Descriptions.Item>
            <Descriptions.Item label="Valor">
              <Text strong style={{ color: l.valor < 0 ? '#cf1322' : '#389e0d' }}>{fmtValor(l.valor)}</Text>
              {l.baixado > 0 && <Text type="secondary"> · baixado {fmtValor(l.baixado)} · falta {fmtValor(restante)}</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="No extrato" span={2}>
              {l.nomeContraparte || l.memo}{l.docContraparte ? ` · ${docFmt(l.docContraparte)}` : ''}
            </Descriptions.Item>
            {l.categoria && <Descriptions.Item label="Categoria" span={2}>{l.categoria}</Descriptions.Item>}
          </Descriptions>

          {l.sugestao && consulta.baixas.length === 0 && (
            <Alert style={{ marginTop: 12 }} type="info" showIcon
              message={`Sugestão: ${l.sugestao.descricao}`}
              description={<>
                Os itens sugeridos já estão marcados abaixo. Confira e confirme, ou marque outros itens.
                {sugestaoFecha && l.sugestao.itens.some((i: any) => i.valor < (itensPorChave.get(i.chave)?.saldo ?? 0) - 0.01) && (
                  <div style={{ marginTop: 4 }}>Este pagamento leva {l.sugestao.itens.map((i: any) => {
                    const it = itensPorChave.get(i.chave);
                    return `${fmtValor(i.valor)} de "${it?.descricao}${it?.lote ? ` lote ${it.lote}` : ''}"`;
                  }).join(', ')}; o resto fica para a outra transferência.</div>
                )}
                {sugestaoFecha && l.sugestao.ajuste ? (
                  <div style={{ marginTop: 4 }}>A diferença de {fmtValor(Math.abs(l.sugestao.ajuste))} fica como ajuste de arredondamento.</div>
                ) : null}
              </>}
              action={<Button type="primary" size="small" icon={<CheckOutlined />} loading={salvando}
                disabled={!sugestaoFecha && Math.abs(diferenca) >= 0.011}
                onClick={() => sugestaoFecha
                  ? confirmar('SUGESTAO', { itens: l.sugestao.itens, ajuste: l.sugestao.ajuste })
                  : confirmar('SUGESTAO')}>Confirmar sugestão</Button>} />
          )}

          {consulta.baixas.length > 0 && (
            <>
              <Divider titlePlacement="left" plain>Baixas deste lançamento</Divider>
              <Table rowKey="id" size="small" pagination={false} dataSource={consulta.baixas}
                columns={[
                  { title: 'Item', dataIndex: 'tipo', render: (_: string, b: any) => <DetalheBaixa b={b} /> },
                  { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: fmtValor },
                  { title: 'Como', dataIndex: 'regra', render: (r: string) => r === 'MANUAL' ? 'Manual' : r === 'SUGESTAO' ? 'Sugestão confirmada' : `Automático (${r})` },
                  { title: 'Por', dataIndex: 'usuario', render: (u: string) => u || '—' },
                  { title: '', width: 90, render: (_: any, b: any) =>
                    b.tipo === 'AJUSTE' ? null : <Button size="small" icon={<UndoOutlined />} loading={salvando} onClick={() => desfazer(b.id)}>Desfazer</Button> },
                ]} />
            </>
          )}

          {l.situacao === 'NAO_VENDA' ? (
            <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Marcado como não é venda"
              action={<Button size="small" onClick={() => desfazer()}>Desfazer</Button>} />
          ) : l.situacao === 'DESPESA' ? (
            <Alert style={{ marginTop: 12 }} type="info" showIcon message={`Despesa da empresa: ${l.categoria || ''}`}
              description="Está no relatório de Despesas da empresa."
              action={<Button size="small" onClick={() => desfazer()}>Desfazer</Button>} />
          ) : restante > 0.009 && (
            <>
              <Divider titlePlacement="left" plain>Procurar o que este pagamento cobre</Divider>
              <Space wrap style={{ marginBottom: 12 }}>
                <Segmented value={papel} onChange={v => mudarFiltro({ papel: v as Papel })}
                  options={[
                    { value: 'comprador', label: 'Como comprador' }, { value: 'vendedor', label: 'Como vendedor' },
                    ...(l.sentido === 'D' ? [{ value: 'despesa', label: 'Despesa de cliente' }] : []),
                  ]} />
                <Select showSearch allowClear placeholder={papel === 'despesa' ? 'Cliente da despesa (opcional)' : 'Cliente (nome)'}
                  style={{ width: 320 }} filterOption={false}
                  value={idCliente} options={clientes} onSearch={buscarClientes}
                  onChange={(v?: number) => mudarFiltro({ idCliente: v })} />
                {papel === 'despesa' ? (
                  <SeletorLeilao value={idLeilao} rotulo={nomeLeilao} style={{ width: 300 }}
                    onChange={(v, nome) => { setNomeLeilao(nome); mudarFiltro({ idLeilao: v ?? null }); }} />
                ) : (
                  <Select allowClear placeholder="Todos os leilões" style={{ width: 300 }} value={idLeilao}
                    options={consulta.leiloes.map(x => ({ value: x.id, label: x.nome }))}
                    onChange={(v?: number) => mudarFiltro({ idLeilao: v ?? null })} />
                )}
              </Space>
              {outroCliente && l.docContraparte && (
                <div style={{ marginBottom: 8 }}>
                  <Checkbox checked={lembrarPagador} onChange={e => setLembrarPagador(e.target.checked)}>
                    Lembrar {docFmt(l.docContraparte)} como pagador deste cliente (da próxima vez casa sozinho)
                  </Checkbox>
                </div>
              )}

              {papel === 'despesa' && !idLeilao ? (
                <Empty description="Escolha o leilão para ver as despesas lançadas (frete, catálogo, sindicato...)" />
              ) : papel !== 'despesa' && !idCliente ? <Empty description="Escolha o cliente para ver o que está em aberto" /> : (
                <>
                {ladoTrocado && (
                  <Alert style={{ marginBottom: 8 }} type="warning" showIcon
                    message={l.sentido === 'D'
                      ? 'Este lançamento é um débito (saiu dinheiro da conta): parcela e comissão do comprador só são baixadas por crédito.'
                      : 'Este lançamento é um crédito (entrou dinheiro na conta): repasse ao vendedor só é baixado por débito.'}
                    description="Os itens aparecem só para consulta. Se for devolução ou outro pagamento, use as opções abaixo." />
                )}
                <Table rowKey="chave" size="small" loading={carregando} dataSource={consulta.itens}
                  pagination={{ pageSize: 15, hideOnSinglePage: true }}
                  rowSelection={{
                    selectedRowKeys: marcados, onChange: ks => { interagiu.current = true; setMarcados(ks as string[]); },
                    getCheckboxProps: (it: Item) => ({ disabled: !ladoCerto(it) }),
                  }}
                  locale={{ emptyText: papel === 'despesa' ? 'Nenhuma despesa em aberto neste leilão — use "Criar despesa"' : 'Nada em aberto para este cliente' }}
                  columns={[
                    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true },
                    { title: 'Lote', dataIndex: 'lote', width: 70 },
                    { title: 'Item', dataIndex: 'descricao', render: (v: string, it: Item) =>
                      <Space size={4}>{v}{it.tipo === 'PARCELA' && !it.daLeiloeira && <Tag>depois das iniciais</Tag>}</Space> },
                    { title: papel === 'despesa' ? 'Lançada em' : 'Vencimento', dataIndex: 'vencimento', width: 110, render: (v: string) => fmtDataUTC(v) },
                    { title: 'Valor', dataIndex: 'valor', width: 120, align: 'right' as const, render: fmtValor },
                    { title: 'Em aberto', dataIndex: 'saldo', width: 120, align: 'right' as const, render: (v: number) => <Text strong>{fmtValor(v)}</Text> },
                  ]} />
                </>
              )}

              <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #f0f0f0', padding: '12px 0', marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Space size={24}>
                  <span>Falta conciliar <Text strong>{fmtValor(restante)}</Text></span>
                  <span>Marcado <Text strong>{fmtValor(somaMarcada)}</Text></span>
                  <span>Diferença <Text strong type={Math.abs(diferenca) < 0.011 ? 'success' : diferenca < 0 ? 'danger' : 'warning'}>{fmtValor(diferenca)}</Text></span>
                </Space>
                <Space>
                  {papel === 'despesa' && (
                    <Button icon={<PlusOutlined />} onClick={() => setCriarDespesaAberto(true)} disabled={!idLeilao}
                      title="A despesa ainda não foi lançada: cria nas Despesas do leilão e já paga com este débito">Criar despesa</Button>
                  )}
                  {l.sentido === 'D' && (
                    <Button icon={<ShopOutlined />} onClick={() => setDespesaEmpresaAberto(true)} disabled={consulta.baixas.length > 0}>Despesa da empresa</Button>
                  )}
                  <Button icon={<StopOutlined />} onClick={() => setNaoVendaAberto(true)} disabled={consulta.baixas.length > 0}>Não é venda</Button>
                  {arredondavel && (
                    <Button type="primary" icon={<CheckOutlined />} loading={salvando}
                      title="Baixa os itens marcados inteiros e lança a diferença como ajuste de arredondamento"
                      onClick={() => confirmar('MANUAL', {
                        itens: marcados.map(k => ({ chave: k, valor: itensPorChave.get(k)?.saldo || 0 })), ajuste: diferenca,
                      })}>
                      Conciliar com arredondamento ({diferenca > 0 ? '+' : '−'}{fmtValor(Math.abs(diferenca))})
                    </Button>
                  )}
                  <Button type={arredondavel ? 'default' : 'primary'} icon={<CheckOutlined />} loading={salvando} disabled={!marcados.length || Math.abs(diferenca) < 0.011}
                    onClick={() => confirmar()}>
                    {diferenca > 0 ? 'Conciliar parcial' : 'Conciliar (último item parcial)'}
                  </Button>
                </Space>
              </div>
            </>
          )}
          <DespesaEmpresaModal aberto={despesaEmpresaAberto} lancamento={l} idLancamento={idLancamento!}
            onFechar={() => setDespesaEmpresaAberto(false)}
            onSalvo={() => { setDespesaEmpresaAberto(false); onAlterado(); carregar({ idCliente, papel, idLeilao }); }} />
          <CriarDespesaModal aberto={criarDespesaAberto} lancamento={l} idLancamento={idLancamento!} restante={restante}
            idLeilao={idLeilao} nomeLeilao={nomeLeilao} idCliente={idCliente} clientes={clientes} onBuscarClientes={buscarClientes}
            onFechar={() => setCriarDespesaAberto(false)}
            onSalvo={c => { setCriarDespesaAberto(false); setConsulta(c); setMarcados([]); onAlterado(); }} />
          <NaoVendaModal aberto={naoVendaAberto} temDocumento={!!l.docContraparte} idLancamento={idLancamento!}
            onFechar={() => setNaoVendaAberto(false)}
            onSalvo={() => { setNaoVendaAberto(false); onAlterado(); carregar({ idCliente, papel, idLeilao }); }} />
        </>
      )}
    </Drawer>
  );
}

function NaoVendaModal({ aberto, temDocumento, idLancamento, onFechar, onSalvo }: {
  aberto: boolean; temDocumento: boolean; idLancamento: number; onFechar: () => void; onSalvo: () => void;
}) {
  const [categoria, setCategoria] = useState('Despesa da empresa');
  const [lembrar, setLembrar] = useState<'nao' | 'documento' | 'historico'>('nao');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) setLembrar(temDocumento ? 'documento' : 'historico'); }, [aberto, temDocumento]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post(`/conciliacao/lancamentos/${idLancamento}/nao-venda`, { categoria, lembrar: lembrar === 'nao' ? null : lembrar });
      message.success('Marcado como não é venda');
      onSalvo();
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao marcar'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal open={aberto} title="Não é venda" onCancel={onFechar} onOk={salvar} confirmLoading={salvando} okText="Marcar">
      <div style={{ marginBottom: 8 }}>Categoria</div>
      <Input value={categoria} onChange={e => setCategoria(e.target.value)} maxLength={60}
        placeholder="Ex.: Despesa da empresa, Tarifa, Transferência entre contas" />
      <div style={{ margin: '16px 0 8px' }}>Nas próximas importações</div>
      <Radio.Group value={lembrar} onChange={e => setLembrar(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Radio value="nao">Só este lançamento</Radio>
        {temDocumento
          ? <Radio value="documento">Marcar sempre que vier este CPF/CNPJ</Radio>
          : <Radio value="historico">Marcar sempre que vier este histórico</Radio>}
      </Radio.Group>
    </Modal>
  );
}

/** Despesa da própria empresa (aluguel de veículo, seguro...): vai para o relatório de Despesas da empresa. */
function DespesaEmpresaModal({ aberto, lancamento, idLancamento, onFechar, onSalvo }: {
  aberto: boolean; lancamento: any; idLancamento: number; onFechar: () => void; onSalvo: () => void;
}) {
  const [categorias, setCategorias] = useState<{ value: number; label: string }[]>([]);
  const [idCategoria, setIdCategoria] = useState<number | undefined>();
  const [fornecedor, setFornecedor] = useState('');
  const [idLeilao, setIdLeilao] = useState<number | undefined>();
  const [observacao, setObservacao] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setIdCategoria(undefined); setIdLeilao(undefined); setObservacao(''); setLembrar(true);
    setFornecedor(lancamento?.nomeContraparte || '');
    api.get('/conciliacao/config/categorias').then(r => setCategorias(r.data.map((c: any) => ({ value: c.id, label: c.nome })))).catch(() => {});
  }, [aberto, lancamento]);

  const salvar = async () => {
    if (!idCategoria) { message.warning('Escolha a categoria'); return; }
    setSalvando(true);
    try {
      await api.post(`/conciliacao/lancamentos/${idLancamento}/despesa-empresa`, { idCategoria, fornecedor, idLeilao, observacao, lembrar });
      message.success('Registrado como despesa da empresa');
      onSalvo();
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao registrar'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal open={aberto} title="Despesa da empresa" onCancel={onFechar} onOk={salvar} confirmLoading={salvando} okText="Registrar">
      <Form layout="vertical">
        <Form.Item label="Categoria" required>
          <Select showSearch optionFilterProp="label" value={idCategoria} onChange={setIdCategoria} options={categorias}
            placeholder="Ex.: Aluguel de veículos" />
        </Form.Item>
        <Form.Item label="Fornecedor"><Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} maxLength={120} /></Form.Item>
        <Form.Item label="Leilão (opcional)" tooltip="Quando a despesa foi feita para um leilão específico">
          <SeletorLeilao value={idLeilao} onChange={v => setIdLeilao(v)} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Observação"><Input value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={255} /></Form.Item>
        <Checkbox checked={lembrar} onChange={e => setLembrar(e.target.checked)}>
          {lancamento?.docContraparte
            ? `Da próxima vez que vier ${docFmt(lancamento.docContraparte)}, registrar sozinho nesta categoria`
            : 'Da próxima vez que vier este histórico, registrar sozinho nesta categoria'}
        </Checkbox>
      </Form>
    </Modal>
  );
}

/**
 * Despesa de cliente que ainda não foi lançada (ex.: frete do vendedor pago à transportadora):
 * cria nas Despesas do leilão — onde entra no acerto do cliente — e já paga com o débito.
 */
function CriarDespesaModal({ aberto, lancamento, idLancamento, restante, idLeilao: leilaoInicial, nomeLeilao, idCliente: clienteInicial,
  clientes, onBuscarClientes, onFechar, onSalvo }: {
  aberto: boolean; lancamento: any; idLancamento: number; restante: number; idLeilao?: number; nomeLeilao?: string;
  idCliente?: number; clientes: { value: number; label: string }[]; onBuscarClientes: (t: string) => void;
  onFechar: () => void; onSalvo: (c: Consulta) => void;
}) {
  const [idLeilao, setIdLeilao] = useState<number | undefined>();
  const [idCliente, setIdCliente] = useState<number | undefined>();
  const [observacoes, setObservacoes] = useState('');
  const [valor, setValor] = useState<number>(0);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setIdLeilao(leilaoInicial); setIdCliente(clienteInicial); setValor(restante);
    setObservacoes(`${lancamento?.nomeContraparte || 'Despesa'} - pago em ${fmtDataUTC(lancamento?.data)}`);
  }, [aberto, leilaoInicial, clienteInicial, restante, lancamento]);

  const salvar = async () => {
    if (!idLeilao || !idCliente) { message.warning('Escolha o leilão e o cliente da despesa'); return; }
    setSalvando(true);
    try {
      const r = await api.post(`/conciliacao/lancamentos/${idLancamento}/despesa-cliente`, { idLeilao, idCliente, observacoes, valor });
      message.success('Despesa lançada no leilão e paga com este débito');
      onSalvo(r.data);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao criar a despesa'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal open={aberto} title="Criar despesa de cliente" onCancel={onFechar} onOk={salvar} confirmLoading={salvando} okText="Criar e conciliar">
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        A despesa entra nas Despesas do leilão (e no acerto do cliente) e já fica paga por este débito.
      </Text>
      <Form layout="vertical">
        <Form.Item label="Leilão" required>
          <SeletorLeilao value={idLeilao} rotulo={nomeLeilao} onChange={v => setIdLeilao(v)} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Cliente (vendedor ou comprador que paga a despesa)" required>
          <Select showSearch allowClear filterOption={false} value={idCliente} options={clientes} onSearch={onBuscarClientes}
            onChange={setIdCliente} placeholder="Digite o nome" />
        </Form.Item>
        <Form.Item label="Descrição"><Input value={observacoes} onChange={e => setObservacoes(e.target.value)} maxLength={250} /></Form.Item>
        <Form.Item label="Valor" tooltip="Até o que falta conciliar deste débito">
          <InputNumber value={valor} onChange={v => setValor(Number(v) || 0)} min={0.01} max={restante} precision={2}
            style={{ width: 200 }} decimalSeparator="," prefix="R$" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
