import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Result, Spin, Tabs, Typography } from 'antd';
import { WhatsAppOutlined } from '@ant-design/icons';
import api from '../../services/api';
import Campanhas from './Campanhas';
import Conversas from './Conversas';
import Descadastrados from './Descadastrados';
import ConfigWhatsapp from './ConfigWhatsapp';

const { Title } = Typography;

interface Status { ativo: boolean; configurado: boolean; acesso: boolean; admin: boolean; naoLidas: number }

export default function WhatsApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState('campanhas');

  const carregarStatus = useCallback(async () => {
    try { setStatus((await api.get('/whatsapp/status')).data); }
    catch (e: any) { setErro(e?.response?.data?.error || 'Não foi possível carregar o módulo de WhatsApp'); }
  }, []);

  useEffect(() => { carregarStatus(); }, [carregarStatus]);

  if (erro) return <Alert type="error" message={erro} showIcon />;
  if (!status) return <Spin style={{ display: 'block', margin: 48 }} />;

  if (!status.ativo) {
    return (
      <Result
        icon={<WhatsAppOutlined style={{ color: '#25D366' }} />}
        title="Envio por WhatsApp não contratado"
        subTitle="Fale com o suporte para ativar o envio de campanhas e avisos pelo WhatsApp oficial (API da Meta)."
      />
    );
  }
  if (!status.acesso) {
    return <Result status="403" title="Sem acesso" subTitle="Seu usuário não tem o controle WhatsApp liberado." />;
  }

  const itens = [
    { key: 'campanhas', label: 'Campanhas', children: <Campanhas configurado={status.configurado} /> },
    {
      key: 'conversas',
      label: <Badge count={status.naoLidas} size="small" offset={[8, 0]}>Respostas</Badge>,
      children: <Conversas aoLer={carregarStatus} />,
    },
    { key: 'descadastrados', label: 'Descadastrados', children: <Descadastrados /> },
    ...(status.admin ? [{ key: 'config', label: 'Configuração', children: <ConfigWhatsapp aoSalvar={carregarStatus} /> }] : []),
  ];

  return (
    <>
      <Title level={4}><WhatsAppOutlined style={{ marginRight: 8, color: '#25D366' }} />WhatsApp</Title>
      {!status.configurado && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="WhatsApp ainda não configurado"
          description={status.admin
            ? 'Preencha as credenciais da Meta na aba Configuração antes de criar campanhas.'
            : 'Peça a um administrador para preencher as credenciais da Meta.'}
        />
      )}
      <Tabs activeKey={aba} onChange={setAba} items={itens} destroyOnHidden />
    </>
  );
}
