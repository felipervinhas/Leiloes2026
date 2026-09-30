import React, { useState } from 'react';
import { Button, Card, Image, Space, Typography, Upload, message } from 'antd';
import { SettingOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import api from '../services/api';
import { useConfig } from '../context/ConfigContext';

const { Title, Text, Paragraph } = Typography;

const TAMANHO_MAX = 2 * 1024 * 1024;

/** Configurações do cliente (tenant). Por enquanto: troca do logotipo guardado no bucket S3. */
export default function Configuracoes() {
  const config = useConfig();
  const [enviando, setEnviando] = useState(false);

  const uploadProps: UploadProps = {
    accept: 'image/png,image/jpeg',
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        message.error('Envie uma imagem PNG ou JPG');
        return false;
      }
      if (file.size > TAMANHO_MAX) {
        message.error('A imagem deve ter no máximo 2 MB');
        return false;
      }
      setEnviando(true);
      try {
        const form = new FormData();
        form.append('file', file);
        await api.post('/configuracoes/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        message.success('Logotipo atualizado');
        config.recarregar?.();
      } catch (err: any) {
        message.error(err?.response?.data?.error || 'Erro ao enviar o logotipo');
      } finally {
        setEnviando(false);
      }
      return false;
    },
  };

  return (
    <>
      <Title level={4} style={{ marginTop: 0, marginBottom: 20 }}>
        <SettingOutlined style={{ marginRight: 8 }} />
        Configurações
      </Title>

      <Card title="Logotipo" style={{ maxWidth: 560 }}>
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          Aparece no menu, na tela de login e nos relatórios em PDF (faturas, promissórias,
          Ordem de Entrada…). Use PNG ou JPG de até 2 MB — de preferência PNG com fundo transparente.
          O logotipo anterior fica guardado como cópia de segurança.
        </Paragraph>

        <div style={{
          border: '1px dashed #d9d9d9', borderRadius: 8, padding: 16, marginBottom: 16,
          background: '#fafafa', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120,
        }}>
          {config.logoBase64 ? (
            <Image src={config.logoBase64} alt={config.empresa} style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain' }} />
          ) : (
            <Text type="secondary">Nenhum logotipo carregado</Text>
          )}
        </div>

        <Space>
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadOutlined />} loading={enviando}>
              Trocar logotipo
            </Button>
          </Upload>
        </Space>
      </Card>
    </>
  );
}
