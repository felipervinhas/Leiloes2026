import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, Button, Table, Input, Space, message, Typography, Row, Col, Tag, Grid, Tooltip, Spin } from 'antd';
import {
  SaveOutlined, OrderedListOutlined, ClearOutlined, CalendarOutlined, EyeOutlined, HolderOutlined, SoundOutlined,
} from '@ant-design/icons';
import { BlobProvider } from '@react-pdf/renderer';
import api from '../services/api';
import { BotaoBaixarPDFOrdem, LoteOrdemPDF } from '../relatorios/RelatorioOrdemEntrada';
import OrdemEntradaDinamica from '../relatorios/OrdemEntradaDinamica';
import { CampoLayout } from '../relatorios/tipoLayout';
import { useConfig } from '../context/ConfigContext';
import { useBanco } from '../context/BancoContext';
import { useBuscaLeiloes } from '../hooks/useBuscaLeiloes';

interface LoteOrdem {
  id: number;
  lotexx: string;
  deslot?: string;
  nomeVendedor?: string;
  nomeRaca?: string;
  catego?: string;
  ordem?: string;
  dataLeilao?: string;
  enderecoLeilao?: string;
  cidadeLeilao?: string;
  estadoLeilao?: string;
  horaInicioLeilao?: string;
  horaFechamentoPreLeilao?: string;
  leiloeiro?: string;
  categoriaLeilao?: string;
  tipoLeilao?: string;
  transmissaoLeilao?: string;
  linkTransmissao1Leilao?: string;
  linkTransmissao2Leilao?: string;
  urlCatalogoLeilao?: string;
  comissaoVendedorLeilao?: number;
  comissaoCompradorLeilao?: number;
  qtdParcelasLeilao?: number;
  multiploLeilao?: number;
  dataSaldoLeilao?: string;
  condicaoPagamentoLeilao?: string;
  regulamentoLeilao?: string;
  observacoesLeilao?: string;
}

const CATEGO_COR: Record<string, string> = { M: 'blue', F: 'magenta', N: 'default', C: 'orange' };
const CATEGO_LABEL: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

