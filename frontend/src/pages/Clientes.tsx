import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, Space, Popconfirm,
  Typography, Row, Col, message, Tag, Tabs, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, AimOutlined,
  CheckCircleFilled, FileTextOutlined, FileExcelOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import { BotaoBaixarPDF, ClienteCompleto } from '../relatorios/RelatorioClientes';
import { exportarClientesExcel } from '../relatorios/exportarExcel';

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<Cliente[]>([]);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [clientesCompletos, setClientesCompletos] = useState<ClienteCompleto[]>([]);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);

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

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[], rows: Cliente[]) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    preserveSelectedRowKeys: true,
  };

  const limparSelecao = () => { setSelectedRowKeys([]); setSelectedRows([]); setClientesCompletos([]); };

  const gerarRelatorio = async () => {
    setCarregandoRelatorio(true);
    try {
      const resultados = await Promise.all(selectedRows.map(r => api.get(`/clientes/${r.id}`)));
      setClientesCompletos(resultados.map(r => r.data as ClienteCompleto));
      setRelatorioOpen(true);
    } catch {
      message.error('Erro ao carregar dados dos clientes');
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  const colunasRelatorio = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Nome', dataIndex: 'nomexx', ellipsis: true },
    { title: 'CPF/CNPJ', width: 160, render: (_: any, r: Cliente) => r.cpfxxx || r.cnpjxx },
    { title: 'E-mail', dataIndex: 'emailx', ellipsis: true },
    { title: 'Celular', dataIndex: 'celu1', width: 140 },
    { title: 'Ativo', dataIndex: 'ativox', width: 70, render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag> },
  ];

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
      <div style={{ paddingBottom: selectedRowKeys.length > 0 ? 64 : 0 }}>
        <Table rowKey="id" columns={colunas} dataSource={dados} loading={loading}
          rowSelection={rowSelection}
          pagination={{ pageSize: 15, showTotal: t => `${t} registros` }} size="small" scroll={{ x: 900 }} />
      </div>

      {selectedRowKeys.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#001529', color: 'white',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 1000, boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
        }}>
          <Space size={10}>
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
            <span style={{ fontSize: 15 }}>
              <strong>{selectedRowKeys.length}</strong> cliente{selectedRowKeys.length !== 1 ? 's' : ''} selecionado{selectedRowKeys.length !== 1 ? 's' : ''}
            </span>
          </Space>
          <Space>
            <Button icon={<CloseOutlined />} onClick={limparSelecao} style={{ borderColor: '#aaa', color: '#fff', background: 'transparent' }}>
              Limpar seleção
            </Button>
            <Button type="primary" icon={<FileTextOutlined />} onClick={gerarRelatorio} loading={carregandoRelatorio}>
              Gerar Relatório
            </Button>
          </Space>
        </div>
      )}

      <Modal
        title={
          <Space>
            <FileTextOutlined />
            {`Relatório de Clientes — ${clientesCompletos.length} selecionado${clientesCompletos.length !== 1 ? 's' : ''}`}
          </Space>
        }
        open={relatorioOpen}
        onCancel={() => setRelatorioOpen(false)}
        width={900}
        footer={[
          <Button key="fechar" onClick={() => setRelatorioOpen(false)}>Fechar</Button>,
          <Button key="excel" icon={<FileExcelOutlined />} style={{ color: '#237804', borderColor: '#237804' }}
            onClick={() => exportarClientesExcel(clientesCompletos)}>
            Exportar Excel
          </Button>,
          <BotaoBaixarPDF key="pdf" clientes={clientesCompletos} />,
        ]}
      >
        <Table
          rowKey="id"
          dataSource={clientesCompletos}
          columns={colunasRelatorio}
          size="small"
          pagination={false}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={6} align="right">
                <strong>Total: {clientesCompletos.length} cliente{clientesCompletos.length !== 1 ? 's' : ''}</strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Modal>

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
