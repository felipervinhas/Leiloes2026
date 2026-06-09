import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Space, ConfigProvider, Tabs } from 'antd';
import {
  DashboardOutlined, TeamOutlined, ShoppingOutlined, CalendarOutlined,
  UserOutlined, LogoutOutlined, EnvironmentOutlined, BranchesOutlined,
  CreditCardOutlined, SafetyOutlined, SettingOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, TrophyOutlined, BellOutlined, LineChartOutlined,
  DollarOutlined, WalletOutlined, FileSearchOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';

const { Header, Sider, Content } = Layout;

const ALL_MENU_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard', controle: undefined },
  {
    key: 'leiloes-group', icon: <CalendarOutlined />, label: 'Leilões', controle: 'Leilões',
    children: [
      { key: '/leiloes', label: 'Leilões', controle: 'Leilões' },
      { key: '/lotes', icon: <ShoppingOutlined />, label: 'Lotes', controle: 'Lotes' },
      { key: '/lances', icon: <TrophyOutlined />, label: 'Lances', controle: 'Lançes' },
    ],
  },
  {
    key: 'comercial-group', icon: <DollarOutlined />, label: 'Comercial', controle: 'Vendas',
    children: [
      { key: '/vendas', icon: <DollarOutlined />, label: 'Vendas', controle: 'Vendas' },
      { key: '/consulta-vendas', icon: <FileSearchOutlined />, label: 'Consulta Vendas', controle: 'Consulta Vendas' },
      { key: '/cotacoes', icon: <LineChartOutlined />, label: 'Cotações', controle: 'Cotações' },
      { key: '/despesas', icon: <WalletOutlined />, label: 'Despesas', controle: undefined },
    ],
  },
  {
    key: 'clientes-group', icon: <TeamOutlined />, label: 'Clientes', controle: 'Clientes',
    children: [
      { key: '/clientes', icon: <TeamOutlined />, label: 'Clientes', controle: 'Clientes' },
      { key: '/notificacoes', icon: <BellOutlined />, label: 'Notificações', controle: 'Notificações' },
    ],
  },
  {
    key: 'cadastros-group', icon: <SettingOutlined />, label: 'Cadastros', controle: undefined,
    children: [
      { key: '/cidades', icon: <EnvironmentOutlined />, label: 'Cidades', controle: 'Cidades' },
      { key: '/racas', icon: <BranchesOutlined />, label: 'Raças', controle: 'Raças' },
      { key: '/condicoes-pagamento', icon: <CreditCardOutlined />, label: 'Condições Pagto.', controle: 'Condições de Pagamento' },
    ],
  },
  {
    key: 'sistema-group', icon: <SafetyOutlined />, label: 'Sistema', controle: 'Clientes',
    children: [
      { key: '/perfis', icon: <SafetyOutlined />, label: 'Perfis', controle: 'Clientes' },
      { key: '/usuarios', icon: <UserOutlined />, label: 'Usuários', controle: 'Clientes' },
    ],
  },
];

const ROUTE_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  '/dashboard': { label: 'Dashboard', icon: <DashboardOutlined /> },
  '/leiloes': { label: 'Leilões', icon: <CalendarOutlined /> },
  '/lotes': { label: 'Lotes', icon: <ShoppingOutlined /> },
  '/lances': { label: 'Lances', icon: <TrophyOutlined /> },
  '/vendas': { label: 'Vendas', icon: <DollarOutlined /> },
  '/consulta-vendas': { label: 'Consulta Vendas', icon: <FileSearchOutlined /> },
  '/cotacoes': { label: 'Cotações', icon: <LineChartOutlined /> },
  '/despesas': { label: 'Despesas', icon: <WalletOutlined /> },
  '/clientes': { label: 'Clientes', icon: <TeamOutlined /> },
  '/notificacoes': { label: 'Notificações', icon: <BellOutlined /> },
  '/cidades': { label: 'Cidades', icon: <EnvironmentOutlined /> },
  '/racas': { label: 'Raças', icon: <BranchesOutlined /> },
  '/condicoes-pagamento': { label: 'Cond. Pagto.', icon: <CreditCardOutlined /> },
  '/perfis': { label: 'Perfis', icon: <SafetyOutlined /> },
  '/usuarios': { label: 'Usuários', icon: <UserOutlined /> },
};

function temAcesso(controle: string | undefined, controles: string[]): boolean {
  if (!controles || controles.length === 0) return true;
  if (controle === undefined) return true;
  return controles.includes(controle);
}

