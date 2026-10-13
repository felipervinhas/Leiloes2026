import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, Table, Typography, InputNumber, Button, Popconfirm, Input, Switch, Space, Tag, Alert, message } from 'antd';
import { DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmtDataUTC } from '../../utils/data';
import { docFmt } from './Lancamentos';

const { Title, Text } = Typography;

interface Condicao {
  id: number; descricao: string; grupos: number[]; saldo: number;
  gruposLeiloeira: number | null; padrao: number; usoUltimos12Meses: number;
}

/** Mesma regra do backend (ehParcelaDaLeiloeira): as unidades dos N primeiros grupos; sem grupos, só a 1ª parcela. */
function previa(c: Condicao, n: number): string {
  const unidades = c.grupos.slice(0, n).reduce((a, b) => a + b, 0);
  if (unidades <= 0) return 'Só a 1ª parcela (condição sem grupos iniciais)';
  const usados = c.grupos.slice(0, n).filter(g => g > 0);
  return `${usados.join(' + ')} = parcelas até a ${String(unidades).padStart(2, '0')}`;
}

function Condicoes({ adm }: { adm: boolean }) {
  const [lista, setLista] = useState<Condicao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [soUsadas, setSoUsadas] = useState(true);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [alterou, setAlterou] = useState(false);
  const [rodando, setRodando] = useState(false);

  const carregar = () => {
    setCarregando(true);
    api.get('/conciliacao/config/condicoes').then(r => setLista(r.data))
      .catch(() => message.error('Erro ao carregar as condições')).finally(() => setCarregando(false));
  };
  useEffect(carregar, []);

  const salvar = async (c: Condicao, grupos: number | null) => {
    setSalvando(c.id);
    try {
      await api.put(`/conciliacao/config/condicoes/${c.id}`, { grupos });
      setLista(ls => ls.map(x => x.id === c.id ? { ...x, gruposLeiloeira: grupos } : x));
      setAlterou(true);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(null); }
  };

  const rodar = async () => {
    setRodando(true);
    try {
      const r = await api.post('/conciliacao/conciliar-automatico');
      message.success(`${r.data.automaticos} conciliados sozinhos, ${r.data.sugeridos} com sugestão`);
      setAlterou(false);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro no casamento automático'); }
    finally { setRodando(false); }
  };

  const visiveis = useMemo(() => lista.filter(c =>
    (!soUsadas || c.usoUltimos12Meses > 0) && c.descricao.toLowerCase().includes(busca.toLowerCase())), [lista, soUsadas, busca]);

  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Quantos grupos de cada condição o comprador paga à leiloeira. Ex.: num 2 + 2 + 46, com 2 grupos, passam as
        parcelas até a 04. Sem configuração, vale o padrão de {lista[0]?.padrao ?? 2} grupos. Mudar aqui não desfaz baixas já feitas.
      </Text>
      {alterou && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Regras alteradas"
          description="Rode o casamento automático de novo para os lançamentos pendentes usarem as regras novas."
          action={<Button size="small" icon={<ThunderboltOutlined />} loading={rodando} onClick={rodar}>Rodar agora</Button>} />
      )}
      <Space style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="Buscar condição" style={{ width: 280 }} value={busca} onChange={e => setBusca(e.target.value)} />
        <Space size={6}><Switch checked={soUsadas} onChange={setSoUsadas} size="small" /><Text>Só as usadas nos últimos 12 meses</Text></Space>
      </Space>
      <Table rowKey="id" size="small" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 25, hideOnSinglePage: true }}
        columns={[
          { title: 'Condição', dataIndex: 'descricao', ellipsis: true,
            render: (v: string, c: Condicao) => v || <Text type="secondary">(sem nome · código {c.id})</Text> },
          { title: 'Grupos', width: 150, render: (_: any, c: Condicao) => {
              const g = c.grupos.filter(x => x > 0);
              return g.length ? `${g.join(' + ')}${c.saldo ? ` + ${c.saldo}` : ''}` : (c.saldo ? `${c.saldo}` : '—');
            } },
          { title: 'Vendas (12 meses)', dataIndex: 'usoUltimos12Meses', width: 140, align: 'right' as const },
          { title: 'Grupos da leiloeira', width: 190, render: (_: any, c: Condicao) => (
              <Space size={6}>
                <InputNumber min={1} max={6} size="small" style={{ width: 64 }} disabled={!adm || salvando === c.id}
                  value={c.gruposLeiloeira ?? undefined} placeholder={String(c.padrao)}
                  onChange={v => salvar(c, v == null ? null : Number(v))} />
                {c.gruposLeiloeira == null ? <Tag>padrão</Tag> : adm &&
                  <Button size="small" type="link" onClick={() => salvar(c, null)}>voltar ao padrão</Button>}
              </Space>
            ) },
          { title: 'Passam pela leiloeira', render: (_: any, c: Condicao) =>
              <Text type="secondary">{previa(c, c.gruposLeiloeira ?? c.padrao)}</Text> },
        ]} />
    </>
  );
}

