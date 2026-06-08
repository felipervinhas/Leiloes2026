import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { ConfigProvider as AntConfigProvider, Result } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { AuthProvider } from './context/AuthContext';
import { BancoProvider } from './context/BancoContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import MainLayout from './components/layout/MainLayout';
import PrivateRoute from './components/layout/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cidades from './pages/Cidades';
import Racas from './pages/Racas';
import CondicoesPagamento from './pages/CondicoesPagamento';
import Perfis from './pages/Perfis';
import Usuarios from './pages/Usuarios';
import Clientes from './pages/Clientes';
import Lotes from './pages/Lotes';
import Leiloes from './pages/Leiloes';
import Lances from './pages/Lances';
import Cotacoes from './pages/Cotacoes';
import Notificacoes from './pages/Notificacoes';
import Vendas from './pages/Vendas';
import ConsultaVendas from './pages/ConsultaVendas';
import Despesas from './pages/Despesas';
import { BANCOS_PERMITIDOS } from './config/bancos';

function UrlInvalida() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Result
        status="404"
        title="URL inválida"
        subTitle="Acesse o sistema pelo link fornecido pela sua empresa."
      />
    </div>
  );
}

function ThemedOutlet() {
  const config = useConfig();
  return (
    <AntConfigProvider locale={ptBR} theme={{ token: { colorPrimary: config.corMenuTop } }}>
      <Outlet />
    </AntConfigProvider>
  );
}

function BancoShell() {
  const { banco } = useParams<{ banco: string }>();
  if (!BANCOS_PERMITIDOS.includes(banco!)) return <UrlInvalida />;
  return (
    <BancoProvider banco={banco!}>
      <ConfigProvider>
        <ThemedOutlet />
      </ConfigProvider>
    </BancoProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/:banco" element={<BancoShell />}>
            <Route index element={<Navigate to="login" replace />} />
            <Route path="login" element={<Login />} />
            <Route element={<PrivateRoute />}>
              <Route element={<MainLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="leiloes" element={<Leiloes />} />
                <Route path="lotes" element={<Lotes />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="cidades" element={<Cidades />} />
                <Route path="racas" element={<Racas />} />
                <Route path="condicoes-pagamento" element={<CondicoesPagamento />} />
                <Route path="perfis" element={<Perfis />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="lances" element={<Lances />} />
                <Route path="cotacoes" element={<Cotacoes />} />
                <Route path="notificacoes" element={<Notificacoes />} />
                <Route path="vendas" element={<Vendas />} />
                <Route path="consulta-vendas" element={<ConsultaVendas />} />
                <Route path="despesas" element={<Despesas />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<UrlInvalida />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
