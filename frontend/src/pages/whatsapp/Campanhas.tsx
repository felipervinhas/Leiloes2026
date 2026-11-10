import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Button, Card, Col, Drawer, Input, Popconfirm, Progress, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CaretRightOutlined, DeleteOutlined, PauseOutlined, PlusOutlined, RedoOutlined, ReloadOutlined, StopOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import NovaCampanha from './NovaCampanha';
import { Campanha, CATEGORIA, erroApi, fmtDataHora, fmtReais, STATUS_CAMPANHA, STATUS_ENVIO } from './tipos';

const { Text, Paragraph } = Typography;

function Acoes({ c, aoMudar }: { c: Campanha; aoMudar: () => void }) {
  const [carregando, setCarregando] = useState<string | null>(null);
  const executar = async (acao: string, msg: string) => {
    setCarregando(acao);
    try {
      const r = await api.post(`/whatsapp/campanhas/${c.id}/${acao}`);
      if (acao === 'reenviar-falhas') message.success(`${r.data.resultado || 0} mensagem(ns) de volta na fila`);
      else message.success(msg);
      aoMudar();
    } catch (e) { message.error(erroApi(e, 'Não foi possível concluir')); }
    finally { setCarregando(null); }
  };
  const excluir = async () => {
    try { await api.delete(`/whatsapp/campanhas/${c.id}`); message.success('Campanha excluída'); aoMudar(); }
    catch (e) { message.error(erroApi(e, 'Não foi possível excluir')); }
  };
  return (
    <Space size={4} onClick={e => e.stopPropagation()}>
      {['AGUARDANDO', 'AGENDADA', 'PAUSADA'].includes(c.status) && (
        <Popconfirm title={`Enviar para ${c.pendentes} contato(s) agora?`} onConfirm={() => executar('iniciar', 'Envio iniciado')}>
          <Tooltip title={c.status === 'PAUSADA' ? 'Retomar' : 'Iniciar envio'}>
            <Button size="small" type="primary" icon={<CaretRightOutlined />} loading={carregando === 'iniciar'} />
          </Tooltip>
        </Popconfirm>
      )}
      {['ENVIANDO', 'AGENDADA'].includes(c.status) && (
        <Tooltip title="Pausar">
          <Button size="small" icon={<PauseOutlined />} loading={carregando === 'pausar'} onClick={() => executar('pausar', 'Campanha pausada')} />
        </Tooltip>
      )}
      {c.falhas > 0 && !['CANCELADA'].includes(c.status) && (
        <Popconfirm title={`Tentar de novo as ${c.falhas} falha(s)?`} onConfirm={() => executar('reenviar-falhas', '')}>
          <Tooltip title="Reenviar falhas"><Button size="small" icon={<RedoOutlined />} loading={carregando === 'reenviar-falhas'} /></Tooltip>
        </Popconfirm>
      )}
      {!['CONCLUIDA', 'CANCELADA'].includes(c.status) && (
        <Popconfirm title="Cancelar a campanha? O que ainda não foi enviado não será mais." onConfirm={() => executar('cancelar', 'Campanha cancelada')}>
          <Tooltip title="Cancelar"><Button size="small" danger icon={<StopOutlined />} loading={carregando === 'cancelar'} /></Tooltip>
        </Popconfirm>
      )}
      {c.enviados === 0 && c.status !== 'ENVIANDO' && (
        <Popconfirm title="Excluir a campanha?" onConfirm={excluir}>
          <Tooltip title="Excluir"><Button size="small" danger type="text" icon={<DeleteOutlined />} /></Tooltip>
        </Popconfirm>
      )}
    </Space>
  );
}

