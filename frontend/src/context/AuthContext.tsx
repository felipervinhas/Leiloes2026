import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Usuario } from '../types/auth';

interface AuthContextData {
  usuario: Usuario | null;
  token: string | null;
  login: (token: string, usuario: Usuario) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('@leiloes:token');
    const storedUsuario = localStorage.getItem('@leiloes:usuario');
    if (storedToken && storedUsuario) {
      setToken(storedToken);
      setUsuario(JSON.parse(storedUsuario));
    }
  }, []);

  function login(newToken: string, newUsuario: Usuario) {
    localStorage.setItem('@leiloes:token', newToken);
    localStorage.setItem('@leiloes:usuario', JSON.stringify(newUsuario));
    setToken(newToken);
    setUsuario(newUsuario);
  }

  function logout() {
    localStorage.removeItem('@leiloes:token');
    localStorage.removeItem('@leiloes:usuario');
    // banco permanece no localStorage — gerenciado pela URL via BancoContext
    setToken(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
