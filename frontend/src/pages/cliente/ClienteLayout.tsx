import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';
import { CHAVE_CLIENTE_PORTAL, CHAVE_TOKEN_PORTAL } from '../../services/portalApi';
import './portal.css';

const ABAS = [
  { key: 'recebimentos', label: 'O que recebo' },
  { key: 'pagamentos', label: 'O que pago' },
  { key: 'taxas', label: 'Taxas' },
];

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
const primeiroNome = (nome?: string) => {
  const n = (nome || '').trim().split(/\s+/)[0] || '';
  return n.charAt(0) + n.slice(1).toLowerCase();
};

/** Painel do cliente (/:banco/cliente): visual próprio (portal.css), sem o layout do sistema. */
export default function ClienteLayout() {
  const { banco } = useBanco();
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem(CHAVE_TOKEN_PORTAL);
  let cliente: { nome?: string } = {};
  try { cliente = JSON.parse(localStorage.getItem(CHAVE_CLIENTE_PORTAL) || '{}'); } catch { /* sem cliente */ }
  if (!token) return <Navigate to={`/${banco}/cliente/login`} replace />;

  const sair = () => {
    localStorage.removeItem(CHAVE_TOKEN_PORTAL);
    localStorage.removeItem(CHAVE_CLIENTE_PORTAL);
    navigate(`/${banco}/cliente/login`);
  };
  const atual = location.pathname.split('/cliente/')[1]?.split('/')[0] || 'recebimentos';
  // empresa (CNPJ) não tem "primeiro nome": mostra o nome inteiro
  const ehEmpresa = /\b(LTDA|S\/A|SA|ME|EIRELI|AGRO|AGROPECU)/i.test(cliente.nome || '');

  return (
    <div className="pc">
      <header className="pc-topo">
        <div className="pc-topo-int">
          <div className="pc-barra">
            <div className="pc-marca">
              {config.logoBase64 && <img src={config.logoBase64} alt="" />}
              <span>{config.empresa}</span>
            </div>
            <button className="pc-sair" onClick={sair}>Sair</button>
          </div>
          <div className="pc-ola">
            <small>{saudacao()},</small>
            <h1>{ehEmpresa ? cliente.nome : primeiroNome(cliente.nome)}</h1>
          </div>
          <nav className="pc-abas">
            {ABAS.map(a => (
              <button key={a.key} className={`pc-aba${atual === a.key ? ' ativa' : ''}`}
                onClick={() => navigate(`/${banco}/cliente/${a.key}`)}>{a.label}</button>
            ))}
          </nav>
        </div>
      </header>
      <main className="pc-corpo">
        <Outlet />
      </main>
    </div>
  );
}
