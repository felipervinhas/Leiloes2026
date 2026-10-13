import React, { useEffect, useState } from 'react';
import { Alert, Button, Popconfirm, Space, Spin, Typography, Upload, message } from 'antd';
import { DeleteOutlined, FilePdfOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Text } = Typography;

/**
 * Quinta geração (genealogia) do animal em PDF — o botão "Enviar Quinta Geração"
 * do Delphi. Fica no bucket da empresa como <SBB>.pdf, o mesmo endereço que o site
 * abre na aba "Geração"; por isso depende do SBB salvo e vale para todos os lotes
 * com esse SBB (é o mesmo animal).
 */
export default function QuintaGeracaoUpload({ idLote }: { idLote: number }) {
  const [info, setInfo] = useState<{ sbb: string | null; existe: boolean; url: string | null } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = () => api.get(`/lotes/${idLote}/quinta-geracao`).then(r => setInfo(r.data))
    .catch(() => setInfo({ sbb: null, existe: false, url: null }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [idLote]);

  const enviar = async (arquivo: File) => {
    if (arquivo.type !== 'application/pdf') { message.error('Envie um arquivo PDF'); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('file', arquivo);
      const r = await api.post(`/lotes/${idLote}/quinta-geracao`, fd);
      setInfo(r.data);
      message.success('Quinta geração enviada');
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Erro ao enviar a quinta geração');
    } finally { setEnviando(false); }
  };

  const excluir = async () => {
    try {
      await api.delete(`/lotes/${idLote}/quinta-geracao`);
      setInfo(i => i && { ...i, existe: false, url: null });
      message.success('Quinta geração removida');
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao remover'); }
  };

  if (!info) return <Spin size="small" />;
  if (!info.sbb) {
    return <Alert type="info" showIcon message="Preencha e salve o SBB do lote para enviar a quinta geração."
      description="O PDF é guardado pelo SBB — é por ele que o site encontra a geração do animal." />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        {info.existe && info.url ? (
          <Button icon={<FilePdfOutlined />} href={info.url} target="_blank" rel="noreferrer">Abrir PDF ({info.sbb}.pdf)</Button>
        ) : <Text type="secondary">Nenhum PDF enviado para o SBB {info.sbb}</Text>}
        <Upload accept=".pdf,application/pdf" showUploadList={false} beforeUpload={f => { enviar(f); return false; }} disabled={enviando}>
          <Button icon={<UploadOutlined />} loading={enviando}>{info.existe ? 'Trocar PDF' : 'Enviar Quinta Geração'}</Button>
        </Upload>
        {info.existe && (
          <Popconfirm title="Remover a quinta geração?" description={`Some também dos outros lotes com o SBB ${info.sbb}.`} onConfirm={excluir}>
            <Button danger icon={<DeleteOutlined />}>Remover</Button>
          </Popconfirm>
        )}
      </Space>
      <Text type="secondary" style={{ fontSize: 12 }}>
        O mesmo PDF vale para todos os lotes com o SBB {info.sbb} — é o mesmo animal.
      </Text>
    </Space>
  );
}
