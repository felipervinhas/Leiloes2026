import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';

export default function PrivateRoute() {
  const { isAuthenticated } = useAuth();
  const { banco } = useBanco();
  return isAuthenticated ? <Outlet /> : <Navigate to={`/${banco}/login`} replace />;
}