function Detalhe({ id, aoMudar, onClose }: { id: number; aoMudar: () => void; onClose: () => void }) {
  const [c, setC] = useState<Campanha | null>(null);
  const [envios, setEnvios] = useState<{ total: number; itens: any[] }>({ total: 0, itens: [] });
  const [filtro, setFiltro] = useState<{ status?: string; busca?: string; pagina: number }>({ pagina: 1 });
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [rc, re] = await Promise.all([
        api.get(`/whatsapp/campanhas/${id}`),
        api.get(`/whatsapp/campanhas/${id}/envios`, { params: { ...filtro, tamanho: 50 } }),
      ]);
      setC(rc.data); setEnvios(re.data);
    } finally { setCarregando(false); }
  }, [id, filtro]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (c?.status !== 'ENVIANDO') return;
    const t = setInterval(carregar, 10_000);
    return () => clearInterval(t);
  }, [c?.status, carregar]);

  if (!c) return null;
  const processados = c.total - c.pendentes;

  return (
    <Drawer open title={c.nome} size="large" onClose={onClose}
      extra={<Space><Acoes c={c} aoMudar={() => { carregar(); aoMudar(); }} /><Button icon={<ReloadOutlined />} onClick={carregar} /></Space>}>
      <Space wrap style={{ marginBottom: 8 }}>
        <Tag color={STATUS_CAMPANHA[c.status]?.color}>{STATUS_CAMPANHA[c.status]?.label || c.status}</Tag>
        <Tag>{CATEGORIA[c.categoria] || c.categoria}</Tag>
        <Text type="secondary">Template {c.templateNome}</Text>
        {c.leilao && <Text type="secondary">· Leilão {c.leilao}</Text>}
      </Space>
      {c.ultimoErro && <Alert type="error" showIcon message={c.ultimoErro} style={{ marginBottom: 12 }} />}
      {c.status === 'AGENDADA' && <Alert type="info" showIcon message={`Agendada para ${fmtDataHora(c.agendadaPara)}`} style={{ marginBottom: 12 }} />}
      <Progress percent={c.total ? Math.round(processados * 100 / c.total) : 0} status={c.status === 'ENVIANDO' ? 'active' : undefined} />
      <Row gutter={12} style={{ margin: '12px 0' }}>
        <Col span={4}><Statistic title="Total" value={c.total} /></Col>
        <Col span={4}><Statistic title="Na fila" value={c.pendentes} /></Col>
        <Col span={4}><Statistic title="Entregues" value={c.entregues} /></Col>
        <Col span={4}><Statistic title="Lidas" value={c.lidos} /></Col>
        <Col span={4}><Statistic title="Falhas" value={c.falhas} valueStyle={c.falhas ? { color: '#cf1322' } : undefined} /></Col>
        <Col span={4}><Statistic title="Custo (entregues)" value={fmtReais(c.custoReal)} /></Col>
      </Row>
      <Card size="small" title="Texto do template" style={{ marginBottom: 12 }}>
        <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{c.templateTexto}</Paragraph>
      </Card>
      <Space style={{ marginBottom: 8 }} wrap>
        <Select allowClear placeholder="Situação" style={{ width: 160 }} value={filtro.status}
          onChange={v => setFiltro(f => ({ ...f, status: v, pagina: 1 }))}
          options={[
            { value: 'pendentes', label: 'Na fila' }, { value: 'enviados', label: 'Enviadas' },
            { value: 'entregues', label: 'Entregues' }, { value: 'lidos', label: 'Lidas' },
            { value: 'falhas', label: 'Falhas' }, { value: 'cancelados', label: 'Canceladas/descadastradas' },
          ]} />
        <Input.Search allowClear placeholder="Nome ou telefone" style={{ width: 240 }}
          onSearch={v => setFiltro(f => ({ ...f, busca: v || undefined, pagina: 1 }))} />
      </Space>
      <Table
        rowKey="id" size="small" loading={carregando} dataSource={envios.itens}
        pagination={{ current: filtro.pagina, pageSize: 50, total: envios.total, showSizeChanger: false,
          onChange: p => setFiltro(f => ({ ...f, pagina: p })), showTotal: t => `${t} contatos` }}
        columns={[
          { title: 'Nome', dataIndex: 'nome', ellipsis: true },
          { title: 'Telefone', dataIndex: 'telefone', width: 170 },
          { title: 'Situação', dataIndex: 'status', width: 120,
            render: (s: string) => <Tag color={STATUS_ENVIO[s]?.color}>{STATUS_ENVIO[s]?.label || s}</Tag> },
          { title: 'Enviada', dataIndex: 'enviadoEm', width: 130, render: fmtDataHora },
          { title: 'Erro', dataIndex: 'erro', ellipsis: true,
            render: (e: string, r: any) => e ? <Tooltip title={e}><Text type="danger">{r.erroCodigo ? `[${r.erroCodigo}] ` : ''}{e}</Text></Tooltip> : null },
        ]}
      />
    </Drawer>
  );
}

