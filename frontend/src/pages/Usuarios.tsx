import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm,
  Typography, Row, Col, message, Tag, Grid, Checkbox, Divider, Alert, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  KeyOutlined, UserOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const SN          = [{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }];
const BLOCLI      = [{ value: 'Não', label: 'Não' }, { value: 'Sim', label: 'Sim' }];
const ACESSO      = ['1 - Liberado', '2 - Bloqueado', '3 - Pendente', '4 - Reprovado'].map(v => ({ value: v, label: v }));
const TIPO_USR    = [{ value: 'ATENDENTE', label: 'Atendente' }, { value: 'PISTEIRO', label: 'Pisteiro' }];
const TIPO_COLOR: Record<string, string> = { ATENDENTE: 'blue', PISTEIRO: 'purple' };

const CONTROLES_GRUPOS = [
  { label: 'Leilões',   itens: ['Leilões', 'Lotes', 'Lançes', 'Ordem de Entrada'] },
  { label: 'Comercial', itens: ['Vendas', 'Consulta Vendas', 'Contratos', 'Cotações', 'Despesas'] },
  { label: 'Clientes',  itens: ['Clientes', 'Notificações'] },
  { label: 'Cadastros', itens: ['Cidades', 'Raças', 'Condições de Pagamento'] },
  { label: 'Sistema',   itens: ['Perfis', 'Usuários'] },
];

const TODOS_CONTROLES = CONTROLES_GRUPOS.flatMap(g => g.itens);

