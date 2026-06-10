import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Space, ConfigProvider, Tabs, Drawer, Button, Grid } from 'antd';
import {
  DashboardOutlined, TeamOutlined, ShoppingOutlined, CalendarOutlined,
  UserOutlined, LogoutOutlined, EnvironmentOutlined, BranchesOutlined,
  CreditCardOutlined, SafetyOutlined, SettingOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, TrophyOutlined, BellOutlined, LineChartOutlined,
  DollarOutlined, WalletOutlined, FileSearchOutlined, OrderedListOutlined,
  FileTextOutlined, MenuOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';

const { Header, Sider, Content } = Layout;

// ─── Design tokens ───────────────────────────────────────────────────────────
const SIDER_BG     = '#0f172a';
const ACCENT       = '#1677ff';
const ACCENT_MED   = '#1d4ed8';
const HEADER_FROM  = '#1677ff';
const HEADER_TO    = '#0ea5e9';
const SHELL_BG     = '#f1f5f9';

const ALL_MENU_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard', controle: undefined },
  {
    key: 'leiloes-group', icon: <CalendarOutlined />, label: 'Leilões', controle: 'Leilões',
    children: [
      { key: '/leiloes', label: 'Leilões', controle: 'Leilões' },
      { key: '/lotes', icon: <ShoppingOutlined />, label: 'Lotes', controle: 'Lotes' },
      { key: '/lances', icon: <TrophyOutlined />, label: 'Lances', controle: 'Lançes' },
      { key: '/ordem-entrada', icon: <OrderedListOutlined />, label: 'Ordem de Entrada', controle: undefined },
    ],
  },
  {
    key: 'comercial-group', icon: <DollarOutlined />, label: 'Comercial', controle: 'Vendas',
    children: [
      { key: '/vendas', icon: <DollarOutlined />, label: 'Vendas', controle: 'Vendas' },
      { key: '/consulta-vendas', icon: <FileSearchOutlined />, label: 'Consulta Vendas', controle: 'Consulta Vendas' },
      { key: '/contratos', icon: <FileTextOutlined />, label: 'Contratos', controle: undefined },
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
  '/dashboard':           { label: 'Dashboard',       icon: <DashboardOutlined /> },
  '/leiloes':             { label: 'Leilões',          icon: <CalendarOutlined /> },
  '/lotes':               { label: 'Lotes',            icon: <ShoppingOutlined /> },
  '/lances':              { label: 'Lances',           icon: <TrophyOutlined /> },
  '/ordem-entrada':       { label: 'Ordem de Entrada', icon: <OrderedListOutlined /> },
  '/vendas':              { label: 'Vendas',           icon: <DollarOutlined /> },
  '/consulta-vendas':     { label: 'Consulta Vendas',  icon: <FileSearchOutlined /> },
  '/contratos':           { label: 'Contratos',        icon: <FileTextOutlined /> },
  '/cotacoes':            { label: 'Cotações',         icon: <LineChartOutlined /> },
  '/despesas':            { label: 'Despesas',         icon: <WalletOutlined /> },
  '/clientes':            { label: 'Clientes',         icon: <TeamOutlined /> },
  '/notificacoes':        { label: 'Notificações',     icon: <BellOutlined /> },
  '/cidades':             { label: 'Cidades',          icon: <EnvironmentOutlined /> },
  '/racas':               { label: 'Raças',            icon: <BranchesOutlined /> },
  '/condicoes-pagamento': { label: 'Cond. Pagto.',     icon: <CreditCardOutlined /> },
  '/perfis':              { label: 'Perfis',           icon: <SafetyOutlined /> },
  '/usuarios':            { label: 'Usuários',         icon: <UserOutlined /> },
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
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();
  const { usuario, logout } = useAuth();
  const { banco } = useBanco();
  const config    = useConfig();

  const controles: string[] = usuario?.controles ?? [];
  const menuItems = filtrarMenu(ALL_MENU_ITEMS, controles);

  const relativePath = '/' + location.pathname.split('/').slice(2).join('/');
  const selectedKey  = relativePath || '/dashboard';
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
    if (isMobile) setDrawerOpen(false);
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

  const menuContent = (
    <>
      {/* ── Logo / cabeçalho do sider ── */}
      <div style={{
        minHeight: collapsed && !isMobile ? 76 : 92,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_MED} 100%)`,
        padding: collapsed && !isMobile ? '12px 8px' : '14px 16px',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: `0 10px 28px rgba(22,119,255,0.30)`,
        margin: isMobile ? 0 : 10,
        borderRadius: isMobile ? 0 : 14,
      }}>
        <div style={{
          width: collapsed && !isMobile ? 44 : '100%',
          height: collapsed && !isMobile ? 44 : 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
          padding: collapsed && !isMobile ? 6 : '6px 10px',
        }}>
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={config.empresa}
              style={{
                maxHeight: collapsed && !isMobile ? 32 : 42,
                maxWidth: collapsed && !isMobile ? 32 : 168,
                objectFit: 'contain',
              }}
            />
          ) : (
            <span style={{
              color: SIDER_BG,
              fontWeight: 800,
              fontSize: collapsed && !isMobile ? 17 : 16,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {collapsed && !isMobile ? 'ML' : config.empresa || 'Leilões 2026'}
            </span>
          )}
        </div>
        {(!collapsed || isMobile) && (
          <span style={{
            color: 'rgba(255,255,255,0.90)',
            fontWeight: 700,
            fontSize: 11,
            lineHeight: 1,
            marginTop: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Sistema Administrativo
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
        style={{ background: 'transparent', padding: isMobile ? '10px 8px' : '4px 10px 10px', flex: 1, overflowY: 'auto' }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: SHELL_BG }}>
      <style>{`
        /* ── Sider ── */
        .leiloes-sider {
          box-shadow: 4px 0 24px rgba(0,0,0,0.25);
          z-index: 2;
        }
        .leiloes-sider .ant-menu-item,
        .leiloes-sider .ant-menu-submenu-title {
          border-left: 3px solid transparent;
          border-radius: 10px !important;
          margin: 2px 0 !important;
          width: 100% !important;
          height: 42px !important;
          line-height: 42px !important;
          transition: background 0.16s ease, transform 0.16s ease;
        }
        .leiloes-sider .ant-menu-item:hover,
        .leiloes-sider .ant-menu-submenu-title:hover {
          background: rgba(255,255,255,0.08) !important;
          transform: translateX(2px);
        }
        .leiloes-sider .ant-menu-item-selected {
          border-left: 3px solid ${ACCENT} !important;
          background: rgba(22,119,255,0.18) !important;
          border-radius: 10px !important;
        }
        .leiloes-sider .ant-menu-item-selected .ant-menu-title-content,
        .leiloes-sider .ant-menu-item-selected .anticon {
          color: ${ACCENT} !important;
          font-weight: 600;
        }
        .leiloes-sider .ant-menu-sub .ant-menu-item-selected {
          border-left: 3px solid ${ACCENT} !important;
          background: rgba(22,119,255,0.18) !important;
        }
        .leiloes-sider .ant-menu {
          border-inline-end: none !important;
        }
        .leiloes-sider .ant-layout-sider-trigger {
          background: rgba(255,255,255,0.06) !important;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .leiloes-sider .ant-menu-sub {
          background: rgba(0,0,0,0.20) !important;
          border-radius: 10px;
          margin: 0 0 4px;
          padding: 4px;
        }
        /* ── Tabs ── */
        .sistema-tabs .ant-tabs-nav {
          margin-bottom: 0 !important;
        }
        .sistema-tabs .ant-tabs-tab {
          font-size: 12px !important;
          padding: 6px 12px !important;
          border-radius: 8px 8px 0 0 !important;
          border-color: #dde4f5 !important;
          background: rgba(255,255,255,0.65) !important;
          color: #64748b !important;
        }
        .sistema-tabs .ant-tabs-tab-active {
          background: #ffffff !important;
          box-shadow: 0 -2px 8px rgba(22,119,255,0.10);
        }
        .sistema-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: ${HEADER_FROM} !important;
          font-weight: 600;
        }
        .sistema-tabs .ant-tabs-nav::before {
          border-color: #dde4f5 !important;
        }
        /* ── Drawer menu (mobile) ── */
        .menu-drawer .ant-drawer-body {
          padding: 0 !important;
          background: ${SIDER_BG} !important;
          display: flex;
          flex-direction: column;
        }
        .menu-drawer .ant-drawer-header {
          display: none !important;
        }
        .menu-drawer .ant-menu {
          border-inline-end: none !important;
        }
        .menu-drawer .ant-menu-item,
        .menu-drawer .ant-menu-submenu-title {
          border-left: 3px solid transparent;
          border-radius: 10px !important;
          margin: 2px 0 !important;
          width: 100% !important;
          height: 42px !important;
          line-height: 42px !important;
        }
        .menu-drawer .ant-menu-item-selected {
          border-left: 3px solid ${ACCENT} !important;
          background: rgba(22,119,255,0.18) !important;
          border-radius: 10px !important;
        }
        .menu-drawer .ant-menu-item-selected .ant-menu-title-content,
        .menu-drawer .ant-menu-item-selected .anticon {
          color: ${ACCENT} !important;
        }
        .menu-drawer .ant-menu-sub .ant-menu-item-selected {
          border-left: 3px solid ${ACCENT} !important;
          background: rgba(22,119,255,0.18) !important;
        }
        .menu-drawer .ant-menu-sub {
          background: rgba(0,0,0,0.20) !important;
          border-radius: 10px;
          margin: 0 0 4px;
          padding: 4px;
        }
        /* ── User trigger ── */
        .layout-user-trigger:hover {
          background: rgba(255,255,255,0.28) !important;
        }
      `}</style>

      {/* Menu mobile: Drawer */}
      {isMobile && (
        <Drawer
          className="menu-drawer"
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={260}
          styles={{ body: { padding: 0, background: SIDER_BG } }}
          closeIcon={null}
        >
          {menuContent}
        </Drawer>
      )}

      {/* Menu desktop: Sider fixo */}
      {!isMobile && (
        <ConfigProvider theme={{
          components: {
            Menu: {
              darkItemBg: SIDER_BG,
              darkSubMenuItemBg: 'rgba(0,0,0,0.22)',
              darkItemHoverBg: 'rgba(255,255,255,0.08)',
              darkItemSelectedBg: 'transparent',
              darkItemColor: 'rgba(255,255,255,0.68)',
              darkItemHoverColor: '#ffffff',
              darkItemSelectedColor: ACCENT,
            },
          },
        }}>
          <Sider
            className="leiloes-sider"
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            width={238}
            style={{ background: SIDER_BG }}
            trigger={
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </div>
            }
          >
            {menuContent}
          </Sider>
        </ConfigProvider>
      )}

      <Layout style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: SHELL_BG }}>
        {/* ── Header ── */}
        <Header style={{
          padding: isMobile ? '0 12px' : '0 24px',
          background: `linear-gradient(135deg, ${HEADER_FROM} 0%, ${HEADER_TO} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: isMobile ? 56 : 62,
          lineHeight: isMobile ? '56px' : '62px',
          boxShadow: `0 4px 20px rgba(22,119,255,0.30)`,
          flexShrink: 0,
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setDrawerOpen(true)}
              style={{
                color: '#fff', padding: '0 8px', height: 38, flexShrink: 0,
                borderRadius: 8, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
              }}
            />
          )}

          <span style={{
            fontWeight: 700,
            fontSize: isMobile ? 15 : 18,
            color: '#ffffff',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 8px rgba(0,0,0,0.15)',
            letterSpacing: 0.2,
          }}>
            {isMobile
              ? (ROUTE_MAP[activeTabKey]?.label || config.empresa || 'Sistema')
              : (config.empresa || 'Sistema Administrativo')
            }
          </span>

          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <Space
              className="layout-user-trigger"
              style={{
                cursor: 'pointer',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.30)',
                borderRadius: 999,
                padding: isMobile ? '4px' : '4px 12px 4px 4px',
                lineHeight: 1,
                transition: 'background 0.16s ease',
              }}
              size={8}
            >
              <Avatar
                size={30}
                icon={<UserOutlined />}
                style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
              />
              {!isMobile && (
                <span style={{ fontWeight: 600, fontSize: 13, color: '#ffffff' }}>
                  {usuario?.nome}
                </span>
              )}
            </Space>
          </Dropdown>
        </Header>

        {/* ── Barra de abas (desktop only) ── */}
        {!isMobile && (
          <div style={{
            background: '#f0f4ff',
            borderBottom: '1px solid #dde4f5',
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
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
        )}

        {/* ── Content ── */}
        <Content style={{
          margin: isMobile ? 8 : 16,
          padding: isMobile ? 12 : 20,
          background: '#ffffff',
          borderRadius: isMobile ? 10 : 14,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          border: '1px solid #e8eef5',
          boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
