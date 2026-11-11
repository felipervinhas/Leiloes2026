import axios from 'axios';

// Cliente HTTP do painel do cliente (/:banco/cliente). Token e dados em chaves próprias:
// entrar no painel não derruba nem reaproveita a sessão do sistema administrativo.
export const CHAVE_TOKEN_PORTAL = '@leiloes:portal:token';
export const CHAVE_CLIENTE_PORTAL = '@leiloes:portal:cliente';

const portalApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8500/api',
  timeout: 60000,
});

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(CHAVE_TOKEN_PORTAL);
  // o banco vem da própria URL (/:banco/cliente/...): no 1º acesso pelo link, num aparelho novo,
  // a tela chama a API antes de o BancoProvider gravar o banco no localStorage
  const banco = window.location.pathname.split('/')[1] || localStorage.getItem('@leiloes:banco');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (banco && config.url && !config.url.startsWith('http')) {
    const url = config.url.startsWith('/') ? config.url : `/${config.url}`;
    config.url = `/${banco}/portal${url}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  (r) => r,
  (error) => {
    // login e link respondem 401 de propósito (senha/dígitos errados): mostram a mensagem, não redirecionam
    const ehLogin = /\/portal\/(login|link)/.test(error.config?.url || '');
    if (error.response?.status === 401 && !ehLogin) {
      localStorage.removeItem(CHAVE_TOKEN_PORTAL);
      localStorage.removeItem(CHAVE_CLIENTE_PORTAL);
      const banco = window.location.pathname.split('/')[1] || localStorage.getItem('@leiloes:banco');
      window.location.href = banco ? `/${banco}/cliente/login` : '/';
    }
    return Promise.reject(error);
  }
);

export default portalApi;
