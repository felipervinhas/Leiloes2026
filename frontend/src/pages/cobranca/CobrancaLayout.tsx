import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Result, Spin, Typography, Space } from 'antd';
import {
  DashboardOutlined, UnorderedListOutlined, TagsOutlined, CalendarOutlined, SettingOutlined, LogoutOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const MENU = [
  { key: 'painel',        icon: <DashboardOutlined />,     label: 'Painel' },
  { key: 'parcelas',      icon: <UnorderedListOutlined />, label: 'Parcelas' },
  { key: 'lotes',         icon: <TagsOutlined />,          label: 'Lotes em cobrança' },
  { key: 'fechamento',    icon: <CalendarOutlined />,      label: 'Fechamento mensal' },
  { key: 'configuracoes', icon: <SettingOutlined />,       label: 'Configurações' },
];

type Status = { ativa: boolean; taxaPadrao: number; acesso: boolean };

/**
 * Área Cobrança (/:banco/cobranca) — intermediação de cobrança das parcelas do vendedor,
 * contratada à parte. Confere com a API o plano da empresa e o controle do usuário.
 */
export default function CobrancaLayout() {
  const { usuario, logout } = useAuth();
  const { banco } = useBanco();
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get('/cobranca/status').then(r => setStatus(r.data)).catch(() => setErro(true));
  }, [banco]);

  const sair = () => { logout(); navigate(`/${banco}/cobranca/login`); };
  const atual = location.pathname.split('/cobranca/')[1]?.split('/')[0] || 'painel';

  if (erro) {
    return <Result status="error" title="Não foi possível abrir a Cobrança" subTitle="Tente de novo em instantes."
      extra={<Button onClick={() => window.location.reload()}>Tentar de novo</Button>} />;
  }
  if (!status) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
  }
  if (!status.ativa || !status.acesso) {
    return (
      <Result
        status={!status.ativa ? 'info' : '403'}
        title={!status.ativa ? 'Intermediação de cobrança não contratada' : 'Sem acesso à Cobrança'}
        subTitle={!status.ativa
          ? 'Este módulo é contratado à parte. Fale com o suporte para ativá-lo para a sua empresa.'
          : 'Peça a um administrador para liberar o controle "Intermediação de Cobrança" no seu usuário.'}
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
          <div style={{ fontWeight: 700, fontSize: 16 }}>Cobrança</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Intermediação de cobrança</div>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[atual]} items={MENU}
          onClick={e => navigate(`/${banco}/cobranca/${e.key}`)} />
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
          <Outlet context={status} />
        </Content>
      </Layout>
    </Layout>
  );
}
