import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';

export default function PrivateRoute() {
  const { isAuthenticated, carregando } = useAuth();
  const { banco } = useBanco();

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={`/${banco}/login`} replace />;
}
