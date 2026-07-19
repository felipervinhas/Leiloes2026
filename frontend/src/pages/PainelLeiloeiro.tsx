import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Select, Button, Spin, Tag, Switch, Row, Col, Typography, Image, Space, Empty, message } from 'antd';
import {
  LeftOutlined, RightOutlined, LogoutOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import { useBanco } from '../context/BancoContext';
import { useBuscaLeiloes } from '../hooks/useBuscaLeiloes';
import { labelRP, labelSBB, ordenarPorEntrada } from '../utils/lote';

const { Title, Text, Paragraph } = Typography;

const CATEGO_LABEL: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

interface LoteImagem { num: number; url: string; key: string; }

const FALLBACK_FOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23bbb' font-size='16'%3ESem foto%3C/text%3E%3C/svg%3E";

export default function PainelLeiloeiro() {
  const location = useLocation();
  const navigate = useNavigate();
  const { banco } = useBanco();

  const { opcoes: leiloes, carregando: carregandoLeiloes, buscar: buscarLeiloes, garantirOpcao: garantirOpcaoLeilao } = useBuscaLeiloes();
  const [leilaoSelId, setLeilaoSelId] = useState<number | undefined>();
  const [leilaoAtual, setLeilaoAtual] = useState<{ id: number; nome: string } | null>(null);

  const [lotes, setLotes] = useState<any[]>([]);
  const [indice, setIndice] = useState(0);
  const [carregandoLotes, setCarregandoLotes] = useState(false);
  const [racasEspecies, setRacasEspecies] = useState<Record<number, string | undefined>>({});

  const [imagens, setImagens] = useState<LoteImagem[]>([]);
  const [fotoAtiva, setFotoAtiva] = useState(0);
  const [carregandoImagens, setCarregandoImagens] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  const lote = lotes[indice];

  // ── inicialização ──────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/racas').then(r => {
      const mapa: Record<number, string | undefined> = {};
      (r.data || []).forEach((raca: any) => { mapa[raca.id] = raca.especies; });
      setRacasEspecies(mapa);
    }).catch(() => {});

    const estado = location.state as { idLeilao?: number; nomeLeilao?: string } | null;
    if (estado?.idLeilao) {
      carregarLeilao(estado.idLeilao, estado.nomeLeilao || '');
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarLeilao = async (id: number, nome: string) => {
    setCarregandoLotes(true);
    try {
      const r = await api.get('/lotes', { params: { idLeilao: id } });
      const ordenados = ordenarPorEntrada(r.data || []);
      setLotes(ordenados);
      setIndice(0);
      setLeilaoAtual({ id, nome });
    } finally {
      setCarregandoLotes(false);
    }
  };

  useEffect(() => {
    if (!lote) { setImagens([]); return; }
    setFotoAtiva(0);
    setCarregandoImagens(true);
    api.get(`/lotes/${lote.id}/imagens`)
      .then(r => setImagens(r.data || []))
      .finally(() => setCarregandoImagens(false));
  }, [lote?.id]);

  // ── navegação por teclado (setas) ────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const emCampo = ['INPUT', 'TEXTAREA'].includes(alvo?.tagName) || alvo?.isContentEditable;
      if (emCampo || !leilaoAtual) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); proximo(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); anterior(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, lotes.length, leilaoAtual]);

  const anterior = () => setIndice(i => Math.max(0, i - 1));
  const proximo = () => setIndice(i => Math.min(lotes.length - 1, i + 1));

  const alternarStatus = async (campo: 'vendido' | 'publica', valor: boolean) => {
    if (!lote) return;
    setSalvandoStatus(true);
    try {
      await api.patch(`/lotes/${lote.id}/status`, { [campo]: valor ? 'S' : 'N' });
      setLotes(prev => prev.map((l, i) => i === indice ? { ...l, [campo]: valor ? 'S' : 'N' } : l));
      message.success('Atualizado');
    } catch {
      message.error('Erro ao atualizar');
    } finally {
      setSalvandoStatus(false);
    }
  };

  const sair = () => navigate(`/${banco}/ordem-entrada`);

  // ── tela de seleção de leilão ────────────────────────────────────────
  if (!leilaoAtual) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24,
      }}>
        <Title level={2} style={{ color: '#fff', marginBottom: 32 }}>Painel do Leiloeiro</Title>
        <Space direction="vertical" size={16} style={{ width: '100%', maxWidth: 420 }}>
          <Select
            placeholder="Digite para buscar o leilão..."
            style={{ width: '100%' }}
            size="large"
            showSearch
            allowClear
            value={leilaoSelId}
            options={leiloes}
            onChange={setLeilaoSelId}
            onSearch={buscarLeiloes}
            filterOption={false}
            loading={carregandoLeiloes}
            notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
          />
          <Button
            type="primary" size="large" block icon={<PlayCircleOutlined />}
            loading={carregandoLotes}
            disabled={!leilaoSelId}
            onClick={() => {
              const opt = leiloes.find(l => l.value === leilaoSelId);
              if (leilaoSelId) { garantirOpcaoLeilao(leilaoSelId, opt?.label); carregarLeilao(leilaoSelId, opt?.label || ''); }
            }}
          >
            Iniciar
          </Button>
          <Button block ghost onClick={sair} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
            Voltar
          </Button>
        </Space>
      </div>
    );
  }

  const especies = lote ? racasEspecies[lote.racaxx] : undefined;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* ── Topo ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        padding: '12px 20px', background: '#1e293b', borderBottom: '1px solid #334155',
      }}>
        <div style={{ minWidth: 0 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Leilão</Text>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {leilaoAtual.nome}
          </div>
        </div>
        <Space size={12} wrap>
          {lotes.length > 0 && (
            <Select
              value={indice}
              onChange={setIndice}
              style={{ width: 220 }}
              showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              options={lotes.map((l, i) => ({ value: i, label: `Lote ${l.lotexx} — ${l.deslot || ''}` }))}
            />
          )}
          <Button icon={<LogoutOutlined />} onClick={sair}>Sair</Button>
        </Space>
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
        {carregandoLotes ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : !lote ? (
          <Empty description="Nenhum lote encontrado para este leilão" style={{ marginTop: 80 }}>
            <Text style={{ color: '#94a3b8' }}>Nenhum lote encontrado para este leilão</Text>
          </Empty>
        ) : (
          <Row gutter={24}>
            {/* Fotos */}
            <Col xs={24} md={10}>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 12 }}>
                {carregandoImagens ? (
                  <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
                ) : (
                  <>
                    <Image
                      src={imagens[fotoAtiva]?.url}
                      fallback={FALLBACK_FOTO}
                      style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 8 }}
                    />
                    <Row gutter={8} style={{ marginTop: 8 }}>
                      {imagens.map((img, i) => (
                        <Col span={6} key={img.num}>
                          <img
                            src={img.url}
                            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                            onClick={() => setFotoAtiva(i)}
                            style={{
                              width: '100%', height: 64, objectFit: 'cover', borderRadius: 6, cursor: 'pointer',
                              border: fotoAtiva === i ? '2px solid #1677ff' : '2px solid transparent',
                            }}
                          />
                        </Col>
                      ))}
                    </Row>
                  </>
                )}
                {lote.urlvideo && (
                  <Button
                    block icon={<PlayCircleOutlined />} style={{ marginTop: 12 }}
                    onClick={() => window.open(lote.urlvideo, '_blank')}
                  >
                    Assistir Vídeo
                  </Button>
                )}
              </div>
            </Col>

            {/* Dados */}
            <Col xs={24} md={14}>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
                <Space align="center" wrap style={{ marginBottom: 4 }}>
                  <Title level={2} style={{ color: '#fff', margin: 0 }}>Lote {lote.lotexx}</Title>
                  {lote.catego && <Tag color="blue">{CATEGO_LABEL[lote.catego] || lote.catego}</Tag>}
                  {lote.vendido === 'S' && <Tag color="red">Vendido</Tag>}
                </Space>
                <Paragraph style={{ color: '#e2e8f0', fontSize: 18, marginBottom: 16 }}>{lote.deslot}</Paragraph>

                <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
                  <DadoItem label="Raça" valor={lote.nomeRaca} />
                  <DadoItem label="Vendedor" valor={lote.nomeVendedor} />
                  <DadoItem label="Pelagem" valor={lote.pelage} />
                  <DadoItem label="Peso" valor={lote.pesoxx ? `${lote.pesoxx} kg` : undefined} />
                  <DadoItem label={labelRP(especies)} valor={lote.rpxxx} />
                  <DadoItem label={labelSBB(especies)} valor={lote.sbbxxx} />
                  <DadoItem label="TAT" valor={lote.tatxxx} />
                  <DadoItem label="Data Nasc." valor={lote.datnas ? new Date(lote.datnas).toLocaleDateString('pt-BR') : undefined} />
                </Row>

                {lote.filiacao && (
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Filiação</Text>
                    <Paragraph style={{ color: '#e2e8f0', marginBottom: 0 }}>{lote.filiacao}</Paragraph>
                  </div>
                )}
                {lote.obslot && (
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Observações</Text>
                    <Paragraph style={{ color: '#e2e8f0', marginBottom: 0, whiteSpace: 'pre-wrap' }}>{lote.obslot}</Paragraph>
                  </div>
                )}
                {lote.comentario && (
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Comentário</Text>
                    <Paragraph style={{ color: '#e2e8f0', marginBottom: 0, whiteSpace: 'pre-wrap' }}>{lote.comentario}</Paragraph>
                  </div>
                )}

                <Space size={24} style={{ marginTop: 8 }}>
                  <Space>
                    <Text style={{ color: '#94a3b8' }}>Público</Text>
                    <Switch checked={lote.publica === 'S'} loading={salvandoStatus} onChange={v => alternarStatus('publica', v)} />
                  </Space>
                  <Space>
                    <Text style={{ color: '#94a3b8' }}>Vendido</Text>
                    <Switch checked={lote.vendido === 'S'} loading={salvandoStatus} onChange={v => alternarStatus('vendido', v)} />
                  </Space>
                </Space>
              </div>
            </Col>
          </Row>
        )}
      </div>

      {/* ── Navegação ── */}
      {lotes.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '14px 20px', background: '#1e293b', borderTop: '1px solid #334155',
        }}>
          <Button size="large" icon={<LeftOutlined />} disabled={indice === 0} onClick={anterior}>Anterior</Button>
          <Text style={{ color: '#94a3b8' }}>{indice + 1} de {lotes.length}</Text>
          <Button type="primary" size="large" disabled={indice === lotes.length - 1} onClick={proximo}>
            Próximo <RightOutlined />
          </Button>
        </div>
      )}
    </div>
  );
}

function DadoItem({ label, valor }: { label: string; valor?: string | number | null }) {
  if (!valor) return null;
  return (
    <Col xs={12} sm={8} md={6}>
      <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block' }}>{label}</Text>
      <Text style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600 }}>{valor}</Text>
    </Col>
  );
}
