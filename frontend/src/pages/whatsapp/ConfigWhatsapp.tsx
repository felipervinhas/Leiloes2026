import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Form, Input, InputNumber, Row, Space, Typography, message } from 'antd';
import { ApiOutlined, CopyOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { erroApi } from './tipos';

const { Text, Paragraph } = Typography;

export default function ConfigWhatsapp({ aoSalvar }: { aoSalvar?: () => void }) {
  const { banco } = useBanco();
  const [form] = Form.useForm();
  const [cfg, setCfg] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<any>(null);

  const carregar = async () => {
    const r = await api.get('/whatsapp/config');
    setCfg(r.data);
    form.setFieldsValue({ ...r.data, token: '', appSecret: '' });
  };

  useEffect(() => { carregar().catch(e => message.error(erroApi(e, 'Erro ao carregar configuração'))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async (v: any) => {
    setSalvando(true);
    try {
      const r = await api.put('/whatsapp/config', v);
      setCfg(r.data);
      form.setFieldsValue({ ...r.data, token: '', appSecret: '' });
      message.success('Configuração salva');
      aoSalvar?.();
    } catch (e) { message.error(erroApi(e, 'Erro ao salvar')); }
    finally { setSalvando(false); }
  };

  const testar = async () => {
    setTestando(true); setTeste(null);
    try { setTeste((await api.post('/whatsapp/config/testar')).data); }
    catch (e) { message.error(erroApi(e, 'Falha ao conectar na Meta')); }
    finally { setTestando(false); }
  };

  const apiBase = (api.defaults.baseURL || '').replace(/\/$/, '');
  const webhookUrl = `${apiBase.startsWith('http') ? apiBase : window.location.origin + apiBase}/${banco}/whatsapp/webhook`;
  const copiar = (t: string) => { navigator.clipboard.writeText(t); message.success('Copiado'); };

  return (
    <Row gutter={16}>
      <Col xs={24} lg={14}>
        <Card title="Credenciais da Meta (WhatsApp Cloud API)" size="small">
          <Form form={form} layout="vertical" onFinish={salvar}>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="phoneNumberId" label="Phone Number ID" rules={[{ required: true, message: 'Obrigatório' }]}
                  tooltip="WhatsApp Manager → Configuração da API → Identificação do número de telefone">
                  <Input placeholder="1447913981739218" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="wabaId" label="WhatsApp Business Account ID" rules={[{ required: true, message: 'Obrigatório' }]}
                  tooltip="Identificação da conta do WhatsApp Business — usado para listar os templates">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="token" label={`Token de acesso ${cfg?.temToken ? `(atual: ${cfg.tokenMascarado})` : ''}`}
              extra="Use um token permanente de Usuário do Sistema (Business Manager → Usuários do sistema). Deixe em branco para manter o atual."
              rules={cfg?.temToken ? [] : [{ required: true, message: 'Obrigatório' }]}>
              <Input.Password autoComplete="new-password" placeholder={cfg?.temToken ? 'manter o atual' : 'EAA...'} />
            </Form.Item>
            <Form.Item name="appSecret" label={`App Secret ${cfg?.temAppSecret ? `(atual: ${cfg.appSecretMascarado})` : ''}`}
              extra="App → Configurações → Básico → Chave secreta do aplicativo. Usado para validar que o webhook veio mesmo da Meta.">
              <Input.Password autoComplete="new-password" placeholder={cfg?.temAppSecret ? 'manter o atual' : ''} />
            </Form.Item>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="limiteDiario" label="Limite diário de contatos"
                  tooltip="O nível do seu número na Meta (250, 2.000, 10.000...). A fila nunca passa disso em 24h.">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="msgsPorMinuto" label="Mensagens por minuto">
                  <InputNumber min={1} max={600} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="apiVersion" label="Versão da API">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="precoMarketing" label="Preço por mensagem — Marketing (R$)">
                  <InputNumber min={0} step={0.01} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="precoUtilidade" label="Preço por mensagem — Utilidade (R$)">
                  <InputNumber min={0} step={0.01} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="msgOptout" label="Resposta automática ao descadastro (SAIR)">
              <Input.TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
            <Form.Item name="verifyToken" label="Token de verificação do webhook"
              extra="Gerado automaticamente se ficar em branco. Copie para o app da Meta junto com a URL do webhook.">
              <Input />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={salvando}>Salvar</Button>
              <Button icon={<ApiOutlined />} onClick={testar} loading={testando} disabled={!cfg?.temToken}>Testar conexão</Button>
            </Space>
          </Form>
          {teste && (
            <Descriptions size="small" column={1} bordered style={{ marginTop: 16 }}>
              <Descriptions.Item label="Número">{teste.display_phone_number}</Descriptions.Item>
              <Descriptions.Item label="Nome verificado">{teste.verified_name}</Descriptions.Item>
              <Descriptions.Item label="Qualidade">{teste.quality_rating}</Descriptions.Item>
              <Descriptions.Item label="Nível de limite">{teste.messaging_limit_tier || '—'}</Descriptions.Item>
              <Descriptions.Item label="Templates na conta">
                {teste.templates ?? <Text type="danger">não foi possível listar — confira o WABA ID</Text>}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card title="Webhook (respostas e status de entrega)" size="small">
          <Paragraph>No app da Meta → WhatsApp → Configuração → Webhook, informe:</Paragraph>
          <Paragraph strong style={{ marginBottom: 4 }}>URL de callback</Paragraph>
          <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
            <Input value={webhookUrl} readOnly />
            <Button icon={<CopyOutlined />} onClick={() => copiar(webhookUrl)} />
          </Space.Compact>
          <Paragraph strong style={{ marginBottom: 4 }}>Token de verificação</Paragraph>
          <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
            <Input value={cfg?.verifyToken || '(salve a configuração para gerar)'} readOnly />
            <Button icon={<CopyOutlined />} disabled={!cfg?.verifyToken} onClick={() => copiar(cfg.verifyToken)} />
          </Space.Compact>
          <Paragraph>Depois, assine o campo <Text code>messages</Text> nos campos do webhook.</Paragraph>
          <Alert type="info" showIcon message="Sem o webhook, as campanhas são enviadas normalmente, mas a tela não mostra entregues/lidas, não recebe respostas e não processa o SAIR." />
        </Card>
      </Col>
    </Row>
  );
}
