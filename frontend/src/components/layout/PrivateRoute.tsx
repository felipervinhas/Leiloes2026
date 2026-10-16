import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';

/** loginPath: tela de login para onde volta sem sessão, relativa ao banco (o Financeiro tem a sua). */
export default function PrivateRoute({ loginPath = 'login' }: { loginPath?: string }) {
  const { isAuthenticated, carregando } = useAuth();
  const { banco } = useBanco();

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={`/${banco}/${loginPath}`} replace />;
}
