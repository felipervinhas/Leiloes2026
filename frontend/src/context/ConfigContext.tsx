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
  /** Logotipo em data URI (base64), pronto para embutir em PDFs (@react-pdf/renderer). */
  logoBase64: string | null;
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
  logoBase64: null,
};

const ConfigContext = createContext<Configuracoes>(defaultConfig);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { banco } = useBanco();
  const [config, setConfig] = useState<Configuracoes>(defaultConfig);

  useEffect(() => {
    if (!banco) return;
    api.get('/configuracoes')
      .then(r => setConfig(cfg => ({ ...cfg, ...r.data })))
      .catch(() => {});
    api.get('/configuracoes/logo')
      .then(r => setConfig(cfg => ({ ...cfg, logoBase64: r.data?.logo ?? null })))
      .catch(() => {});
  }, [banco]);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
