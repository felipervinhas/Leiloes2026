import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useBanco } from './BancoContext';
import logotipoMacedo from '../assets/LogotipoMacedoLeiloes.png';
import logotipoKnorr from '../assets/LogotipoKnorrLeiloes.png';
import logotipoAgenda from '../assets/LogotipoAgendaRemates.png';

// Fallback local usado quando o banco do tenant ainda não tem um Logotipo configurado
// (ou o cadastro em Configuracoes/S3 falha) — evita cair no logo genérico da Macedo
// para tenants que já têm identidade visual própria.
const LOGOS_POR_BANCO: Record<string, string> = {
  knorr: logotipoKnorr,
  agendaremates: logotipoAgenda,
};

function logoFallbackPorBanco(banco: string): string {
  return LOGOS_POR_BANCO[banco.toLowerCase()] || logotipoMacedo;
}

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
      .then(r => setConfig(cfg => ({ ...cfg, ...r.data, logoUrl: r.data?.logoUrl || logoFallbackPorBanco(banco) })))
      .catch(() => setConfig(cfg => ({ ...cfg, logoUrl: logoFallbackPorBanco(banco) })));
    api.get('/configuracoes/logo')
      .then(r => setConfig(cfg => ({ ...cfg, logoBase64: r.data?.logo ?? logoFallbackPorBanco(banco) })))
      .catch(() => setConfig(cfg => ({ ...cfg, logoBase64: logoFallbackPorBanco(banco) })));
  }, [banco]);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
