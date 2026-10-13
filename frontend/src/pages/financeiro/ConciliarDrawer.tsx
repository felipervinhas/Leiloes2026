import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Drawer, Descriptions, Tag, Alert, Button, Select, Segmented, Table, Space, Typography, Checkbox,
  message, Modal, Input, Radio, Spin, Empty, Divider,
} from 'antd';
import { CheckOutlined, UndoOutlined, StopOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { fmtDataUTC } from '../../utils/data';
import { fmtValor, SITUACOES, docFmt } from './Lancamentos';

const { Text } = Typography;
const r2 = (v: number) => Math.round(v * 100) / 100;

interface Item {
  chave: string; tipo: string; leilao: string | null; lote: string | null; descricao: string;
  vencimento: string | null; valor: number; pago: number; saldo: number; daLeiloeira: boolean;
}
interface Consulta {
  lancamento: any; cliente: { id: number; nome: string | null } | null; papel: 'comprador' | 'vendedor';
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
  const [papel, setPapel] = useState<'comprador' | 'vendedor' | undefined>();
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
  const outroCliente = !!(l && idCliente && idCliente !== l.idCliente);

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

  const confirmar = async (regra: 'MANUAL' | 'SUGESTAO' = 'MANUAL') => {
    const itens = alocar();
    if (!itens.length) return;
    setSalvando(true);
    try {
      const r = await api.post(`/conciliacao/lancamentos/${idLancamento}/baixas`, {
        itens, idCliente, lembrarPagador: outroCliente && lembrarPagador, regra,
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

  const mudarFiltro = (f: { idCliente?: number; papel?: 'comprador' | 'vendedor'; idLeilao?: number | null }) => {
    const novo = { idCliente: f.idCliente ?? idCliente, papel: f.papel ?? papel, idLeilao: f.idLeilao === null ? undefined : (f.idLeilao ?? idLeilao) };
    if (f.idCliente !== undefined && f.idCliente !== idCliente) novo.idLeilao = undefined;
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
              description="Os itens sugeridos já estão marcados abaixo. Confira e confirme, ou marque outros itens."
              action={<Button type="primary" size="small" icon={<CheckOutlined />} loading={salvando}
                disabled={Math.abs(diferenca) >= 0.011} onClick={() => confirmar('SUGESTAO')}>Confirmar sugestão</Button>} />
          )}

          {consulta.baixas.length > 0 && (
            <>
              <Divider titlePlacement="left" plain>Baixas deste lançamento</Divider>
              <Table rowKey="id" size="small" pagination={false} dataSource={consulta.baixas}
                columns={[
                  { title: 'Item', dataIndex: 'tipo', render: (t: string) => ({ PARCELA: 'Parcela', COMISSAO_COMPRA: 'Comissão de compra', REPASSE: 'Repasse' } as any)[t] || t },
                  { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: fmtValor },
                  { title: 'Como', dataIndex: 'regra', render: (r: string) => r === 'MANUAL' ? 'Manual' : r === 'SUGESTAO' ? 'Sugestão confirmada' : `Automático (${r})` },
                  { title: 'Por', dataIndex: 'usuario', render: (u: string) => u || '—' },
                  { title: '', width: 90, render: (_: any, b: any) =>
                    <Button size="small" icon={<UndoOutlined />} loading={salvando} onClick={() => desfazer(b.id)}>Desfazer</Button> },
                ]} />
            </>
          )}

          {l.situacao === 'NAO_VENDA' ? (
            <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Marcado como não é venda"
              action={<Button size="small" onClick={() => desfazer()}>Desfazer</Button>} />
          ) : restante > 0.009 && (
            <>
              <Divider titlePlacement="left" plain>Procurar o que este pagamento cobre</Divider>
              <Space wrap style={{ marginBottom: 12 }}>
                <Select showSearch allowClear placeholder="Cliente (nome)" style={{ width: 320 }} filterOption={false}
                  value={idCliente} options={clientes} onSearch={buscarClientes}
                  onChange={(v?: number) => mudarFiltro({ idCliente: v })} />
                <Segmented value={papel} onChange={v => mudarFiltro({ papel: v as any })}
                  options={[{ value: 'comprador', label: 'Como comprador' }, { value: 'vendedor', label: 'Como vendedor' }]} />
                <Select allowClear placeholder="Todos os leilões" style={{ width: 300 }} value={idLeilao}
                  options={consulta.leiloes.map(x => ({ value: x.id, label: x.nome }))}
                  onChange={(v?: number) => mudarFiltro({ idLeilao: v ?? null })} />
              </Space>
              {outroCliente && l.docContraparte && (
                <div style={{ marginBottom: 8 }}>
                  <Checkbox checked={lembrarPagador} onChange={e => setLembrarPagador(e.target.checked)}>
                    Lembrar {docFmt(l.docContraparte)} como pagador deste cliente (da próxima vez casa sozinho)
                  </Checkbox>
                </div>
              )}

              {!idCliente ? <Empty description="Escolha o cliente para ver o que está em aberto" /> : (
                <Table rowKey="chave" size="small" loading={carregando} dataSource={consulta.itens}
                  pagination={{ pageSize: 15, hideOnSinglePage: true }}
                  rowSelection={{ selectedRowKeys: marcados, onChange: ks => { interagiu.current = true; setMarcados(ks as string[]); } }}
                  locale={{ emptyText: 'Nada em aberto para este cliente' }}
                  columns={[
                    { title: 'Leilão', dataIndex: 'leilao', ellipsis: true },
                    { title: 'Lote', dataIndex: 'lote', width: 70 },
                    { title: 'Item', dataIndex: 'descricao', render: (v: string, it: Item) =>
                      <Space size={4}>{v}{it.tipo === 'PARCELA' && !it.daLeiloeira && <Tag>depois das iniciais</Tag>}</Space> },
                    { title: 'Vencimento', dataIndex: 'vencimento', width: 110, render: (v: string) => fmtDataUTC(v) },
                    { title: 'Valor', dataIndex: 'valor', width: 120, align: 'right' as const, render: fmtValor },
                    { title: 'Em aberto', dataIndex: 'saldo', width: 120, align: 'right' as const, render: (v: number) => <Text strong>{fmtValor(v)}</Text> },
                  ]} />
              )}

              <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #f0f0f0', padding: '12px 0', marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Space size={24}>
                  <span>Falta conciliar <Text strong>{fmtValor(restante)}</Text></span>
                  <span>Marcado <Text strong>{fmtValor(somaMarcada)}</Text></span>
                  <span>Diferença <Text strong type={Math.abs(diferenca) < 0.011 ? 'success' : diferenca < 0 ? 'danger' : 'warning'}>{fmtValor(diferenca)}</Text></span>
                </Space>
                <Space>
                  <Button icon={<StopOutlined />} onClick={() => setNaoVendaAberto(true)} disabled={consulta.baixas.length > 0}>Não é venda</Button>
                  <Button type="primary" icon={<CheckOutlined />} loading={salvando} disabled={!marcados.length || Math.abs(diferenca) < 0.011}
                    onClick={() => confirmar()}>
                    {diferenca > 0 ? 'Conciliar parcial' : 'Conciliar (último item parcial)'}
                  </Button>
                </Space>
              </div>
            </>
          )}
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
