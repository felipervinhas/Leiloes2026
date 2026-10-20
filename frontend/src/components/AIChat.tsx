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

/**
 * Perguntas prontas por assunto. As que dependem de um nome (animal, cliente, leilão) só
 * preenchem a caixa de texto para a pessoa completar — "preencher" é o texto inicial.
 */
const SUGESTOES: { assunto: string; perguntas: { texto: string; preencher?: string }[] }[] = [
  { assunto: 'Leilões', perguntas: [
    { texto: 'Quais os próximos leilões?' },
    { texto: 'Resumo do último leilão' },
    { texto: 'Quais lotes não foram vendidos no último leilão?' },
    { texto: 'Maiores vendas do último leilão' },
    { texto: 'Resumo do leilão…', preencher: 'Resumo do leilão ' },
  ] },
  { assunto: 'Lotes e animais', perguntas: [
    { texto: 'Quantos lotes de um animal foram vendidos, por ano e leilão…', preencher: 'Quantos lotes vendidos, por ano e leilão, do animal ' },
    { texto: 'Por quanto foi vendido o animal…', preencher: 'Por quanto foi vendido o animal ' },
    { texto: 'O lote … tem lance?', preencher: 'Tem lance no último leilão o lote número ' },
    { texto: 'Ficha do lote…', preencher: 'Mostre a ficha (vendedor, filiação, venda) do último leilão, lote número ' },
  ] },
  { assunto: 'Vendas e médias', perguntas: [
    { texto: 'Médias por categoria deste ano' },
    { texto: 'Vendas mês a mês deste ano' },
    { texto: 'Totais de vendas deste ano' },
    { texto: 'Média da categoria…', preencher: 'Média por animal neste ano da categoria ' },
  ] },
  { assunto: 'Clientes', perguntas: [
    { texto: 'Maiores compradores deste ano' },
    { texto: 'Maiores vendedores deste ano' },
    { texto: 'Quantos cadastros estão em análise?' },
    { texto: 'Em quais leilões o cliente comprou…', preencher: 'Em quais leilões comprou, e com quais valores, o cliente ' },
    { texto: 'O CPF … é cadastrado?', preencher: 'Está cadastrado o CPF ' },
    { texto: 'Parcelas do cliente…', preencher: 'Parcelas vencidas e a vencer do cliente ' },
    { texto: 'Acerto do vendedor…', preencher: 'Saldo do acerto no último leilão do vendedor ' },
  ] },
  { assunto: 'Financeiro', perguntas: [
    { texto: 'Quais parcelas vencem nos próximos 7 dias?' },
    { texto: 'Quais parcelas estão vencidas?' },
    { texto: 'Despesas do último leilão' },
  ] },
];

/**
 * O assistente responde com **negrito** e listas "- " (subitens com 2 espaços). O balão
 * mostra isso formatado em vez dos asteriscos; o resto continua texto puro (sem HTML).
 */
function TextoFormatado({ texto }: { texto: string }) {
  const negrito = (linha: string, chave: string) => linha.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') && parte.length > 4
      ? <strong key={`${chave}-${i}`}>{parte.slice(2, -2)}</strong>
      : <React.Fragment key={`${chave}-${i}`}>{parte}</React.Fragment>);
  return (
    <>
      {texto.split('\n').map((linha, i) => {
        const item = linha.match(/^(\s*)[-*•]\s+(.*)$/);
        if (item) {
          const nivel = Math.min(Math.floor(item[1].length / 2), 3);
          return <div key={i} style={{ display: 'flex', gap: 6, paddingLeft: nivel * 14 }}><span>•</span><span>{negrito(item[2], String(i))}</span></div>;
        }
        const titulo = linha.match(/^#{1,6}\s+(.*)$/);
        if (titulo) return <div key={i}><strong>{titulo[1]}</strong></div>;
        return linha.trim() ? <div key={i}>{negrito(linha, String(i))}</div> : <div key={i} style={{ height: 6 }} />;
      })}
    </>
  );
}

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
        overflowWrap: 'anywhere',
      }}>
        <TextoFormatado texto={texto} />
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

const BOTAO_TAMANHO = 52;
const POSICAO_STORAGE_KEY = 'aiChatBotaoPos';

