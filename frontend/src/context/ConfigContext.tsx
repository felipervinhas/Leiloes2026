import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useBanco } from './BancoContext';

export interface Configuracoes {
  empresa: string;
  empresaEndereco: string;
  logotipo: string;
  logoUrl: string;
  bucket: string;
  corMenuTop: string;
  corMenuBottom: string;
  corLetraTop: string;
  corLetraBottom: string;
}

const defaultConfig: Configuracoes = {
  empresa: 'Leilões 2026',
  empresaEndereco: '',
  logotipo: '',
  logoUrl: '',
  bucket: '',
  corMenuTop: '#1677ff',
  corMenuBottom: '#001529',
  corLetraTop: '#ffffff',
  corLetraBottom: '#000000',
};

const ConfigContext = createContext<Configuracoes>(defaultConfig);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { banco } = useBanco();
  const [config, setConfig] = useState<Configuracoes>(defaultConfig);

  useEffect(() => {
    if (!banco) return;
    api.get('/configuracoes')
      .then(r => setConfig(r.data))
      .catch(() => {});
  }, [banco]);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
