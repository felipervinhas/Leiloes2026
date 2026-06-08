import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, Space, Popconfirm,
  Typography, Row, Col, message, Tag, Tabs, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, AimOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';

const { Title } = Typography;

interface Cliente { id: number; nomexx?: string; cpfxxx?: string; cnpjxx?: string; emailx?: string;
  celu1?: string; ativox?: string; blocli?: string; adm?: string; acessoApp?: string; datcad?: string; }

const STATUS_COLOR: Record<string, string> = { S: 'green', N: 'red' };
const SN = [{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }];
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'].map(v => ({ value: v, label: v }));
const ACESSO = ['1 - Liberado', '2 - Bloqueado', '3 - Pendente', '4 - Reprovado'].map(v => ({ value: v, label: v }));
const FILTROS = [{ value: 'nome', label: 'Nome' }, { value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' }, { value: 'email', label: 'E-mail' }];

export default function Clientes() {
  const [dados, setDados] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroCampo, setFiltroCampo] = useState('nome');
  const [cidades, setCidades] = useState<{ value: number; label: string }[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [form] = Form.useForm();

  const carregar = async (b = '') => {
    setLoading(true);
    try {
      const r = await api.get('/clientes', { params: { busca: b, filtro: filtroCampo } });
      setDados(r.data);
    } finally { setLoading(false); }
  };

  const carregarCidades = async () => {
    const r = await api.get('/cidades');
    setCidades(r.data.map((c: any) => ({ value: c.id, label: `${c.cidade} - ${c.estado}` })));
  };

  const buscarCep = async () => {
    const cep = (form.getFieldValue('cepxxx') || '').replace(/\D/g, '');
    if (cep.length !== 8) { message.warning('Digite um CEP com 8 dígitos'); return; }
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (data.erro) { message.error('CEP não encontrado'); return; }
      form.setFieldsValue({
        endere: data.logradouro || '',
        comple: data.complemento || '',
        bairro: data.bairro || '',
      });
      const label = `${data.localidade} - ${data.uf}`;
      const cidadeEncontrada = cidades.find(c =>
        (c.label as string).toLowerCase() === label.toLowerCase()
      );
      if (cidadeEncontrada) {
        form.setFieldValue('cidade', cidadeEncontrada.value);
      } else {
        message.info(`Cidade "${label}" não encontrada no cadastro — selecione manualmente`);
      }
    } catch {
      message.error('Erro ao consultar ViaCEP');
    } finally {
      setCepLoading(false);
    }
  };

  useEffect(() => { carregar(); carregarCidades(); }, []);

  const abrirModal = async (item?: Cliente) => {
    if (item) {
      const r = await api.get(`/clientes/${item.id}`);
      const d = r.data;
      form.setFieldsValue({ ...d, datnas: d.datnas ? dayjs(d.datnas) : null });
      setEditando(d);
    } else {
      form.resetFields();
      form.setFieldsValue({ ativox: 'S', blocli: 'Não', adm: 'N' });
      setEditando(null);
    }
    setModalOpen(true);
  };

  const salvar = async (values: any) => {
    const payload = { ...values, datnas: values.datnas ? values.datnas.format('YYYY-MM-DD') : null };
    try {
      if (editando) await api.put(`/clientes/${editando.id}`, payload);
      else await api.post('/clientes', payload);
      message.success('Salvo com sucesso');
      setModalOpen(false);
      carregar(busca);
    } catch { message.error('Erro ao salvar'); }
  };

  const deletar = async (id: number) => {
    try { await api.delete(`/clientes/${id}`); message.success('Excluído'); carregar(busca); }
    catch { message.error('Erro ao excluir'); }
  };

  const colunas = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Nome', dataIndex: 'nomexx', ellipsis: true },
    { title: 'CPF/CNPJ', width: 160, render: (_: any, r: Cliente) => r.cpfxxx || r.cnpjxx },
    { title: 'E-mail', dataIndex: 'emailx', ellipsis: true },
    { title: 'Celular', dataIndex: 'celu1', width: 140 },
    { title: 'Ativo', dataIndex: 'ativox', width: 80, render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag> },
    { title: 'ADM', dataIndex: 'adm', width: 70, render: (v: string) => v === 'S' ? <Tag color="blue">Sim</Tag> : '—' },
    {
      title: 'Ações', width: 100,
      render: (_: any, r: Cliente) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabPessoal = (
    <Row gutter={12}>
      <Col span={12}><Form.Item name="nomexx" label="Nome" rules={[{ required: true }]}><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="cpfxxx" label="CPF"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="cnpjxx" label="CNPJ"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="rgxxxx" label="RG"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="datnas" label="Data Nasc."><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
      <Col span={6}><Form.Item name="estciv" label="Estado Civil"><Select options={ESTADO_CIVIL} allowClear /></Form.Item></Col>
      <Col span={6}><Form.Item name="emailx" label="E-mail"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="email2" label="E-mail 2"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="profiss" label="Profissão"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="empres" label="Empresa"><Input /></Form.Item></Col>
      <Col span={12}><Form.Item name="rendax" label="Renda"><Input /></Form.Item></Col>
    </Row>
  );

  const tabEndereco = (
    <Row gutter={12}>
      <Col span={6}>
        <Form.Item name="cepxxx" label="CEP">
          <Input.Search
            placeholder="00000-000"
            maxLength={9}
            enterButton={<AimOutlined />}
            loading={cepLoading}
            onSearch={buscarCep}
          />
        </Form.Item>
      </Col>
      <Col span={12}><Form.Item name="endere" label="Endereço"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="comple" label="Complemento"><Input /></Form.Item></Col>
      <Col span={8}><Form.Item name="bairro" label="Bairro"><Input /></Form.Item></Col>
      <Col span={16}>
        <Form.Item name="cidade" label="Cidade">
          <Select showSearch options={cidades} filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())} />
        </Form.Item>
      </Col>
    </Row>
  );

  const tabContatos = (
    <Row gutter={12}>
      <Col span={8}><Form.Item name="telres" label="Tel. Residencial"><Input /></Form.Item></Col>
      <Col span={8}><Form.Item name="telcom" label="Tel. Comercial"><Input /></Form.Item></Col>
      <Col span={8}><Form.Item name="celu1" label="Celular 1"><Input /></Form.Item></Col>
      <Col span={8}><Form.Item name="celu2" label="Celular 2"><Input /></Form.Item></Col>
      <Divider plain>Referências</Divider>
      <Col span={14}><Form.Item name="refer1" label="Referência 1"><Input /></Form.Item></Col>
      <Col span={10}><Form.Item name="telrefere1" label="Telefone"><Input /></Form.Item></Col>
      <Col span={14}><Form.Item name="refer2" label="Referência 2"><Input /></Form.Item></Col>
      <Col span={10}><Form.Item name="telrefere2" label="Telefone"><Input /></Form.Item></Col>
    </Row>
  );

  const tabBancario = (
    <Row gutter={12}>
      <Divider plain>Conta 1</Divider>
      <Col span={8}><Form.Item name="bancox" label="Banco"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="agenci" label="Agência"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="contax" label="Conta"><Input /></Form.Item></Col>
      <Col span={4}><Form.Item name="pix" label="PIX"><Input /></Form.Item></Col>
      <Divider plain>Conta 2</Divider>
      <Col span={8}><Form.Item name="banco1" label="Banco"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="agencia1" label="Agência"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="conta1" label="Conta"><Input /></Form.Item></Col>
      <Col span={4}><Form.Item name="pix1" label="PIX"><Input /></Form.Item></Col>
    </Row>
  );

  const tabSistema = (
    <Row gutter={12}>
      <Col span={6}><Form.Item name="ativox" label="Ativo"><Select options={SN} /></Form.Item></Col>
      <Col span={6}><Form.Item name="blocli" label="Bloqueado"><Select options={[{ value: 'Não', label: 'Não' }, { value: 'Sim', label: 'Sim' }]} /></Form.Item></Col>
      <Col span={6}><Form.Item name="adm" label="Administrador"><Select options={SN} /></Form.Item></Col>
      <Col span={6}><Form.Item name="acessoApp" label="Acesso App"><Select options={ACESSO} allowClear /></Form.Item></Col>
      <Col span={6}><Form.Item name="limcre" label="Limite de Crédito"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="classificacao" label="Classificação"><Input type="number" /></Form.Item></Col>
      <Col span={12}><Form.Item name="senhax" label={editando ? 'Senha (deixe em branco para manter)' : 'Senha'}><Input.Password /></Form.Item></Col>
      <Col span={24}><Form.Item name="obsxxx" label="Observações"><Input.TextArea rows={3} /></Form.Item></Col>
    </Row>
  );

  return (
    <>
      <Title level={4}>Clientes</Title>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col style={{ width: 140 }}>
          <Select value={filtroCampo} onChange={setFiltroCampo} options={FILTROS} style={{ width: '100%' }} />
        </Col>
        <Col flex="auto">
          <Input.Search placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
            onSearch={() => carregar(busca)} enterButton={<SearchOutlined />} allowClear onClear={() => carregar('')} />
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}>Novo Cliente</Button>
        </Col>
      </Row>
      <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
        pagination={{ pageSize: 15, showTotal: t => `${t} registros` }} size="small" scroll={{ x: 900 }} />

      <Modal title={editando ? `Editar Cliente — ${editando.nomexx}` : 'Novo Cliente'}
        open={modalOpen} onOk={form.submit} onCancel={() => setModalOpen(false)}
        destroyOnClose width={820}>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Tabs items={[
            { key: '1', label: 'Dados Pessoais', children: tabPessoal },
            { key: '2', label: 'Endereço', children: tabEndereco },
            { key: '3', label: 'Contatos', children: tabContatos },
            { key: '4', label: 'Bancário', children: tabBancario },
            { key: '5', label: 'Sistema', children: tabSistema },
          ]} />
        </Form>
      </Modal>
    </>
  );
}