function Regras({ adm }: { adm: boolean }) {
  const [lista, setLista] = useState<any[]>([]);
  const carregar = () => api.get('/conciliacao/config/regras').then(r => setLista(r.data)).catch(() => message.error('Erro ao carregar'));
  useEffect(() => { carregar(); }, []);
  const excluir = async (id: number) => {
    try { await api.delete(`/conciliacao/config/regras/${id}`); carregar(); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao excluir'); }
  };
  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Lançamentos com este CPF/CNPJ ou histórico são marcados como "não é venda" sozinhos na importação.
        Excluir a regra não muda os lançamentos já marcados.
      </Text>
      <Table rowKey="id" size="small" dataSource={lista} pagination={false} locale={{ emptyText: 'Nenhuma regra ainda — elas são criadas ao marcar um lançamento como "não é venda"' }}
        columns={[
          { title: 'Quando vier', render: (_: any, r: any) => r.doc
              ? <span>{r.nome || 'CPF/CNPJ'} <Text type="secondary">· {docFmt(r.doc)}</Text></span>
              : <span>Histórico com <Text code>{r.padraoMemo}</Text></span> },
          { title: 'Categoria', dataIndex: 'categoria' },
          { title: 'Lançamentos marcados', dataIndex: 'lancamentos', width: 170, align: 'right' as const },
          { title: 'Criada em', dataIndex: 'data', width: 110, render: (v: string) => fmtDataUTC(v) },
          { title: '', width: 60, render: (_: any, r: any) => adm &&
            <Popconfirm title="Excluir esta regra?" onConfirm={() => excluir(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> },
        ]} />
    </>
  );
}

function Pagadores({ adm }: { adm: boolean }) {
  const [lista, setLista] = useState<any[]>([]);
  const carregar = () => api.get('/conciliacao/config/pagadores').then(r => setLista(r.data)).catch(() => message.error('Erro ao carregar'));
  useEffect(() => { carregar(); }, []);
  const excluir = async (id: number) => {
    try { await api.delete(`/conciliacao/config/pagadores/${id}`); carregar(); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao excluir'); }
  };
  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Quem paga por outro cliente (pai, empresa, procurador). Pagamentos deste CPF/CNPJ são ligados ao cliente indicado.
      </Text>
      <Table rowKey="id" size="small" dataSource={lista} pagination={false} locale={{ emptyText: 'Nenhum pagador ainda — eles são criados na conciliação manual' }}
        columns={[
          { title: 'Quem paga', render: (_: any, r: any) => <span>{r.nome || '—'} <Text type="secondary">· {docFmt(r.doc)}</Text></span> },
          { title: 'Paga por', dataIndex: 'cliente', render: (v: string) => v || '—' },
          { title: 'Desde', dataIndex: 'data', width: 110, render: (v: string) => fmtDataUTC(v) },
          { title: '', width: 60, render: (_: any, r: any) => adm &&
            <Popconfirm title="Excluir este pagador?" onConfirm={() => excluir(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> },
        ]} />
    </>
  );
}

export default function ConfiguracoesFinanceiro() {
  const { usuario } = useAuth();
  const adm = usuario?.adm === 'S';
  return (
    <>
      <Title level={4}>Configurações</Title>
      {!adm && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Só administrador altera as configurações. Você pode consultar." />}
      <Tabs items={[
        { key: 'condicoes', label: 'Parcelas por condição', children: <Condicoes adm={adm} /> },
        { key: 'regras', label: 'Não é venda', children: <Regras adm={adm} /> },
        { key: 'pagadores', label: 'Pagadores conhecidos', children: <Pagadores adm={adm} /> },
      ]} />
    </>
  );
}