export default function Campanhas({ configurado }: { configurado: boolean }) {
  const [dados, setDados] = useState<Campanha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const montado = useRef(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { const r = await api.get('/whatsapp/campanhas'); if (montado.current) setDados(r.data); }
    catch (e) { message.error(erroApi(e, 'Erro ao carregar campanhas')); }
    finally { if (montado.current) setCarregando(false); }
  }, []);

  useEffect(() => { montado.current = true; carregar(); return () => { montado.current = false; }; }, [carregar]);
  useEffect(() => {
    if (!dados.some(c => c.status === 'ENVIANDO')) return;
    const t = setInterval(carregar, 15_000);
    return () => clearInterval(t);
  }, [dados, carregar]);

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} disabled={!configurado} onClick={() => setNova(true)}>Nova campanha</Button>
        <Button icon={<ReloadOutlined />} onClick={carregar} />
      </Space>
      <Table
        rowKey="id" size="small" loading={carregando} dataSource={dados}
        onRow={r => ({ onClick: () => setAberta(r.id), style: { cursor: 'pointer' } })}
        pagination={{ pageSize: 20, showTotal: t => `${t} campanhas` }}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Campanha', dataIndex: 'nome', ellipsis: true },
          { title: 'Situação', dataIndex: 'status', width: 140,
            render: (s: string) => <Tag color={STATUS_CAMPANHA[s]?.color}>{STATUS_CAMPANHA[s]?.label || s}</Tag> },
          { title: 'Tipo', dataIndex: 'categoria', width: 100, render: (v: string) => CATEGORIA[v] || v },
          { title: 'Progresso', width: 180, render: (_: any, c: Campanha) =>
              <Progress size="small" percent={c.total ? Math.round((c.total - c.pendentes) * 100 / c.total) : 0} /> },
          { title: 'Total', dataIndex: 'total', width: 80, align: 'right' as const },
          { title: 'Entregues', dataIndex: 'entregues', width: 90, align: 'right' as const },
          { title: 'Lidas', dataIndex: 'lidos', width: 80, align: 'right' as const },
          { title: 'Falhas', dataIndex: 'falhas', width: 80, align: 'right' as const,
            render: (v: number) => v ? <Text type="danger">{v}</Text> : 0 },
          { title: 'Custo', width: 110, align: 'right' as const,
            render: (_: any, c: Campanha) => <Tooltip title={`Estimado: ${fmtReais(c.custoEstimado)}`}>{fmtReais(c.custoReal)}</Tooltip> },
          { title: 'Criada', dataIndex: 'criadaEm', width: 130, render: fmtDataHora },
          { title: 'Ações', width: 170, render: (_: any, c: Campanha) => <Acoes c={c} aoMudar={carregar} /> },
        ]}
      />
      {nova && <NovaCampanha onClose={() => setNova(false)} aoCriar={id => { setNova(false); carregar(); setAberta(id); }} />}
      {aberta && <Detalhe id={aberta} aoMudar={carregar} onClose={() => setAberta(null)} />}
    </>
  );
}
