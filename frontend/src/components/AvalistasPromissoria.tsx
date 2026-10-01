import React, { useState } from 'react';
import { Input, Space, Typography } from 'antd';
import type { Avalista } from '../relatorios/RelatorioFaturaCompra';

const { Text } = Typography;

interface Props {
  /** Avalistas preenchidos (só os com nome); lista vazia quando nenhum foi informado. */
  onAlterar: (avalistas: Avalista[]) => void;
}

const vazio = (): Avalista => ({ nome: '', documento: '', endereco: '' });

/**
 * Campos de avalista mostrados na geração da promissória quando o leilão está
 * marcado como "Avalista obrigatório". Nada é exigido: o que não for preenchido
 * simplesmente não aparece na promissória. Os valores vão pro PDF ao sair do
 * campo (onBlur) — assim o PDF não é regerado a cada tecla digitada.
 */
export default function AvalistasPromissoria({ onAlterar }: Props) {
  const [avalistas, setAvalistas] = useState<Avalista[]>([vazio(), vazio()]);

  const alterar = (i: number, campo: keyof Avalista, valor: string) =>
    setAvalistas(prev => prev.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));

  const publicar = () => onAlterar(
    avalistas
      .map(a => ({ nome: a.nome.trim(), documento: (a.documento || '').trim(), endereco: (a.endereco || '').trim() }))
      .filter(a => a.nome),
  );

  return (
    <div style={{ marginBottom: 16, textAlign: 'left' }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Avalistas da promissória (opcional — o que não for preenchido não aparece):
      </Text>
      {avalistas.map((a, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <Text strong>Avalista {i + 1}</Text>
          <Space direction="vertical" style={{ width: '100%', marginTop: 4 }} size={6}>
            <Input placeholder="Nome" value={a.nome} onChange={e => alterar(i, 'nome', e.target.value)} onBlur={publicar} />
            <Input placeholder="CPF / CNPJ" value={a.documento} onChange={e => alterar(i, 'documento', e.target.value)} onBlur={publicar} />
            <Input placeholder="Endereço" value={a.endereco} onChange={e => alterar(i, 'endereco', e.target.value)} onBlur={publicar} />
          </Space>
        </div>
      ))}
    </div>
  );
}