/** Lê a posição salva (o usuário já arrastou antes) ou usa o canto inferior
 * direito como padrão — sempre dentro da tela atual, caso a janela tenha
 * mudado de tamanho desde a última vez. */
function posicaoInicial(): { top: number; left: number } {
  try {
    const salva = localStorage.getItem(POSICAO_STORAGE_KEY);
    if (salva) {
      const { top, left } = JSON.parse(salva);
      if (typeof top === 'number' && typeof left === 'number') {
        return {
          top: Math.min(Math.max(0, top), window.innerHeight - BOTAO_TAMANHO),
          left: Math.min(Math.max(0, left), window.innerWidth - BOTAO_TAMANHO),
        };
      }
    }
  } catch { /* localStorage indisponível — segue com o padrão */ }
  return { top: window.innerHeight - 80, left: window.innerWidth - 80 };
}

export default function AIChat() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const caixaRef = useRef<any>(null);
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  // Botão arrastável — o ícone flutuante às vezes cobre algo importante da
  // tela, então o usuário pode arrastar pra outro canto; a posição escolhida
  // fica salva (localStorage) e não volta pro canto padrão ao recarregar.
  const [pos, setPos] = useState(posicaoInicial);
  const arrastandoRef = useRef<{ x: number; y: number; top: number; left: number } | null>(null);
  const moveuRef = useRef(false);

  const onMouseDownBotao = (e: React.MouseEvent) => {
    arrastandoRef.current = { x: e.clientX, y: e.clientY, top: pos.top, left: pos.left };
    moveuRef.current = false;

    const onMove = (ev: MouseEvent) => {
      const inicio = arrastandoRef.current;
      if (!inicio) return;
      const dx = ev.clientX - inicio.x;
      const dy = ev.clientY - inicio.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moveuRef.current = true;
      setPos({
        top: Math.min(Math.max(0, inicio.top + dy), window.innerHeight - BOTAO_TAMANHO),
        left: Math.min(Math.max(0, inicio.left + dx), window.innerWidth - BOTAO_TAMANHO),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      arrastandoRef.current = null;
      if (moveuRef.current) {
        setPos(atual => {
          try { localStorage.setItem(POSICAO_STORAGE_KEY, JSON.stringify(atual)); } catch { /* ignora */ }
          return atual;
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Só abre o chat se o mouseup não veio de um arraste — sem isso, soltar o
  // botão depois de arrastar também dispararia o clique e abriria o drawer.
  const onClickBotao = () => {
    if (moveuRef.current) { moveuRef.current = false; return; }
    setAberto(true);
  };

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
      {/* Botão flutuante — arrastável, segura e solta em qualquer canto da tela */}
      <Tooltip title="Assistente IA (arraste para mover)" placement="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined style={{ fontSize: 20 }} />}
          onMouseDown={onMouseDownBotao}
          onClick={onClickBotao}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000,
            width: BOTAO_TAMANHO, height: BOTAO_TAMANHO,
            backgroundColor: '#222', borderColor: '#222',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'grab',
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
                    Consulto leilões, lotes, vendas, médias, clientes, acertos, parcelas e despesas.
                  </Text>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SUGESTOES.map(g => (
                  <div key={g.assunto}>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.assunto}</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {g.perguntas.map(p => (
                        <button
                          key={p.texto}
                          title={p.preencher ? 'Completa a pergunta na caixa de texto' : undefined}
                          onClick={() => {
                            if (!p.preencher) return enviar(p.texto);
                            // completa na caixa: o nome vai no fim da frase, com o cursor já lá
                            setInput(p.preencher);
                            setTimeout(() => caixaRef.current?.focus({ cursor: 'end' }), 0);
                          }}
                          style={{
                            background: p.preencher ? '#fff' : '#f0f0f0', border: `1px ${p.preencher ? 'dashed' : 'solid'} #ccc`,
                            borderRadius: 14, padding: '5px 10px',
                            textAlign: 'left', cursor: 'pointer', fontSize: 12,
                            color: '#333', lineHeight: 1.35,
                          }}
                        >
                          {p.texto}
                        </button>
                      ))}
                    </div>
                  </div>
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
            ref={caixaRef}
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
