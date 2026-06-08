import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@leiloes:token');
  const banco = localStorage.getItem('@leiloes:banco');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (banco && config.url && !config.url.startsWith('http')) {
    const url = config.url.startsWith('/') ? config.url : `/${config.url}`;
    if (!url.startsWith(`/${banco}/`)) {
      config.url = `/${banco}${url}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('@leiloes:token');
      localStorage.removeItem('@leiloes:usuario');
      const banco = localStorage.getItem('@leiloes:banco');
      window.location.href = banco ? `/${banco}/login` : '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
