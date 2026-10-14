import React, { useEffect, useMemo, useState } from 'react';
import { Typography, Space, Input, Segmented, Card, Table, Radio, Tag, Button, Popconfirm, Checkbox, Pagination,
  Empty, Spin, message, Modal, Progress, Tooltip } from 'antd';
import { MergeCellsOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import api from '../services/api';
import { fmtDataUTC } from '../utils/data';

const { Title, Text } = Typography;

interface ClienteDup {
  id: number; nome: string; cpf: string | null; cnpj: string | null; datcad: string | null; ativo: string | null;
  acessoApp: string | null; email: string | null; celular: string | null; temSenha: boolean; adm: boolean;
  cidade: string | null; usuarioCad: string | null;
  compras: number; lotes: number; vendas: number; lances: number; despesas: number; uso: number;
}
interface Grupo {
  chave: string; doc: string; tipo: 'CPF' | 'CNPJ'; clientes: ClienteDup[]; idSugerido: number;
  nomesDiferentes: boolean; comMovimento: number; temUsuario: boolean;
}
type Filtro = 'todos' | 'sem' | 'um' | 'varios' | 'nomes';

const fmtDoc = (tipo: string, d: string) => tipo === 'CPF'
  ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  : d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
const POR_PAGINA = 15;

/**
 * Clientes cadastrados mais de uma vez com o mesmo CPF/CNPJ (o Delphi e o site/app não
 * conferem). Em cada grupo escolhe-se o cadastro que fica; as compras, vendas, parcelas,
 * lances e despesas das cópias passam para ele e as cópias são apagadas.
 */
export default function ClientesDuplicados() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [principal, setPrincipal] = useState<Record<string, number>>({});
  const [completar, setCompletar] = useState(true);
  const [unificando, setUnificando] = useState<string | null>(null);
  const [lote, setLote] = useState<{ feitos: number; total: number; erros: number } | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/clientes/duplicados');
      setGrupos(r.data);
      // usuário do sistema não pode ser apagado: se houver um no grupo, é ele que fica
      setPrincipal(Object.fromEntries(r.data.map((g: Grupo) => [g.chave, g.clientes.find(c => c.adm)?.id ?? g.idSugerido])));
    } catch { message.error('Erro ao carregar os clientes duplicados'); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  const contagem = useMemo(() => ({
    todos: grupos.length,
    sem: grupos.filter(g => g.comMovimento === 0).length,
    um: grupos.filter(g => g.comMovimento === 1).length,
    varios: grupos.filter(g => g.comMovimento >= 2).length,
    nomes: grupos.filter(g => g.nomesDiferentes).length,
  }), [grupos]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const num = busca.replace(/\D/g, '');
    return grupos.filter(g =>
      (filtro === 'todos' || (filtro === 'sem' && g.comMovimento === 0) || (filtro === 'um' && g.comMovimento === 1)
        || (filtro === 'varios' && g.comMovimento >= 2) || (filtro === 'nomes' && g.nomesDiferentes))
      && (!t || (num.length >= 3 && g.doc.includes(num))
        || g.clientes.some(c => c.nome.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t))));
  }, [grupos, filtro, busca]);
  useEffect(() => { setPagina(1); }, [filtro, busca]);

  const unificarGrupo = async (g: Grupo, silencioso = false) => {
    const idPrincipal = principal[g.chave];
    const idsCopias = g.clientes.map(c => c.id).filter(id => id !== idPrincipal);
    await api.post('/clientes/duplicados/unificar', { idPrincipal, idsCopias, completar });
    setGrupos(gs => gs.filter(x => x.chave !== g.chave));
    if (!silencioso) message.success(`Unificado: ficou o cadastro #${idPrincipal}, ${idsCopias.length} cópia(s) apagada(s)`);
  };

  const confirmarUnificar = async (g: Grupo) => {
    setUnificando(g.chave);
    try { await unificarGrupo(g); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao unificar'); }
    finally { setUnificando(null); }
  };

  // os sem movimento e com o mesmo nome não têm o que decidir: fica o mais antigo
  const triviais = useMemo(() => grupos.filter(g => g.comMovimento === 0 && !g.nomesDiferentes && !g.temUsuario), [grupos]);
  const unificarTriviais = () => Modal.confirm({
    title: `Unificar ${triviais.length} grupos sem movimento e com o mesmo nome?`,
    content: 'Em cada grupo fica o cadastro mais antigo; as cópias são apagadas e os campos vazios dele recebem os da cópia (telefone, e-mail, endereço...). Nenhum desses cadastros tem compra, venda, lote, lance ou despesa.',
    okText: 'Unificar todos', cancelText: 'Cancelar',
    onOk: async () => {
      const lista = [...triviais];
      setLote({ feitos: 0, total: lista.length, erros: 0 });
      let erros = 0;
      for (let i = 0; i < lista.length; i++) {
        try { await unificarGrupo(lista[i], true); } catch { erros++; }
        setLote({ feitos: i + 1, total: lista.length, erros });
      }
      setLote(null);
      if (erros) message.warning(`${lista.length - erros} unificados, ${erros} com erro (continuam na lista)`);
      else message.success(`${lista.length} grupos unificados`);
    },
  });

  const pagina_ = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
        <Title level={4} style={{ margin: 0 }}>Clientes duplicados</Title>
        <Space wrap>
          <Checkbox checked={completar} onChange={e => setCompletar(e.target.checked)}>
            Completar campos vazios com os da cópia
          </Checkbox>
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          <Button type="primary" icon={<MergeCellsOutlined />} disabled={!triviais.length || !!lote} onClick={unificarTriviais}>
            Unificar os {triviais.length} sem movimento
          </Button>
        </Space>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Clientes com o mesmo CPF ou CNPJ. Escolha em cada grupo o cadastro que fica (sugerido: o de mais movimento, ou o mais antigo).
        Compras, vendas, parcelas, lotes, lances, despesas, propriedades e classificações das cópias passam para ele, e as cópias são apagadas.
      </Text>

      {lote && <Progress percent={Math.round((lote.feitos / lote.total) * 100)} format={() => `${lote.feitos}/${lote.total}`} style={{ marginBottom: 12 }} />}

      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented value={filtro} onChange={v => setFiltro(v as Filtro)} options={[
          { value: 'todos', label: `Todos (${contagem.todos})` },
          { value: 'sem', label: `Sem movimento (${contagem.sem})` },
          { value: 'um', label: `Movimento em um (${contagem.um})` },
          { value: 'varios', label: `Movimento em vários (${contagem.varios})` },
          { value: 'nomes', label: `Nomes diferentes (${contagem.nomes})` },
        ]} />
        <Input.Search allowClear placeholder="Nome ou CPF/CNPJ" style={{ width: 260 }} onSearch={setBusca} onChange={e => !e.target.value && setBusca('')} />
      </Space>

      {carregando && !grupos.length ? <Spin /> : !filtrados.length ? <Empty description="Nenhum cliente duplicado aqui" /> : (
        <>
          {pagina_.map(g => {
            const idP = principal[g.chave];
            const copias = g.clientes.filter(c => c.id !== idP);
            const movCopias = copias.reduce((a, c) => a + c.uso, 0);
            return (
              <Card key={g.chave} size="small" style={{ marginBottom: 12 }}
                title={<Space wrap>
                  <Text strong>{g.tipo} {fmtDoc(g.tipo, g.doc)}</Text>
                  <Tag>{g.clientes.length} cadastros</Tag>
                  {g.nomesDiferentes && <Tooltip title="Confira se é a mesma pessoa (pode ser condomínio, empresa ou erro de digitação no CPF)">
                    <Tag color="orange" icon={<WarningOutlined />}>nomes diferentes</Tag></Tooltip>}
                  {g.comMovimento >= 2 && <Tag color="blue">movimento em {g.comMovimento} cadastros</Tag>}
                </Space>}
                extra={copias.some(c => c.adm) ? <Tag color="red">usuário do sistema não pode ser cópia</Tag> : (
                  <Popconfirm
                    title={`Fica o cadastro #${idP}`}
                    description={<div style={{ maxWidth: 360 }}>
                      {copias.map(c => `#${c.id}`).join(', ')} {copias.length > 1 ? 'serão apagados' : 'será apagado'}
                      {movCopias > 0 ? ` e ${movCopias} registro(s) de movimento passam para o #${idP}` : ''}.
                      {completar ? ' Os campos vazios do que fica recebem os da cópia.' : ''} Não dá para desfazer.
                    </div>}
                    okText="Unificar" cancelText="Cancelar" onConfirm={() => confirmarUnificar(g)}>
                    <Button type="primary" size="small" icon={<MergeCellsOutlined />} loading={unificando === g.chave} disabled={!!lote}>Unificar</Button>
                  </Popconfirm>
                )}>
                <Table rowKey="id" size="small" pagination={false} dataSource={g.clientes}
                  rowClassName={c => c.id === idP ? 'linha-principal' : ''}
                  columns={[
                    { title: 'Fica', width: 50, render: (_: any, c: ClienteDup) =>
                      <Radio checked={c.id === idP} disabled={c.adm} onChange={() => setPrincipal(p => ({ ...p, [g.chave]: c.id }))} /> },
                    { title: 'Cliente', render: (_: any, c: ClienteDup) => <div>
                      <Text strong={c.id === idP}>#{c.id} {c.nome}</Text>
                      {c.ativo === 'N' && <Tag style={{ marginLeft: 6 }}>inativo</Tag>}
                      {c.adm && <Tag color="red" style={{ marginLeft: 6 }}>usuário</Tag>}
                      <div><Text type="secondary" style={{ fontSize: 12 }}>
                        {[c.cidade, c.celular, c.email].filter(Boolean).join(' · ') || 'sem contato'}
                      </Text></div>
                    </div> },
                    { title: 'Cadastro', width: 170, render: (_: any, c: ClienteDup) => <div>
                      {fmtDataUTC(c.datcad)}
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{c.usuarioCad || (c.temSenha ? 'site/app' : '—')}</Text></div>
                    </div> },
                    { title: 'Site/app', width: 130, render: (_: any, c: ClienteDup) => c.temSenha
                      ? <Text style={{ fontSize: 12 }}>tem senha{c.acessoApp ? <><br />{c.acessoApp}</> : null}</Text>
                      : <Text type="secondary" style={{ fontSize: 12 }}>sem senha</Text> },
                    { title: 'Movimento', width: 230, render: (_: any, c: ClienteDup) => c.uso === 0
                      ? <Text type="secondary">nenhum</Text>
                      : <Text style={{ fontSize: 12 }}>{[
                          c.compras && `${c.compras} compra(s)`, c.lotes && `${c.lotes} lote(s)`, c.vendas && `${c.vendas} venda(s)`,
                          c.lances && `${c.lances} lance(s)`, c.despesas && `${c.despesas} despesa(s)`,
                        ].filter(Boolean).join(' · ')}</Text> },
                  ]} />
              </Card>
            );
          })}
          <Pagination current={pagina} pageSize={POR_PAGINA} total={filtrados.length} onChange={setPagina} showSizeChanger={false}
            showTotal={t => `${t} grupos`} />
        </>
      )}
      <style>{'.linha-principal td { background: #f6ffed !important; }'}</style>
    </>
  );
}