function filtrarMenu(items: any[], controles: string[]): any[] {
  return items
    .map(item => {
      if (item.children) {
        const filhos = filtrarMenu(item.children, controles);
        if (filhos.length === 0) return null;
        const { controle: _c, ...rest } = item;
        return { ...rest, children: filhos };
      }
      if (!temAcesso(item.controle, controles)) return null;
      const { controle: _c, ...rest } = item;
      return rest;
    })
    .filter(Boolean);
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const { banco } = useBanco();
  const config = useConfig();

  const controles: string[] = usuario?.controles ?? [];
  const menuItems = filtrarMenu(ALL_MENU_ITEMS, controles);

  const cor1 = config.corMenuTop || '#FEC824';
  const cor2 = config.corMenuBottom || '#003333';
  const corLetra = config.corLetraTop || '#ffffff';

  const relativePath = '/' + location.pathname.split('/').slice(2).join('/');
  const selectedKey = relativePath || '/dashboard';
  const activeTabKey = ROUTE_MAP[relativePath] ? relativePath : '/dashboard';

  const defaultOpenKeys = ALL_MENU_ITEMS
    .filter(m => (m as any).children?.some((c: any) => c.key === selectedKey))
    .map(m => m.key);

  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    if (!ROUTE_MAP[relativePath] || relativePath === '/dashboard') return ['/dashboard'];
    return ['/dashboard', relativePath];
  });

  useEffect(() => {
    if (ROUTE_MAP[relativePath]) {
      setOpenTabs(prev => prev.includes(relativePath) ? prev : [...prev, relativePath]);
    }
  }, [relativePath]);

  const openTab = (key: string) => {
    setOpenTabs(prev => prev.includes(key) ? prev : [...prev, key]);
    navigate(`/${banco}${key}`);
  };

  const closeTab = (targetKey: string) => {
    if (targetKey === '/dashboard') return;
    const next = openTabs.filter(k => k !== targetKey);
    setOpenTabs(next);
    if (activeTabKey === targetKey) {
      const idx = openTabs.indexOf(targetKey);
      const fallback = next[Math.min(idx, next.length - 1)] ?? '/dashboard';
      navigate(`/${banco}${fallback}`);
    }
  };

  const userMenu = {
    items: [{
      key: 'logout', icon: <LogoutOutlined />, label: 'Sair', danger: true,
      onClick: () => { logout(); navigate(`/${banco}/login`); },
    }],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <style>{`
        .leiloes-sider .ant-menu-item-selected {
          border-left: 3px solid ${cor1} !important;
          background: rgba(255,255,255,0.08) !important;
          border-radius: 0 !important;
        }
        .leiloes-sider .ant-menu-item-selected .ant-menu-title-content,
        .leiloes-sider .ant-menu-item-selected .anticon {
          color: ${cor1} !important;
        }
        .leiloes-sider .ant-menu-item {
          border-left: 3px solid transparent;
          border-radius: 0 !important;
          margin: 0 !important;
          width: 100% !important;
        }
        .leiloes-sider .ant-menu-sub .ant-menu-item-selected {
          border-left: 3px solid ${cor1} !important;
          background: rgba(255,255,255,0.08) !important;
        }
        .leiloes-sider .ant-menu {
          border-inline-end: none !important;
        }
        .leiloes-sider .ant-layout-sider-trigger {
          background: rgba(0,0,0,0.2) !important;
        }
        .sistema-tabs .ant-tabs-nav {
          margin-bottom: 0 !important;
        }
        .sistema-tabs .ant-tabs-tab {
          font-size: 12px !important;
          padding: 6px 10px !important;
        }
      `}</style>

      <ConfigProvider theme={{
        components: {
          Menu: {
            darkItemBg: cor2,
            darkSubMenuItemBg: 'rgba(0,0,0,0.15)',
            darkItemHoverBg: 'rgba(255,255,255,0.05)',
            darkItemSelectedBg: 'transparent',
            darkItemColor: 'rgba(255,255,255,0.75)',
            darkItemHoverColor: '#ffffff',
            darkItemSelectedColor: cor1,
          },
        },
      }}>
        <Sider
          className="leiloes-sider"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={220}
          style={{ background: cor2 }}
          trigger={
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          }
        >
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: cor1,
            padding: collapsed ? '8px 4px' : '8px 16px',
            overflow: 'hidden',
          }}>
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt={config.empresa}
                style={{ maxHeight: 48, maxWidth: collapsed ? 44 : 170, objectFit: 'contain' }}
              />
            ) : (
              <span style={{
                color: corLetra, fontWeight: 700,
                fontSize: collapsed ? 13 : 16,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {collapsed ? '🐄' : config.empresa || 'Leilões 2026'}
              </span>
            )}
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={defaultOpenKeys}
            items={menuItems}
            onClick={({ key }) => openTab(key)}
            style={{ background: cor2, paddingTop: 8 }}
          />
        </Sider>
      </ConfigProvider>

      <Layout style={{ display: 'flex', flexDirection: 'column' }}>
        <Header style={{
          padding: '0 20px',
          background: cor1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          lineHeight: '56px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: corLetra }}>
            {config.empresa || 'Sistema Administrativo'}
          </span>

          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <Space style={{ cursor: 'pointer', color: corLetra }} size={8}>
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{ background: 'rgba(0,0,0,0.2)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 500, fontSize: 14 }}>{usuario?.nome}</span>
            </Space>
          </Dropdown>
        </Header>

        {/* Barra de abas */}
        <div style={{
          background: '#f0f2f5',
          borderBottom: '1px solid #e0e0e0',
          paddingLeft: 12,
          paddingRight: 12,
          flexShrink: 0,
        }}>
          <Tabs
            className="sistema-tabs"
            type="editable-card"
            hideAdd
            size="small"
            activeKey={activeTabKey}
            onChange={(key) => navigate(`/${banco}${key}`)}
            onEdit={(targetKey, action) => action === 'remove' && closeTab(targetKey as string)}
            items={openTabs.map(key => ({
              key,
              label: (
                <Space size={4}>
                  <span style={{ fontSize: 11, lineHeight: 1 }}>{ROUTE_MAP[key]?.icon}</span>
                  <span>{ROUTE_MAP[key]?.label}</span>
                </Space>
              ),
              closable: key !== '/dashboard',
            }))}
          />
        </div>

        <Content style={{
          margin: 16,
          padding: 20,
          background: '#ffffff',
          borderRadius: 8,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
