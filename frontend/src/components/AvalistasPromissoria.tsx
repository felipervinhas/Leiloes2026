import React, { useState } from 'react';
import { Alert, Button, Input, Space, Typography } from 'antd';
import { CheckCircleOutlined, EditOutlined } from '@ant-design/icons';
import type { Avalista } from '../relatorios/RelatorioFaturaCompra';

const { Text } = Typography;

interface Props {
  /** Chamado com os avalistas confirmados, ou null quando o usuário volta a editar. */
  onConfirmar: (avalistas: Avalista[] | null) => void;
}

const vazio = (): Avalista => ({ nome: '', documento: '', endereco: '' });

/**
 * Formulário de avalistas exigido antes de gerar a promissória quando o leilão
 * está marcado como "Avalista obrigatório". Avalista 1 é obrigatório (nome e
 * CPF/CNPJ); o 2 é opcional. O PDF só é montado depois de confirmar — assim não
 * é regerado a cada tecla digitada.
 */
export default function AvalistasPromissoria({ onConfirmar }: Props) {
  const [avalistas, setAvalistas] = useState<Avalista[]>([vazio(), vazio()]);
  const [confirmado, setConfirmado] = useState(false);

  const alterar = (i: number, campo: keyof Avalista, valor: string) =>
    setAvalistas(prev => prev.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));

  const primeiroCompleto = !!avalistas[0].nome.trim() && !!(avalistas[0].documento || '').trim();

  const confirmar = () => {
    const preenchidos = avalistas
      .map(a => ({ nome: a.nome.trim(), documento: (a.documento || '').trim(), endereco: (a.endereco || '').trim() }))
      .filter(a => a.nome);
    setConfirmado(true);
    onConfirmar(preenchidos);
  };

  if (confirmado) {
    return (
      <div style={{ marginBottom: 16, textAlign: 'left' }}>
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message={`Avalista${avalistas.filter(a => a.nome.trim()).length > 1 ? 's' : ''}: ${avalistas.filter(a => a.nome.trim()).map(a => a.nome.trim()).join(' e ')}`}
          action={
            <Button size="small" icon={<EditOutlined />} onClick={() => { setConfirmado(false); onConfirmar(null); }}>
              Alterar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16, textAlign: 'left' }}>
      <Alert type="warning" showIcon style={{ marginBottom: 12 }}
        message="Este leilão exige avalista. Informe o avalista antes de gerar a promissória." />
      {avalistas.map((a, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <Text strong>{i === 0 ? 'Avalista 1 *' : 'Avalista 2 (opcional)'}</Text>
          <Space direction="vertical" style={{ width: '100%', marginTop: 4 }} size={6}>
            <Input placeholder="Nome" value={a.nome} onChange={e => alterar(i, 'nome', e.target.value)} />
            <Input placeholder="CPF / CNPJ" value={a.documento} onChange={e => alterar(i, 'documento', e.target.value)} />
            <Input placeholder="Endereço (opcional)" value={a.endereco} onChange={e => alterar(i, 'endereco', e.target.value)} />
          </Space>
        </div>
      ))}
      <Button type="primary" block disabled={!primeiroCompleto} onClick={confirmar}>
        Confirmar avalista
      </Button>
    </div>
  );
}