export default function Usuarios() {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [form] = Form.useForm();
  const [controlesSelecionados, setControlesSelecionados] = useState<string[]>([]);
  const [carregandoControles, setCarregandoControles] = useState(false);

  const carregar = async (b = '') => {
    setLoading(true);
    try { const r = await api.get('/usuarios', { params: { busca: b } }); setDados(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = async (item?: any) => {
    setEditando(item || null);
    form.setFieldsValue(item
      ? { ...item, senhax: '' }
      : { ativox: 'S', blocli: 'Não', acessoApp: '1 - Liberado', senhax: '' });
    setControlesSelecionados([]);
    if (item) {
      setCarregandoControles(true);
      try {
        const r = await api.get(`/usuarios/${item.id}/controles`);
        setControlesSelecionados(r.data ?? []);
      } catch { /* mantém vazio */ }
      finally { setCarregandoControles(false); }
    }
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    try {
      if (editando) {
        await api.put(`/usuarios/${editando.id}`, values);
        await api.put(`/usuarios/${editando.id}/controles`, { controles: controlesSelecionados });
      } else {
        const r = await api.post('/usuarios', values);
        if (controlesSelecionados.length > 0) {
          await api.put(`/usuarios/${r.data.id}/controles`, { controles: controlesSelecionados });
        }
      }
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const revogar = async (id: number) => {
    try { await api.delete(`/usuarios/${id}`); message.success('Acesso de administrador revogado'); carregar(busca); }
    catch { message.error('Erro ao revogar acesso'); }
  };

  const toggleGrupo = (itens: string[], todos: boolean) => {
    if (todos) {
      setControlesSelecionados(prev => Array.from(new Set([...prev, ...itens])));
    } else {
      setControlesSelecionados(prev => prev.filter(c => !itens.includes(c)));
    }
  };

  const colunas = [
    { title: 'Nome', dataIndex: 'nomexx', ellipsis: true },
    { title: 'E-mail', dataIndex: 'emailx', ellipsis: true, width: 220 },
    { title: 'CPF', dataIndex: 'cpfxxx', width: 130 },
    { title: 'Tipo', dataIndex: 'tipoUsuario', width: 110,
      render: (v: string) => v ? <Tag color={TIPO_COLOR[v] || 'default'}>{TIPO_USR.find(t => t.value === v)?.label ?? v}</Tag> : <span style={{ color: '#ccc' }}>—</span> },
    { title: 'Ativo', dataIndex: 'ativox', width: 80,
      render: (v: string) => <Tag color={v === 'S' ? 'green' : 'red'}>{v === 'S' ? 'Sim' : 'Não'}</Tag> },
    { title: 'Bloqueado', dataIndex: 'blocli', width: 100,
      render: (v: string) => v === 'Sim' ? <Tag color="volcano">Sim</Tag> : <Tag color="default">Não</Tag> },
    { title: 'Acesso App', dataIndex: 'acessoApp', width: 140, ellipsis: true },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Revogar acesso de administrador?" onConfirm={() => revogar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabDados = (
    <Form form={form} layout="vertical" onFinish={salvar}>
      <Row gutter={12}>
        <Col xs={24} sm={14}><Form.Item name="nomexx" label="Nome" rules={[{ required: true }]}><Input /></Form.Item></Col>
        <Col xs={24} sm={10}><Form.Item name="cpfxxx" label="CPF"><Input /></Form.Item></Col>
        <Col span={24}><Form.Item name="emailx" label="E-mail" rules={[{ type: 'email', message: 'E-mail inválido' }]}><Input /></Form.Item></Col>
        <Col span={24}>
          <Form.Item name="senhax" label={editando ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
            rules={editando ? [] : [{ required: true, message: 'Informe a senha' }]}>
            <Input.Password />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}><Form.Item name="tipoUsuario" label="Tipo de Usuário"><Select options={TIPO_USR} allowClear placeholder="Selecione..." /></Form.Item></Col>
        <Col xs={24} sm={8}><Form.Item name="ativox" label="Ativo"><Select options={SN} /></Form.Item></Col>
        <Col xs={24} sm={8}><Form.Item name="blocli" label="Bloqueado"><Select options={BLOCLI} /></Form.Item></Col>
        <Col span={24}><Form.Item name="acessoApp" label="Acesso App"><Select options={ACESSO} allowClear /></Form.Item></Col>
      </Row>
    </Form>
  );

  const tabPermissoes = (
    <div style={{ paddingTop: 4 }}>
      <Alert
        type="info"
        showIcon
        message="Sem nenhuma permissão selecionada, o usuário terá acesso total a todas as páginas."
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {controlesSelecionados.length === 0
            ? 'Nenhuma restrição — acesso total'
            : `${controlesSelecionados.length} de ${TODOS_CONTROLES.length} páginas permitidas`}
        </Text>
        <Space size={8}>
          <Button size="small" onClick={() => setControlesSelecionados(TODOS_CONTROLES)}>Selecionar todas</Button>
          <Button size="small" onClick={() => setControlesSelecionados([])}>Limpar</Button>
        </Space>
      </div>

      {CONTROLES_GRUPOS.map(grupo => {
        const selecionadosDoGrupo = grupo.itens.filter(i => controlesSelecionados.includes(i));
        const todosDoGrupo = selecionadosDoGrupo.length === grupo.itens.length;
        const algunsDoGrupo = selecionadosDoGrupo.length > 0 && !todosDoGrupo;

        return (
          <div key={grupo.label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Checkbox
                indeterminate={algunsDoGrupo}
                checked={todosDoGrupo}
                onChange={e => toggleGrupo(grupo.itens, e.target.checked)}
              />
              <Text strong style={{ fontSize: 13 }}>{grupo.label}</Text>
            </div>
            <div style={{ paddingLeft: 24, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              {grupo.itens.map(item => (
                <Checkbox
                  key={item}
                  checked={controlesSelecionados.includes(item)}
                  onChange={e => {
                    setControlesSelecionados(prev =>
                      e.target.checked ? [...prev, item] : prev.filter(c => c !== item)
                    );
                  }}
                >
                  {item}
                </Checkbox>
              ))}
            </div>
            <Divider style={{ margin: '12px 0 0' }} />
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <Title level={4}>Usuários do Sistema</Title>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input.Search placeholder="Buscar por nome ou e-mail..." value={busca}
            onChange={e => setBusca(e.target.value)} onSearch={() => carregar(busca)}
            enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Novo Usuário</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros`, simple: isMobile }}
        size="small" scroll={{ x: 'max-content' }} />

      <Modal
        title={
          <Space>
            {editando ? <><UserOutlined /> {editando.nomexx}</> : <><PlusOutlined /> Novo Usuário do Sistema</>}
          </Space>
        }
        open={modalOpen}
        onOk={form.submit}
        onCancel={() => setModalOpen(false)}
        width={isMobile ? '95vw' : 660}
        confirmLoading={carregandoControles}
        destroyOnClose
      >
        <Tabs
          size="small"
          items={[
            { key: 'dados',      label: <><UserOutlined /> Dados</>,       children: tabDados },
            { key: 'permissoes', label: <><KeyOutlined /> Permissões</>,   children: tabPermissoes },
          ]}
        />
      </Modal>
    </>
  );
}
