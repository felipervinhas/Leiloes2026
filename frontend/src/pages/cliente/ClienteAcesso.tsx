import React, { useEffect, useRef, useState } from 'react';
import { Button, Spin, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';
import portalApi, { CHAVE_CLIENTE_PORTAL, CHAVE_TOKEN_PORTAL } from '../../services/portalApi';
import './portal.css';

/**
 * Entrada pelo link exclusivo que a leiloeira envia (/:banco/cliente/acesso/:token): o cliente só
 * confirma os 4 primeiros dígitos do CPF/CNPJ. O aparelho fica lembrado por 30 dias.
 */
export default function ClienteAcesso() {
  const { token = '' } = useParams();
  const { banco } = useBanco();
  const config = useConfig();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<'CPF' | 'CNPJ' | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [digitos, setDigitos] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    portalApi.get(`/link/${encodeURIComponent(token)}`)
      .then(r => { setTipo(r.data.tipo); setTimeout(() => campo.current?.focus(), 50); })
      .catch(e => setProblema(e.response?.data?.error || 'Não foi possível abrir este link.'));
  }, [token]);

  const confirmar = async (valor = digitos) => {
    if (valor.length !== 4 || enviando) return;
    setEnviando(true);
    try {
      const r = await portalApi.post('/link/confirmar', { token, digitos: valor });
      localStorage.setItem(CHAVE_TOKEN_PORTAL, r.data.token);
      localStorage.setItem(CHAVE_CLIENTE_PORTAL, JSON.stringify(r.data.cliente));
      navigate(`/${banco}/cliente/recebimentos`, { replace: true });
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Não foi possível confirmar';
      if (e.response?.status === 423 || e.response?.status === 404) setProblema(msg);
      else message.error(msg);
      setDigitos('');
      campo.current?.focus();
    } finally { setEnviando(false); }
  };

  return (
    <div className="pc pc-login">
      <section className="pc-login-arte">
        <div className="pc-marca">
          {config.logoBase64 && <img src={config.logoBase64} alt="" />}
          <span style={{ opacity: .85 }}>{config.empresa}</span>
        </div>
        <div>
          <h2>Suas parcelas,<br />sempre à mão.</h2>
          <p>A leiloeira cobra as parcelas para você. Aqui você acompanha o que entra em cada mês, o que já foi pago e o que está em atraso.</p>
        </div>
        <small style={{ opacity: .5 }}>Painel do cliente</small>
      </section>
      <section className="pc-login-form">
        <div className="pc-login-caixa">
          {problema ? (
            <>
              <h3>Link indisponível</h3>
              <p style={{ color: 'var(--pc-suave)' }}>{problema}</p>
            </>
          ) : !tipo ? <Spin /> : (
            <>
              <h3>Confirme que é você</h3>
              <p style={{ color: 'var(--pc-suave)', marginTop: 0 }}>
                Digite os <b>4 primeiros dígitos do seu {tipo}</b>. Só no primeiro acesso deste aparelho.
              </p>
              <div className="pc-digitos" onClick={() => campo.current?.focus()}>
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className={`pc-digito${digitos.length === i ? ' atual' : ''}`}>{digitos[i] || ''}</span>
                ))}
                <input ref={campo} className="pc-digitos-campo" inputMode="numeric" autoComplete="off" maxLength={4} value={digitos}
                  aria-label={`4 primeiros dígitos do ${tipo}`}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setDigitos(v);
                    if (v.length === 4) confirmar(v);
                  }} />
              </div>
              <Button type="primary" size="large" block loading={enviando} disabled={digitos.length !== 4} onClick={() => confirmar()}>
                Entrar
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
