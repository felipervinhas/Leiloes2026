import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';
import portalApi, { CHAVE_CLIENTE_PORTAL, CHAVE_TOKEN_PORTAL } from '../../services/portalApi';
import './portal.css';

/** Login do painel do cliente: CPF/CNPJ ou e-mail e a mesma senha do app e do site. */
export default function ClienteLogin() {
  const [loading, setLoading] = useState(false);
  const { banco } = useBanco();
  const config = useConfig();
  const navigate = useNavigate();

  async function entrar(v: { login: string; senha: string }) {
    setLoading(true);
    try {
      const r = await portalApi.post('/login', v);
      localStorage.setItem(CHAVE_TOKEN_PORTAL, r.data.token);
      localStorage.setItem(CHAVE_CLIENTE_PORTAL, JSON.stringify(r.data.cliente));
      navigate(`/${banco}/cliente/recebimentos`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Não foi possível entrar');
    } finally { setLoading(false); }
  }

  return (
    <div className="pc pc-login">
      <section className="pc-login-arte">
        <div className="pc-marca">
          {config.logoBase64 && <img src={config.logoBase64} alt="" />}
          <span style={{ opacity: .85 }}>{config.empresa}</span>
        </div>
        <div>
          <h2>Suas vendas e compras,<br />parcela por parcela.</h2>
          <p>Acompanhe o que você tem a receber e a pagar nos leilões, quando vence cada parcela e o que já foi pago.</p>
          <div className="pc-login-itens">
            <div><i>↓</i>O que entra em cada mês</div>
            <div><i>◷</i>Agenda dos próximos vencimentos</div>
            <div><i>%</i>Fechamento mensal da cobrança</div>
          </div>
        </div>
        <small style={{ opacity: .5 }}>Painel do cliente</small>
      </section>
      <section className="pc-login-form">
        <div className="pc-login-caixa">
          <h3>Entrar</h3>
          <p style={{ color: 'var(--pc-suave)', marginTop: 0, marginBottom: 24 }}>Use o CPF, CNPJ ou e-mail e a mesma senha do aplicativo e do site da leiloeira.</p>
          <Form layout="vertical" onFinish={entrar} autoComplete="off" requiredMark={false}>
            <Form.Item name="login" rules={[{ required: true, message: 'Informe o CPF, CNPJ ou e-mail' }]}>
              <Input prefix={<UserOutlined />} placeholder="CPF, CNPJ ou e-mail" size="large" />
            </Form.Item>
            <Form.Item name="senha" rules={[{ required: true, message: 'Informe a senha' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Senha" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>Entrar</Button>
          </Form>
          <p style={{ color: 'var(--pc-suave)', fontSize: 13, marginTop: 20 }}>Sem acesso ou esqueceu a senha? Fale com a leiloeira.</p>
        </div>
      </section>
    </div>
  );
}
