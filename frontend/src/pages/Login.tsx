import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBanco } from '../context/BancoContext';
import { useConfig } from '../context/ConfigContext';
import { loginApi } from '../services/authService';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { banco } = useBanco();
  const config = useConfig();
  const navigate = useNavigate();

  async function handleLogin(values: { cpf: string; senha: string }) {
    setLoading(true);
    try {
      const { token, usuario } = await loginApi(values.cpf, values.senha);
      login(token, usuario);
      navigate(`/${banco}/dashboard`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Usuário ou senha inválidos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: config.corMenuBottom || '#003333',
    }}>
      <Card style={{ width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.25)', borderRadius: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          {config.logoUrl ? (
            <img src={config.logoUrl} alt={config.empresa}
              style={{ maxHeight: 90, maxWidth: 300, objectFit: 'contain', marginBottom: 10 }} />
          ) : (
            <Title level={3} style={{ marginBottom: 4, textAlign: 'center' }}>{config.empresa || 'Leilões 2026'}</Title>
          )}
          <Text type="secondary">Sistema Administrativo</Text>
        </div>

        <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
          <Form.Item name="cpf" rules={[{ required: true, message: 'Informe o CPF' }]}>
            <Input prefix={<UserOutlined />} placeholder="CPF" size="large" />
          </Form.Item>
          <Form.Item name="senha" rules={[{ required: true, message: 'Informe a senha' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Senha" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Entrar
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
