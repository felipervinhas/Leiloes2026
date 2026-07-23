import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Typography,
  Tag, message, Image, Upload, Row, Col, Descriptions,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Chamado {
  id: number;
  tipo: 'Erro' | 'Melhoria';
  titulo: string;
  descricao: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído' | 'Recusado';
  nomeUsuario?: string;
  imagemUrl?: string;
  resposta?: string;
  datcri: string;
  datresp?: string;
}

const CORES_STATUS: Record<Chamado['status'], string> = {
  'Pendente': 'gold',
  'Em Andamento': 'blue',
  'Concluído': 'green',
  'Recusado': 'red',
};

const CORES_TIPO: Record<Chamado['tipo'], string> = {
  'Erro': 'red',
  'Melhoria': 'blue',
};

export default function Chamados() {
  const [dados, setDados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string | undefined>();

  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const [detalhe, setDetalhe] = useState<Chamado | null>(null);
  const [formStatus] = Form.useForm();
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  const carregar = async (b = busca, s = statusFiltro) => {
    setLoading(true);
    try {
      const r = await api.get('/chamados', { params: { busca: b || undefined, status: s || undefined } });
      setDados(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirModalNovo = () => {
    form.resetFields();
    setFileList([]);
    setModalNovoOpen(true);
  };

  const salvarNovo = async (values: any) => {
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('tipo', values.tipo);
      fd.append('titulo', values.titulo);
      fd.append('descricao', values.descricao);
      if (fileList[0]?.originFileObj) fd.append('imagem', fileList[0].originFileObj);
      await api.post('/chamados', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      message.success('Chamado aberto com sucesso');
      setModalNovoOpen(false);
      carregar();
    } catch {
      message.error('Erro ao abrir chamado');
    } finally {
      setSalvando(false);
    }
  };

  const abrirDetalhe = async (item: Chamado) => {
    const r = await api.get(`/chamados/${item.id}`);
    setDetalhe(r.data);
  };

  const salvarStatus = async (values: any) => {
    if (!detalhe) return;
    setAtualizandoStatus(true);
    try {
      await api.patch(`/chamados/${detalhe.id}/status`, values);
      message.success('Chamado atualizado');
      setDetalhe(null);
      carregar();
    } catch {
      message.error('Erro ao atualizar chamado');
    } finally {
      setAtualizandoStatus(false);
    }
  };

  const deletar = async (id: number) => {
    try {
      await api.delete(`/chamados/${id}`);
      message.success('Excluído');
      carregar();
    } catch {
      message.error('Erro ao excluir');
    }
  };

  const colunas = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: 'Tipo', dataIndex: 'tipo', width: 110,
      render: (v: Chamado['tipo']) => <Tag color={CORES_TIPO[v]}>{v}</Tag>,
    },
    { title: 'Título', dataIndex: 'titulo' },
    { title: 'Aberto por', dataIndex: 'nomeUsuario', width: 180 },
    {
      title: 'Data', dataIndex: 'datcri', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('pt-BR') : '',
    },
    {
      title: 'Status', dataIndex: 'status', width: 150,
      render: (v: Chamado['status']) => <Tag color={CORES_STATUS[v]}>{v}</Tag>,
    },
    {
      title: 'Ações', width: 140,
      render: (_: any, r: Chamado) => (
        <Space>
          <Button size="small" onClick={() => abrirDetalhe(r)}>Ver / Gerenciar</Button>
          <Popconfirm title="Confirma exclusão?" onConfirm={() => deletar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={3} style={{ margin: 0 }}>Chamados</Title></Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirModalNovo}>
            Abrir Chamado
          </Button>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Buscar por título ou descrição..."
          allowClear
          style={{ width: 320 }}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onSearch={(v) => carregar(v, statusFiltro)}
        />
        <Select
          placeholder="Status"
          allowClear
          style={{ width: 180 }}
          value={statusFiltro}
          onChange={(v) => { setStatusFiltro(v); carregar(busca, v); }}
          options={[
            { value: 'Pendente', label: 'Pendente' },
            { value: 'Em Andamento', label: 'Em Andamento' },
            { value: 'Concluído', label: 'Concluído' },
            { value: 'Recusado', label: 'Recusado' },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={dados}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Abrir Chamado"
        open={modalNovoOpen}
        onCancel={() => setModalNovoOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvando}
        okText="Enviar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={salvarNovo}>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true, message: 'Selecione o tipo' }]} initialValue="Erro">
            <Select options={[{ value: 'Erro', label: 'Erro' }, { value: 'Melhoria', label: 'Melhoria' }]} />
          </Form.Item>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Informe um título' }]}>
            <Input maxLength={200} placeholder="Resumo do problema ou sugestão" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Descreva o chamado' }]}>
            <TextArea rows={4} placeholder="Descreva com detalhes o que aconteceu ou o que gostaria de melhorar" />
          </Form.Item>
          <Form.Item label="Print da tela (opcional)">
            <Upload
              accept="image/*"
              listType="picture"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
            >
              <Button icon={<UploadOutlined />}>Anexar print</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detalhe ? `Chamado #${detalhe.id} — ${detalhe.titulo}` : ''}
        open={!!detalhe}
        onCancel={() => setDetalhe(null)}
        onOk={() => formStatus.submit()}
        confirmLoading={atualizandoStatus}
        okText="Salvar"
        cancelText="Fechar"
        width={640}
      >
        {detalhe && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Tipo"><Tag color={CORES_TIPO[detalhe.tipo]}>{detalhe.tipo}</Tag></Descriptions.Item>
              <Descriptions.Item label="Aberto por">{detalhe.nomeUsuario || '-'}</Descriptions.Item>
              <Descriptions.Item label="Data" span={2}>{new Date(detalhe.datcri).toLocaleString('pt-BR')}</Descriptions.Item>
              <Descriptions.Item label="Descrição" span={2}>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{detalhe.descricao}</Text>
              </Descriptions.Item>
            </Descriptions>

            {detalhe.imagemUrl && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Print anexado</Text>
                <div>
                  <Image src={detalhe.imagemUrl} alt="Print do chamado" style={{ maxHeight: 240 }} />
                </div>
              </div>
            )}

            <Form
              key={detalhe.id}
              form={formStatus}
              preserve={false}
              layout="vertical"
              onFinish={salvarStatus}
              initialValues={{ status: detalhe.status, resposta: detalhe.resposta }}
            >
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'Pendente', label: 'Pendente' },
                  { value: 'Em Andamento', label: 'Em Andamento' },
                  { value: 'Concluído', label: 'Concluído' },
                  { value: 'Recusado', label: 'Recusado' },
                ]} />
              </Form.Item>
              <Form.Item name="resposta" label="Resposta / observação">
                <TextArea rows={3} placeholder="Observações sobre o andamento ou resolução" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}
