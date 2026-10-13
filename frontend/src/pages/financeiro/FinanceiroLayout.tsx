import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Result, Spin, Typography, Space } from 'antd';
import {
  DashboardOutlined, UploadOutlined, UnorderedListOutlined, BankOutlined, LogoutOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const MENU = [
  { key: 'painel',      icon: <DashboardOutlined />,     label: 'Painel' },
  { key: 'importar',    icon: <UploadOutlined />,        label: 'Importar extrato' },
  { key: 'lancamentos', icon: <UnorderedListOutlined />, label: 'Lançamentos' },
  { key: 'contas',      icon: <BankOutlined />,          label: 'Contas bancárias' },
];

type Status = { ativa: boolean; plano: string | null; acesso: boolean };

/**
 * Área Financeiro (/:banco/financeiro) — conciliação bancária, contratada à parte.
 * Antes de mostrar qualquer tela, confere com a API se a empresa tem o plano e se
 * o usuário tem o controle "Conciliação Bancária" (ou é administrador).
 */
export default function FinanceiroLayout() {
  const { usuario, logout } = useAuth();
  const { banco } = useBanco();
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get('/conciliacao/status').then(r => setStatus(r.data)).catch(() => setErro(true));
  }, [banco]);

  const sair = () => { logout(); navigate(`/${banco}/financeiro/login`); };
  const atual = location.pathname.split('/financeiro/')[1]?.split('/')[0] || 'painel';

  if (erro) {
    return <Result status="error" title="Não foi possível abrir o Financeiro" subTitle="Tente de novo em instantes."
      extra={<Button onClick={() => window.location.reload()}>Tentar de novo</Button>} />;
  }
  if (!status) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
  }
  if (!status.ativa || !status.acesso) {
    return (
      <Result
        status={!status.ativa ? 'info' : '403'}
        title={!status.ativa ? 'Conciliação bancária não contratada' : 'Sem acesso ao Financeiro'}
        subTitle={!status.ativa
          ? 'Este módulo é contratado à parte. Fale com o suporte para ativá-lo para a sua empresa.'
          : 'Peça a um administrador para liberar o controle "Conciliação Bancária" no seu usuário.'}
        extra={<Space>
          <Button onClick={() => navigate(`/${banco}/dashboard`)}>Ir para o sistema de leilões</Button>
          <Button onClick={sair}>Sair</Button>
        </Space>}
      />
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" breakpoint="lg" collapsedWidth={0}>
        <div style={{ padding: '18px 16px', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Financeiro</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Conciliação bancária</div>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[atual]} items={MENU}
          onClick={e => navigate(`/${banco}/financeiro/${e.key}`)} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Text strong>{config.empresa}</Text>
          <Space>
            <Text type="secondary">{usuario?.nome}</Text>
            <Button icon={<LogoutOutlined />} onClick={sair}>Sair</Button>
          </Space>
        </Header>
        <Content style={{ padding: 20 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
