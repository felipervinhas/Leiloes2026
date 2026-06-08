import React, { useState } from 'react';
import { Upload, Button, Image, Popconfirm, Spin, message, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import api from '../services/api';

const { Text } = Typography;

interface Props {
  label: string;
  uploadUrl: string;
  deleteUrl: string;
  initialUrl?: string;
  accept?: string;
}

export default function ImageUpload({ label, uploadUrl, deleteUrl, initialUrl, accept = 'image/*' }: Props) {
  const [url, setUrl] = useState<string | undefined>(initialUrl);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  const uploadProps: UploadProps = {
    accept,
    showUploadList: false,
    beforeUpload: async (file) => {
      setLoading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const r = await api.post(uploadUrl, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUrl(r.data.url + '?t=' + Date.now());
        message.success('Imagem enviada com sucesso');
      } catch {
        message.error('Erro ao enviar imagem');
      } finally {
        setLoading(false);
      }
      return false;
    },
  };

  const deletar = async () => {
    setLoading(true);
    try {
      await api.delete(deleteUrl);
      setUrl(undefined);
      message.success('Imagem removida');
    } catch {
      message.error('Erro ao remover imagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <div style={{
        border: '1px dashed #d9d9d9', borderRadius: 8, padding: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        minHeight: 120, background: '#fafafa', position: 'relative',
      }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', borderRadius: 8, zIndex: 1 }}>
            <Spin />
          </div>
        )}
        {url ? (
          <>
            <Image
              src={url}
              alt={label}
              style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
              preview={{ visible: preview, onVisibleChange: setPreview }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3a0DFQHBZY9BV8iiXBiasXYxvL+5lAAAAAElFTkSuQmCC"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(true)}>Ver</Button>
              <Upload {...uploadProps}>
                <Button size="small" icon={<UploadOutlined />}>Trocar</Button>
              </Upload>
              <Popconfirm title="Remover imagem?" onConfirm={deletar}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          </>
        ) : (
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} loading={loading}>Enviar imagem</Button>
          </Upload>
        )}
      </div>
    </div>
  );
}