export default function OrdemEntrada() {
  const config = useConfig();
  const navigate = useNavigate();
  const { banco } = useBanco();
  const screens = Grid.useBreakpoint();
  const sm = !!screens.sm;

  const { opcoes: leiloes, carregando: carregandoLeiloes, buscar: buscarLeiloes } = useBuscaLeiloes();
  const [leilaoId, setLeilaoId] = useState<number | undefined>();
  const [nomeLeilao, setNomeLeilao] = useState<string | undefined>();
  const [lotes, setLotes] = useState<LoteOrdem[]>([]);
  const [ordens, setOrdens] = useState<Record<number, string>>({});
  const [ordemIds, setOrdemIds] = useState<number[]>([]);
  const [arrastandoId, setArrastandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [layoutAtivo, setLayoutAtivo] = useState<CampoLayout[] | null>(null);
  const dragIdRef = useRef<number | null>(null);

  useEffect(() => {
    api.get('/relatorio-layouts/ativo/ordem_entrada')
      .then(r => setLayoutAtivo(r.data?.conteudo || null))
      .catch(() => setLayoutAtivo(null));
  }, []);

  const carregarLotes = async (id: number, label: string) => {
    setLoading(true);
    try {
      const r = await api.get('/lotes', { params: { idLeilao: id } });
      const data: LoteOrdem[] = r.data;
      setLotes(data);
      const init: Record<number, string> = {};
      data.forEach(l => { init[l.id] = l.ordem || ''; });
      setOrdens(init);
      setOrdemIds(ordenarIdsInicial(data, init));
      setNomeLeilao(label);
    } finally {
      setLoading(false);
    }
  };

  const ordenarIdsInicial = (lista: LoteOrdem[], ordensMap: Record<number, string>) => {
    return [...lista]
      .sort((a, b) => {
        const oa = ordensMap[a.id] || '';
        const ob = ordensMap[b.id] || '';
        if (oa && !ob) return -1;
        if (!oa && ob) return 1;
        if (!oa && !ob) return a.lotexx.localeCompare(b.lotexx);
        const na = parseInt(oa) || 0;
        const nb = parseInt(ob) || 0;
        return na !== nb ? na - nb : a.lotexx.localeCompare(b.lotexx);
      })
      .map(l => l.id);
  };

  const renumerar = (ids: number[]) => {
    const novas: Record<number, string> = {};
    ids.forEach((id, i) => { novas[id] = String(i + 1).padStart(2, '0'); });
    setOrdens(novas);
  };

  const moverLinha = (origemId: number | null, destinoId: number) => {
    if (origemId == null || origemId === destinoId) return;
    setOrdemIds(prev => {
      const lista = [...prev];
      const de = lista.indexOf(origemId);
      const para = lista.indexOf(destinoId);
      if (de === -1 || para === -1) return prev;
      lista.splice(de, 1);
      lista.splice(para, 0, origemId);
      renumerar(lista);
      return lista;
    });
  };

  const onChangeLeilao = (id: number, opt: any) => {
    setLeilaoId(id);
    carregarLotes(id, opt.label as string);
  };

  const setOrdem = (id: number, valor: string) =>
    setOrdens(prev => ({ ...prev, [id]: valor }));

  const autonumerar = () => {
    renumerar(ordemIds);
    message.success('Numeração automática aplicada — salve para confirmar');
  };

  const limparOrdens = () => {
    const novas: Record<number, string> = {};
    lotes.forEach(l => { novas[l.id] = ''; });
    setOrdens(novas);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const payload = lotes.map(l => ({ id: l.id, ordem: ordens[l.id] || null }));
      await api.post('/lotes/salvar-ordens', { lotes: payload });
      message.success('Ordem salva com sucesso');
    } catch {
      message.error('Erro ao salvar ordem');
    } finally {
      setSalvando(false);
    }
  };

  const porId = useMemo(
    () => Object.fromEntries(lotes.map(l => [l.id, l])) as Record<number, LoteOrdem>,
    [lotes],
  );

  const lotesOrdenados = useMemo(
    () => ordemIds.map(id => porId[id]).filter(Boolean),
    [ordemIds, porId],
  );

  const comOrdem = lotes.filter(l => ordens[l.id]);

  const lotesParaPDF: LoteOrdemPDF[] = lotes
    .map(l => ({ ...l, ordem: ordens[l.id] || l.ordem || '' }))
    .sort((a, b) => {
      const na = a.ordem ? parseInt(a.ordem) || 999 : 9999;
      const nb = b.ordem ? parseInt(b.ordem) || 999 : 9999;
      return na - nb || a.lotexx.localeCompare(b.lotexx);
    });

  const colunas = [
    {
      title: '',
      key: 'arrastar',
      width: 32,
      render: () => (
        <HolderOutlined style={{ cursor: 'grab', color: '#999' }} />
      ),
    },
    {
      title: 'Ordem',
      key: 'ordem',
      width: 80,
      render: (_: any, r: LoteOrdem) => (
        <Input
          size="small"
          value={ordens[r.id] ?? ''}
          onChange={e => setOrdem(r.id, e.target.value)}
          maxLength={3}
          style={{
            width: 60,
            textAlign: 'center',
            fontWeight: 700,
            color: ordens[r.id] ? '#1677ff' : undefined,
          }}
          placeholder="—"
        />
      ),
    },
    { title: 'Lote', dataIndex: 'lotexx', width: 70 },
    { title: 'Descrição', dataIndex: 'deslot', ellipsis: true },
    ...(sm ? [{ title: 'Vendedor', dataIndex: 'nomeVendedor', ellipsis: true, width: 180 }] : []),
    ...(sm ? [{ title: 'Raça', dataIndex: 'nomeRaca', width: 120, ellipsis: true }] : []),
    {
      title: 'Sexo',
      dataIndex: 'catego',
      width: 70,
      render: (v: string) => v
        ? <Tag color={CATEGO_COR[v] || 'default'}>{sm ? (CATEGO_LABEL[v] || v) : v}</Tag>
        : '—',
    },
  ];

  return (
    <>
      <Typography.Title level={4}>
        <CalendarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        Ordem de Entrada
      </Typography.Title>

      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={14}>
          <Select
            placeholder="Digite para buscar o leilão..."
            options={leiloes}
            value={leilaoId}
            onChange={onChangeLeilao}
            onSearch={buscarLeiloes}
            style={{ width: '100%' }}
            showSearch
            filterOption={false}
            loading={carregandoLeiloes}
            notFoundContent={carregandoLeiloes ? <Spin size="small" /> : 'Digite 2+ letras para buscar'}
          />
        </Col>

        {lotes.length > 0 && (
          <Col xs={24} md={10}>
            <Space wrap size={6}>
              <Tooltip title="Numera todos os lotes sequencialmente pela ordem da tabela">
                <Button icon={<OrderedListOutlined />} onClick={autonumerar}>
                  Auto-numerar
                </Button>
              </Tooltip>
              <Button icon={<ClearOutlined />} onClick={limparOrdens}>
                Limpar
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={salvar}
                loading={salvando}
              >
                Salvar
              </Button>
              <Button
                icon={<SoundOutlined />}
                onClick={() => leilaoId && navigate(`/${banco}/painel-leiloeiro`, { state: { idLeilao: leilaoId, nomeLeilao } })}
              >
                Painel do Leiloeiro
              </Button>
              <BotaoBaixarPDFOrdem
                lotes={lotesParaPDF}
                titulo={nomeLeilao}
                empresa={config.empresa}
                logoBase64={config.logoBase64}
              />
              {layoutAtivo && (
                <BlobProvider
                  document={
                    <OrdemEntradaDinamica
                      lotes={lotesParaPDF}
                      layout={layoutAtivo}
                      titulo={nomeLeilao}
                      empresa={config.empresa}
                      logoBase64={config.logoBase64}
                    />
                  }
                >
                  {({ url, loading: gerandoPdf }) => (
                    <Button
                      icon={<EyeOutlined />}
                      loading={gerandoPdf}
                      disabled={!url}
                      onClick={() => url && window.open(url, '_blank')}
                    >
                      Imprimir (modelo personalizado)
                    </Button>
                  )}
                </BlobProvider>
              )}
            </Space>
          </Col>
        )}
      </Row>

      {leilaoId && lotes.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
          <span style={{ color: '#389e0d', fontWeight: 600 }}>{comOrdem.length}</span> de{' '}
          <strong>{lotes.length}</strong> lotes com ordem definida
        </div>
      )}

      {leilaoId && (
        <Table
          rowKey="id"
          columns={colunas}
          dataSource={lotesOrdenados}
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ x: sm ? 700 : 400, y: 'calc(100vh - 300px)' }}
          rowClassName={r => [
            ordens[r.id] ? 'lote-com-ordem' : '',
            arrastandoId === r.id ? 'lote-arrastando' : '',
          ].filter(Boolean).join(' ')}
          onRow={(record) => ({
            draggable: true,
            onDragStart: () => { dragIdRef.current = record.id; setArrastandoId(record.id); },
            onDragOver: (e: React.DragEvent) => e.preventDefault(),
            onDrop: () => { moverLinha(dragIdRef.current, record.id); },
            onDragEnd: () => { dragIdRef.current = null; setArrastandoId(null); },
          })}
        />
      )}

      <style>{`
        .lote-com-ordem td { background-color: #f6ffed !important; }
        .lote-com-ordem:hover td { background-color: #d9f7be !important; }
        .lote-arrastando td { opacity: 0.4; }
      `}</style>
    </>
  );
}
