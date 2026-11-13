import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Table, Typography, Space, Button, Select, Modal, Form, InputNumber, Radio, DatePicker, Tag, Alert, Checkbox,
  Drawer, Popconfirm, message, Tooltip,
} from 'antd';
import { PlusOutlined, StopOutlined, CheckSquareOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { Cabecalho, DESTINOS, fmtData, fmtValor, SeletorCliente } from './comum';
import { Historico } from './CobrancaParcelas';

const { Text } = Typography;

interface LoteVendedor {
  idLote: number; lote: string; animal: string; idLeilao: number; leilao: string; dataLeilao: string;
  vendas: number; total: number; qtdParcelas: number | null;
  cobranca: { destino: string; parcInicial: number | null; taxa: number | null; desde: string } | null;
  parcelas: { emAberto: number; valorEmAberto: number; vencidas: number; pagas: number; total: number } | null;
}

export default function CobrancaLotes() {
  const status = useOutletContext<{ taxaPadrao: number }>();
  const [vendedor, setVendedor] = useState<{ id?: number; nome?: string }>({});
  const [padrao, setPadrao] = useState<any>(null);
  const [soVendidos, setSoVendidos] = useState(true);
  const [dados, setDados] = useState<LoteVendedor[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [incluir, setIncluir] = useState(false);
  const [quitar, setQuitar] = useState<number[] | null>(null);
  const [hist, setHist] = useState<LoteVendedor | null>(null);

  const carregar = useCallback(async () => {
    if (!vendedor.id) { setDados([]); return; }
    setCarregando(true);
    try {
      const [l, p] = await Promise.all([
        api.get(`/cobranca/vendedores/${vendedor.id}/lotes`, { params: { soVendidos: soVendidos ? 'S' : undefined } }),
        api.get(`/cobranca/vendedores/${vendedor.id}/padrao`),
      ]);
      setDados(l.data); setPadrao(p.data); setSel([]);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao carregar'); }
    finally { setCarregando(false); }
  }, [vendedor.id, soVendidos]);
  useEffect(() => { carregar(); }, [carregar]);

  const selecionados = dados.filter(l => sel.includes(l.idLote));
  const emCobranca = selecionados.filter(l => l.cobranca);

  const tirar = async () => {
    try {
      await api.put('/cobranca/lotes', { idLotes: emCobranca.map(l => l.idLote), ativa: false });
      message.success('Lotes retirados da cobrança'); carregar();
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro'); }
  };

  const resumo = useMemo(() => {
    const c = dados.filter(l => l.cobranca);
    return { lotes: c.length, aberto: c.reduce((a, l) => a + (l.parcelas?.valorEmAberto || 0), 0) };
  }, [dados]);

  return (
    <>
      <Cabecalho titulo="Lotes em cobrança" sub="Escolha o vendedor, marque os lotes que a leiloeira vai cobrar e defina para onde vai o dinheiro e a taxa." />
      <div className="cb-filtros">
        <SeletorCliente placeholder="Vendedor" value={vendedor.id} rotulo={vendedor.nome} style={{ width: 340 }}
          onChange={(id, nome) => setVendedor({ id, nome })} />
        <Checkbox checked={soVendidos} onChange={e => setSoVendidos(e.target.checked)}>Só lotes já vendidos</Checkbox>
      </div>

      {!vendedor.id ? <div className="cb-card cb-vazio"><b>Escolha um vendedor</b>Os lotes dele aparecem aqui, vendidos ou não, com a situação da cobrança.</div> : (
        <>
          <Alert style={{ marginBottom: 12 }} type="info" showIcon
            message={<>
              {resumo.lotes} lote{resumo.lotes === 1 ? '' : 's'} em cobrança · {fmtValor(resumo.aberto)} a receber.{' '}
              {padrao?.padrao
                ? <>Lotes novos deste vendedor já entram na cobrança ({padrao.destino === 'MACEDO' ? 'conta da leiloeira' : 'conta do vendedor'}, taxa {padrao.taxa ?? status.taxaPadrao}%).</>
                : <>Lotes novos deste vendedor não entram sozinhos (ver Configurações).</>}
            </>} />
          <div className="cb-card">
          <div className="cb-acoes">
            <Button type="primary" icon={<PlusOutlined />} disabled={!sel.length} onClick={() => setIncluir(true)}>
              Incluir / alterar cobrança{sel.length ? ` (${sel.length})` : ''}
            </Button>
            <Button icon={<CheckSquareOutlined />} disabled={!emCobranca.length} onClick={() => setQuitar(emCobranca.map(l => l.idLote))}>
              Quitar parcelas antigas
            </Button>
            <Popconfirm title={`Tirar ${emCobranca.length} lote(s) da cobrança?`} description="As baixas e o histórico continuam guardados." onConfirm={tirar} disabled={!emCobranca.length}>
              <Button danger icon={<StopOutlined />} disabled={!emCobranca.length}>Tirar da cobrança</Button>
            </Popconfirm>
          </div>
          <Table size="small" rowKey="idLote" loading={carregando} dataSource={dados} pagination={{ pageSize: 100, hideOnSinglePage: true }}
            rowSelection={{ selectedRowKeys: sel, onChange: k => setSel(k as number[]) }}
            columns={[
              { title: 'Leilão', dataIndex: 'leilao', render: (v: string, l: LoteVendedor) => <>{v}<br /><Text type="secondary" style={{ fontSize: 12 }}>{fmtData(l.dataLeilao)}</Text></> },
              { title: 'Lote', dataIndex: 'lote', width: 60 },
              { title: 'Animal', dataIndex: 'animal', ellipsis: true },
              { title: 'Vendido por', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number, l: LoteVendedor) => (l.vendas ? fmtValor(v) : <Text type="secondary">não vendido</Text>) },
              { title: 'Parc.', dataIndex: 'qtdParcelas', width: 60, align: 'right' as const },
              { title: 'Cobrança', width: 210, render: (_: any, l: LoteVendedor) => l.cobranca ? (
                <Space size={2} wrap>
                  <Tag color="green">{l.cobranca.destino === 'MACEDO' ? 'Conta leiloeira' : 'Conta vendedor'}</Tag>
                  <Tag>{l.cobranca.parcInicial ? `da ${l.cobranca.parcInicial}ª` : 'após escritório'}</Tag>
                  <Tag>{l.cobranca.taxa ?? padrao?.taxa ?? status.taxaPadrao}%</Tag>
                </Space>
              ) : <Text type="secondary">fora</Text> },
              { title: 'A receber', width: 150, align: 'right' as const, render: (_: any, l: LoteVendedor) => l.parcelas ? (
                <>{fmtValor(l.parcelas.valorEmAberto)}<br /><Text type={l.parcelas.vencidas ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                  {l.parcelas.emAberto} em aberto{l.parcelas.vencidas ? ` · ${l.parcelas.vencidas} vencidas` : ''} · {l.parcelas.pagas} pagas</Text></>
              ) : '—' },
              { title: '', width: 40, render: (_: any, l: LoteVendedor) => (
                <Tooltip title="Histórico do lote"><Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => setHist(l)} /></Tooltip>
              ) },
            ]} />
          </div>
        </>
      )}

      {incluir && <ModalIncluir lotes={selecionados} padrao={padrao} taxaPadrao={status.taxaPadrao}
        onClose={(ok, novos) => {
          setIncluir(false);
          if (!ok) return;
          carregar();
          if (novos?.length) {
            Modal.confirm({
              title: 'Quitar as parcelas antigas?', okText: 'Quitar agora', cancelText: 'Depois',
              content: 'Lotes vendidos antes de entrar na cobrança podem ter parcelas que o vendedor já recebeu. Elas ficam como "quitada antes", sem taxa.',
              onOk: () => setQuitar(novos),
            });
          }
        }} />}
      {quitar && <ModalQuitar idLotes={quitar} onClose={ok => { setQuitar(null); if (ok) carregar(); }} />}
      {hist && <DrawerHistoricoLote lote={hist} onClose={() => setHist(null)} />}
    </>
  );
}

function ModalIncluir({ lotes, padrao, taxaPadrao, onClose }: {
  lotes: LoteVendedor[]; padrao: any; taxaPadrao: number; onClose: (ok: boolean, novos?: number[]) => void;
}) {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const base = lotes.find(l => l.cobranca)?.cobranca;
  const salvar = async () => {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      await api.put('/cobranca/lotes', {
        idLotes: lotes.map(l => l.idLote), ativa: true, destino: v.destino,
        parcInicial: v.modoParcela === 'NUMERO' ? v.parcInicial : null, taxa: v.taxaPropria ? v.taxa : null,
      });
      message.success('Cobrança salva');
      onClose(true, lotes.filter(l => !l.cobranca && l.vendas > 0).map(l => l.idLote));
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  };
  const taxaHerdada = padrao?.taxa ?? taxaPadrao;
  return (
    <Modal open title={`Cobrança de ${lotes.length} lote${lotes.length > 1 ? 's' : ''}`} onCancel={() => onClose(false)}
      onOk={salvar} okText="Salvar" confirmLoading={salvando} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false} initialValues={{
        destino: base?.destino || padrao?.destino || 'VENDEDOR',
        modoParcela: base?.parcInicial ? 'NUMERO' : 'AUTO', parcInicial: base?.parcInicial || 5,
        taxaPropria: base?.taxa != null, taxa: base?.taxa ?? taxaHerdada,
      }}>
        <Form.Item name="destino" label="Para onde vai o dinheiro das parcelas">
          <Radio.Group options={DESTINOS} />
        </Form.Item>
        <Form.Item name="modoParcela" label="A leiloeira cobra a partir de">
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="AUTO">Logo depois das parcelas do escritório (ex.: no 2+2+46, da 5ª em diante)</Radio>
              <Radio value="NUMERO">De uma parcela específica</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.modoParcela !== b.modoParcela}>
          {({ getFieldValue }) => getFieldValue('modoParcela') === 'NUMERO' && (
            <Form.Item name="parcInicial" label="Parcela inicial (número em 05/50)" rules={[{ required: true }]}>
              <InputNumber min={1} max={200} style={{ width: 120 }} />
            </Form.Item>
          )}
        </Form.Item>
        <Form.Item name="taxaPropria" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox>Taxa própria para {lotes.length > 1 ? 'estes lotes' : 'este lote'} (senão {taxaHerdada}%{padrao?.taxa != null ? ', do vendedor' : ', padrão da empresa'})</Checkbox>
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.taxaPropria !== b.taxaPropria}>
          {({ getFieldValue }) => getFieldValue('taxaPropria') && (
            <Form.Item name="taxa" label="Taxa (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} precision={2} decimalSeparator="," suffix="%" style={{ width: 120 }} />
            </Form.Item>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ModalQuitar({ idLotes, onClose }: { idLotes: number[]; onClose: (ok: boolean) => void }) {
  const [modo, setModo] = useState<'DATA' | 'MARCACAO'>('DATA');
  const [ate, setAte] = useState<Dayjs | null>(dayjs());
  const [parcelas, setParcelas] = useState<any[] | null>(null);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all(idLotes.map(id => api.get('/cobranca/parcelas', { params: { idLote: id, situacao: 'EM_ABERTO' } })))
      .then(rs => setParcelas(rs.flatMap(r => r.data)))
      .catch(() => message.error('Erro ao carregar as parcelas'));
  }, [idLotes]);

  const ateIso = ate?.format('YYYY-MM-DD');
  const porData = (parcelas || []).filter(p => ateIso && p.vencimento <= ateIso);
  const alvo = modo === 'DATA' ? porData : (parcelas || []).filter(p => marcadas.includes(p.id));
  const total = alvo.reduce((a, p) => a + p.saldo, 0);

  const salvar = async () => {
    if (!alvo.length) return message.warning('Nenhuma parcela para quitar');
    setSalvando(true);
    try {
      const r = await api.post('/cobranca/quitar-anteriores', modo === 'DATA' ? { idLotes, ate: ateIso } : { ids: marcadas });
      message.success(`${r.data.quitadas} parcela(s) quitada(s) — ${fmtValor(r.data.valor)}`);
      onClose(true);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao quitar'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal open width={820} title="Quitar parcelas antigas" onCancel={() => onClose(false)} onOk={salvar}
      okText={`Quitar ${alvo.length} parcela${alvo.length === 1 ? '' : 's'} (${fmtValor(total)})`} okButtonProps={{ disabled: !alvo.length }} confirmLoading={salvando}>
      <Text type="secondary">Parcelas que o vendedor já recebeu antes de a leiloeira assumir a cobrança. Ficam como "quitada antes" e não entram no fechamento (sem taxa).</Text>
      <div style={{ margin: '12px 0' }}>
        <Radio.Group value={modo} onChange={e => setModo(e.target.value)}>
          <Radio value="DATA">Todas as vencidas até</Radio>
          <Radio value="MARCACAO">Por marcação</Radio>
        </Radio.Group>
        {modo === 'DATA' && <DatePicker format="DD/MM/YYYY" value={ate} onChange={setAte} allowClear={false} />}
      </div>
      <Table size="small" rowKey="id" loading={!parcelas} pagination={{ pageSize: 15, hideOnSinglePage: true }}
        dataSource={modo === 'DATA' ? porData : parcelas || []}
        rowSelection={modo === 'MARCACAO' ? { selectedRowKeys: marcadas, onChange: k => setMarcadas(k as number[]) } : undefined}
        locale={{ emptyText: modo === 'DATA' ? 'Nenhuma parcela em aberto vencida até a data' : 'Nenhuma parcela em aberto' }}
        columns={[
          { title: 'Vencimento', dataIndex: 'vencimento', render: fmtData, width: 100 },
          { title: 'Lote', dataIndex: 'lote', width: 60 },
          { title: 'Comprador', dataIndex: 'comprador', ellipsis: true },
          { title: 'Parcela', dataIndex: 'ordxxx', width: 80 },
          { title: 'Saldo', dataIndex: 'saldo', render: fmtValor, align: 'right' as const, width: 110 },
        ]} />
    </Modal>
  );
}

function DrawerHistoricoLote({ lote, onClose }: { lote: LoteVendedor; onClose: () => void }) {
  const [itens, setItens] = useState<any[] | null>(null);
  useEffect(() => {
    api.get(`/cobranca/lotes/${lote.idLote}/historico`).then(r => setItens(r.data)).catch(() => setItens([]));
  }, [lote.idLote]);
  return (
    <Drawer open width={520} title={`Histórico — lote ${lote.lote} (${lote.leilao})`} onClose={onClose}>
      {itens ? <Historico itens={itens} /> : null}
    </Drawer>
  );
}
