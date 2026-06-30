import React, { useEffect, useState } from 'react';
import {
  Button, Card, Col, Drawer, Form, Input, message,
  Popconfirm, Row, Select, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, FileTextOutlined,
  PlusOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import ContratoEditor from '../components/ContratoEditor';

const { Title, Text, Paragraph } = Typography;

const TIPOS = [
  { value: 'equinos',   label: 'Equinos' },
  { value: 'bovinos',   label: 'Bovinos' },
  { value: 'ovinos',    label: 'Ovinos' },
  { value: 'suinos',    label: 'Suínos' },
  { value: 'particular',label: 'Particular' },
  { value: 'outros',    label: 'Outros' },
];

const TEMPLATE_INICIAL = `<h2 style="text-align:center">CONTRATO DE COMPRA E VENDA</h2>

<p>Pelo presente instrumento particular, de um lado, como <strong>VENDEDOR</strong>, <strong>%NOMVEN%</strong>, CPF/CNPJ: %CPFVEN%, residente e domiciliado em %ENDVEN%, %MUNVEN% - %ESTVEN%; e de outro, como <strong>COMPRADOR</strong>, <strong>%NOMCOM%</strong>, CPF/CNPJ: %CPFCOM%, residente e domiciliado em %ENDCOM%, %MUNCOM% - %ESTCOM%.</p>

<p>As partes identificadas e qualificadas acima têm entre si justo e contratado o seguinte:</p>

<h3>1. OBJETO</h3>
<p>O presente contrato tem por objeto a compra e venda do seguinte animal: <strong>%DESLOT%</strong>, Lote %LOTEXX%, raça %RACACOM%, do leilão <strong>%LEILAO%</strong>.</p>

<h3>2. VALOR E PAGAMENTO</h3>
<p>O valor total da transação é de <strong>%VLRTOT%</strong>. O pagamento será realizado conforme: %DESFIN%.</p>
<p>Parcela inicial: %PARCELAINICIAL%<br>
Primeiro vencimento: %PRIMEIRO_VENCIMENTO_DATA% no valor de %PRIMEIRO_VENCIMENTO_VALOR%<br>
Saldo final: %SALDOFINAL%</p>

<h3>3. DISPOSIÇÕES GERAIS</h3>
<p>As partes elegem o foro da Comarca de %CIDLEI% - %ESTLEI% para dirimir eventuais dúvidas ou litígios oriundos deste contrato.</p>
<p>E por estarem assim justos e contratados, assinam o presente instrumento em 02 (duas) vias de igual teor e forma.</p>

<p style="text-align:center"><br>%CIDLEI% - %ESTLEI%, %DIA% de %MESEXTENSO% de %ANO%</p>

<br><br>
<p style="text-align:center">______________________________<br><strong>%NOMVEN%</strong><br>Vendedor</p>
<br>
<p style="text-align:center">______________________________<br><strong>%NOMCOM%</strong><br>Comprador</p>`;

export default function Contratos() {
  const [templates, setTemplates]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editando, setEditando]         = useState<any | null>(null);
  const [conteudo, setConteudo]         = useState('');
  const [varDrawer, setVarDrawer]       = useState(false);
  const [variaveis, setVariaveis]       = useState<any[]>([]);
  const [saving, setSaving]             = useState(false);
  const [form] = Form.useForm();

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/contratos/templates');
      setTemplates(r.data);
    } finally { setLoading(false); }
  };

  const carregarVariaveis = async () => {
    const r = await api.get('/contratos/variaveis');
    setVariaveis(r.data);
    setVarDrawer(true);
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    setConteudo(TEMPLATE_INICIAL);
    setDrawerOpen(true);
  };

  const abrirEditar = async (id: number) => {
    const r = await api.get(`/contratos/templates/${id}`);
    const t = r.data;
    setEditando(t);
    form.setFieldsValue({ nome: t.nome, tipo: t.tipo });
    setConteudo(t.conteudo);
    setDrawerOpen(true);
  };

  const salvar = async () => {
    const vals = await form.validateFields();
    if (!conteudo.trim()) { message.warning('O conteúdo não pode estar vazio'); return; }
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/contratos/templates/${editando.id}`, { ...vals, conteudo });
        message.success('Template atualizado');
      } else {
        await api.post('/contratos/templates', { ...vals, conteudo });
        message.success('Template criado');
      }
      setDrawerOpen(false);
      carregar();
    } finally { setSaving(false); }
  };

  const deletar = async (id: number) => {
    await api.delete(`/contratos/templates/${id}`);
    message.success('Template excluído');
    carregar();
  };

  const corTipo: Record<string, string> = {
    equinos: 'blue', bovinos: 'brown', ovinos: 'green',
    suinos: 'pink', particular: 'purple', outros: 'default',
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Modelos de Contrato
        </Title>
        <Space>
          <Button icon={<QuestionCircleOutlined />} onClick={carregarVariaveis}>
            Variáveis disponíveis
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirNovo}>
            Novo modelo
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {templates.length === 0 && !loading ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>Nenhum modelo cadastrado.</div>
              <Button type="primary" style={{ marginTop: 12 }} onClick={abrirNovo}>
                Criar primeiro modelo
              </Button>
            </div>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {templates.map(t => (
              <Col key={t.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  hoverable
                  actions={[
                    <Tooltip key="edit" title="Editar">
                      <Button type="text" icon={<EditOutlined />} onClick={() => abrirEditar(t.id)} />
                    </Tooltip>,
                    <Popconfirm
                      key="del"
                      title="Excluir este modelo?"
                      onConfirm={() => deletar(t.id)}
                      okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text strong style={{ fontSize: 14 }}>{t.nome}</Text>
                    {t.tipo && (
                      <Tag color={corTipo[t.tipo] || 'default'} style={{ textTransform: 'capitalize' }}>
                        {t.tipo}
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>Criado em {t.datcri}</Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Drawer de edição */}
      <Drawer
        title={editando ? `Editar: ${editando.nome}` : 'Novo modelo de contrato'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width="85%"
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button type="primary" loading={saving} onClick={salvar}>
              Salvar
            </Button>
          </Space>
        }
        bodyStyle={{ padding: '16px 24px' }}
      >
        <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item name="nome" label="Nome" rules={[{ required: true }]} style={{ flex: 1, minWidth: 200 }}>
            <Input placeholder="Ex: Contrato Equinos Leilão" />
          </Form.Item>
          <Form.Item name="tipo" label="Tipo">
            <Select placeholder="Tipo" allowClear style={{ width: 150 }} options={TIPOS} />
          </Form.Item>
          <Button size="small" type="link" icon={<QuestionCircleOutlined />} onClick={carregarVariaveis}>
            Ver variáveis
          </Button>
        </Form>

        <ContratoEditor content={conteudo} onChange={setConteudo} />
      </Drawer>

      {/* Drawer de variáveis */}
      <Drawer
        title="Variáveis disponíveis"
        open={varDrawer}
        onClose={() => setVarDrawer(false)}
        width={360}
      >
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          Use <code>%VARIAVEL%</code> no texto do contrato. Ao gerar o contrato, elas serão
          substituídas pelos dados reais.
        </Paragraph>
        {variaveis.map((g: any) => (
          <div key={g.grupo} style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6, color: '#555' }}>{g.grupo}</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.vars.map((v: string) => (
                <Tag
                  key={v}
                  style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                  onClick={() => { navigator.clipboard.writeText(`%${v}%`); message.success(`%${v}% copiado!`); }}
                >
                  %{v}%
                </Tag>
              ))}
            </div>
          </div>
        ))}
        <Paragraph type="secondary" style={{ fontSize: 11, marginTop: 16 }}>
          Clique em uma variável para copiar.
        </Paragraph>
      </Drawer>
    </>
  );
}
