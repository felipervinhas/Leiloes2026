import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Col, Empty, Input, List, Row, Space, Tag, Typography, message } from 'antd';
import { ReloadOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { erroApi, fmtDataHora, STATUS_ENVIO } from './tipos';

const { Text } = Typography;

export default function Conversas({ aoLer }: { aoLer?: () => void }) {
  const [lista, setLista] = useState<any[]>([]);
  const [naoLidas, setNaoLidas] = useState(false);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aberta, setAberta] = useState<any | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get('/whatsapp/conversas', { params: { naoLidas: naoLidas ? 1 : undefined, busca: busca || undefined } });
      setLista(r.data);
    } catch (e) { message.error(erroApi(e, 'Erro ao carregar respostas')); }
    finally { setCarregando(false); }
  }, [naoLidas, busca]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const abrir = async (c: any) => {
    setAberta(c);
    try {
      const r = await api.get(`/whatsapp/conversas/${c.chave}`);
      setMensagens(r.data);
      if (c.naoLidas) { setLista(l => l.map(x => x.chave === c.chave ? { ...x, naoLidas: 0 } : x)); aoLer?.(); }
      setTimeout(() => fim.current?.scrollIntoView(), 50);
    } catch (e) { message.error(erroApi(e, 'Erro ao abrir a conversa')); }
  };

  const responder = async () => {
    if (!aberta || !texto.trim()) return;
    setEnviando(true);
    try {
      await api.post(`/whatsapp/conversas/${aberta.chave}/responder`, { texto });
      setTexto('');
      await abrir(aberta);
    } catch (e) { message.error(erroApi(e, 'Erro ao responder')); }
    finally { setEnviando(false); }
  };

  return (
    <Row gutter={16}>
      <Col xs={24} md={9}>
        <Space style={{ marginBottom: 8 }} wrap>
          <Input.Search allowClear placeholder="Nome ou telefone" onSearch={setBusca} style={{ width: 200 }} />
          <Checkbox checked={naoLidas} onChange={e => setNaoLidas(e.target.checked)}>Não lidas</Checkbox>
          <Button icon={<ReloadOutlined />} onClick={carregar} />
        </Space>
        <List
          loading={carregando} dataSource={lista} bordered size="small"
          style={{ maxHeight: 560, overflow: 'auto' }}
          locale={{ emptyText: <Empty description="Nenhuma resposta recebida ainda" /> }}
          renderItem={(c: any) => (
            <List.Item onClick={() => abrir(c)}
              style={{ cursor: 'pointer', background: aberta?.chave === c.chave ? '#e6f4ff' : undefined }}>
              <List.Item.Meta
                title={<Space>
                  <Badge count={c.naoLidas} size="small"><Text strong>{c.nome || c.telefone}</Text></Badge>
                  {c.descadastrado && <Tag color="orange">descadastrado</Tag>}
                </Space>}
                description={<>
                  <Text type="secondary" style={{ fontSize: 12 }}>{c.telefone} · {fmtDataHora(c.ultima)}</Text><br />
                  <Text ellipsis style={{ maxWidth: 300 }}>{c.ultimoTexto}</Text>
                </>}
              />
            </List.Item>
          )}
        />
      </Col>
      <Col xs={24} md={15}>
        {!aberta ? <Empty description="Escolha uma conversa" style={{ marginTop: 64 }} /> : (
          <>
            <Space style={{ marginBottom: 8 }}>
              <Text strong>{aberta.nome || aberta.telefone}</Text><Text type="secondary">{aberta.telefone}</Text>
            </Space>
            <div style={{ height: 440, overflow: 'auto', background: '#efeae2', padding: 12, borderRadius: 8 }}>
              {mensagens.map(m => (
                <div key={`${m.origem}-${m.id}`} style={{ display: 'flex', justifyContent: m.direcao === 'E' ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
                  <div style={{ maxWidth: '75%', background: m.direcao === 'E' ? '#fff' : '#d9fdd3', padding: '6px 10px', borderRadius: 8 }}>
                    {m.origem === 'campanha' && <Text type="secondary" style={{ fontSize: 11 }}>Campanha: {m.campanha}<br /></Text>}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {fmtDataHora(m.dataHora)}
                      {m.direcao === 'S' && m.usuario ? ` · ${m.usuario}` : ''}
                      {m.status ? ` · ${STATUS_ENVIO[m.status]?.label || m.status}` : ''}
                    </Text>
                  </div>
                </div>
              ))}
              <div ref={fim} />
            </div>
            {(() => {
              const ultimaRecebida = [...mensagens].reverse().find(m => m.direcao === 'E');
              const aberta24h = ultimaRecebida && Date.now() - new Date(ultimaRecebida.dataHora).getTime() < 24 * 3600_000;
              return aberta24h ? (
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} value={texto} onChange={e => setTexto(e.target.value)}
                    placeholder="Responder (sem custo dentro de 24h da mensagem do cliente)"
                    onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); responder(); } }} />
                  <Button type="primary" icon={<SendOutlined />} loading={enviando} onClick={responder} />
                </Space.Compact>
              ) : (
                <Alert style={{ marginTop: 8 }} type="info" showIcon
                  message="Passaram mais de 24h desde a última mensagem do cliente — a Meta só permite falar com ele por um template (crie uma campanha com o cliente escolhido)." />
              );
            })()}
          </>
        )}
      </Col>
    </Row>
  );
}
