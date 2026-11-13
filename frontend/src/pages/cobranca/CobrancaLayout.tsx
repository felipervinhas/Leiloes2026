import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, ConfigProvider, Result, Spin, Space } from 'antd';
import {
  AppstoreOutlined, UnorderedListOutlined, TagsOutlined, CalendarOutlined, SettingOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';
import './cobranca.css';

const MENU = [
  { grupo: 'Acompanhar', itens: [
    { key: 'painel', icon: <AppstoreOutlined />, label: 'Painel' },
    { key: 'parcelas', icon: <UnorderedListOutlined />, label: 'Parcelas' },
  ] },
  { grupo: 'Operar', itens: [
    { key: 'lotes', icon: <TagsOutlined />, label: 'Lotes em cobrança' },
    { key: 'fechamento', icon: <CalendarOutlined />, label: 'Fechamento mensal' },
  ] },
  { grupo: 'Ajustes', itens: [
    { key: 'configuracoes', icon: <SettingOutlined />, label: 'Configurações' },
  ] },
];

/** Tema do antd só dentro da área: mesma paleta e fonte do painel do cliente. */
const TEMA = {
  token: {
    colorPrimary: '#155446', colorLink: '#155446', colorSuccess: '#2f9e6e', colorError: '#d64545', colorWarning: '#c9a227',
    borderRadius: 10, fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    colorBgLayout: '#f5f3ec', colorBorder: '#e2ddcf', colorBorderSecondary: '#efebe1',
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: 'none', defaultShadow: 'none' },
    Table: { headerBg: '#faf8f2', rowHoverBg: '#fbfaf5', borderColor: '#f1eee5' },
    Modal: { borderRadiusLG: 18 },
    Drawer: { borderRadiusLG: 18 },
  },
};

type Status = { ativa: boolean; taxaPadrao: number; acesso: boolean };

const iniciais = (nome?: string) => (nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/**
 * Área Cobrança (/:banco/cobranca) — intermediação de cobrança das parcelas do vendedor,
 * contratada à parte. Confere com a API o plano da empresa e o controle do usuário.
 */
export default function CobrancaLayout() {
  const { usuario, logout } = useAuth();
  const { banco } = useBanco();
  const config = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get('/cobranca/status').then(r => setStatus(r.data)).catch(() => setErro(true));
  }, [banco]);

  const sair = () => { logout(); navigate(`/${banco}/cobranca/login`); };
  const atual = location.pathname.split('/cobranca/')[1]?.split('/')[0] || 'painel';

  if (erro) {
    return <Result status="error" title="Não foi possível abrir a Cobrança" subTitle="Tente de novo em instantes."
      extra={<Button onClick={() => window.location.reload()}>Tentar de novo</Button>} />;
  }
  if (!status) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
  }
  if (!status.ativa || !status.acesso) {
    return (
      <Result
        status={!status.ativa ? 'info' : '403'}
        title={!status.ativa ? 'Intermediação de cobrança não contratada' : 'Sem acesso à Cobrança'}
        subTitle={!status.ativa
          ? 'Este módulo é contratado à parte. Fale com o suporte para ativá-lo para a sua empresa.'
          : 'Peça a um administrador para liberar o controle "Intermediação de Cobrança" no seu usuário.'}
        extra={<Space>
          <Button onClick={() => navigate(`/${banco}/dashboard`)}>Ir para o sistema de leilões</Button>
          <Button onClick={sair}>Sair</Button>
        </Space>}
      />
    );
  }

  return (
    <ConfigProvider theme={TEMA}>
      <div className="cb">
        <aside className="cb-menu">
          <div className="cb-menu-marca">
            {config.logoBase64 && <img src={config.logoBase64} alt="" />}
            <div><b>Cobrança</b><span>{config.empresa}</span></div>
          </div>
          {MENU.map(g => (
            <React.Fragment key={g.grupo}>
              <div className="cb-menu-rotulo">{g.grupo}</div>
              {g.itens.map(i => (
                <button key={i.key} className={`cb-menu-item${atual === i.key ? ' ativo' : ''}`} onClick={() => navigate(`/${banco}/cobranca/${i.key}`)}>
                  {i.icon}{i.label}
                </button>
              ))}
            </React.Fragment>
          ))}
          <div className="cb-menu-rodape">
            <span className="cb-avatar">{iniciais(usuario?.nome)}</span>
            <div>
              <b>{usuario?.nome}</b>
              <button onClick={sair}>Sair</button>
            </div>
          </div>
        </aside>
        <main className="cb-conteudo">
          <Outlet context={status} />
        </main>
      </div>
    </ConfigProvider>
  );
}
