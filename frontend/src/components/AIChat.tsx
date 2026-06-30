import React, { useState, useRef, useEffect } from 'react';
import { Button, Drawer, Input, Spin, Typography, Tooltip } from 'antd';
import { RobotOutlined, SendOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Text } = Typography;
const { TextArea } = Input;

interface Mensagem {
  role: 'user' | 'assistant';
  content: string;
}

const SUGESTOES = [
  'Quais leilões estão ativos?',
  'Mostre os totais financeiros gerais',
  'Busque o cliente João Silva',
  'Quais parcelas vencem nos próximos 7 dias?',
];

function BolhaAssistente({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 2,
      }}>
        <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
      </div>
      <div style={{
        background: '#f0f0f0', borderRadius: '4px 12px 12px 12px',
        padding: '8px 12px', maxWidth: '85%',
        fontSize: 13, lineHeight: 1.6, color: '#222',
        whiteSpace: 'pre-wrap',
      }}>
        {texto}
      </div>
    </div>
  );
}

function BolhaUsuario({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <div style={{
        background: '#222', borderRadius: '12px 4px 12px 12px',
        padding: '8px 12px', maxWidth: '85%',
        fontSize: 13, lineHeight: 1.6, color: '#fff',
        whiteSpace: 'pre-wrap',
      }}>
        {texto}
      </div>
    </div>
  );
}

export default function AIChat() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, carregando]);

  const enviar = async (texto: string) => {
    const t = texto.trim();
    if (!t || carregando) return;
    setInput('');

    const novas: Mensagem[] = [...mensagens, { role: 'user', content: t }];
    setMensagens(novas);
    setCarregando(true);

    try {
      const historico = novas.slice(0, -1);
      const { data } = await api.post('/ai/chat', { mensagem: t, historico });
      setMensagens([...novas, { role: 'assistant', content: data.resposta }]);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Erro ao contatar o assistente.';
      setMensagens([...novas, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setCarregando(false);
    }
  };

  const limpar = () => setMensagens([]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar(input);
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      <Tooltip title="Assistente IA" placement="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined style={{ fontSize: 20 }} />}
          onClick={() => setAberto(true)}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
            width: 52, height: 52,
            backgroundColor: '#222', borderColor: '#222',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        />
      </Tooltip>

      {/* Drawer de chat */}
      <Drawer
        open={aberto}
        onClose={() => setAberto(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined />
            <span>Assistente IA</span>
          </div>
        }
        extra={
          mensagens.length > 0 ? (
            <Tooltip title="Limpar conversa">
              <Button
                size="small" type="text" icon={<DeleteOutlined />}
                onClick={limpar}
              />
            </Tooltip>
          ) : null
        }
        width={420}
        placement="right"
        closeIcon={<CloseOutlined />}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
      >
        {/* Área de mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
          {mensagens.length === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 12 }}>
                <RobotOutlined style={{ fontSize: 40, color: '#bbb', marginBottom: 8 }} />
                <div>
                  <Text style={{ color: '#555', fontSize: 13 }}>
                    Olá! Sou o assistente do sistema de leilões.<br />
                    Posso consultar clientes, leilões, parcelas, financeiro e mais.
                  </Text>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SUGESTOES.map(s => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    style={{
                      background: '#f0f0f0', border: '1px solid #ddd',
                      borderRadius: 8, padding: '7px 12px',
                      textAlign: 'left', cursor: 'pointer', fontSize: 12.5,
                      color: '#333', lineHeight: 1.4,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) =>
            m.role === 'user'
              ? <BolhaUsuario key={i} texto={m.content} />
              : <BolhaAssistente key={i} texto={m.content} />
          )}

          {carregando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
              </div>
              <Spin size="small" />
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '10px 12px 12px',
          borderTop: '1px solid #f0f0f0',
          backgroundColor: '#fff',
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo... (Enter para enviar)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={carregando}
            style={{ flex: 1, resize: 'none', fontSize: 13 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => enviar(input)}
            disabled={!input.trim() || carregando}
            style={{ backgroundColor: '#222', borderColor: '#222', height: 36 }}
          />
        </div>
      </Drawer>
    </>
  );
}
