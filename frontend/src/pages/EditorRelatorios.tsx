import { useEffect, useState } from 'react';
import {
  Button, Input, message, Modal, Popconfirm, Select, Space, Tag, Typography,
} from 'antd';
import {
  DeleteOutlined, EyeOutlined, PlusOutlined, SaveOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { BlobProvider } from '@react-pdf/renderer';
import api from '../services/api';
import { useConfig } from '../context/ConfigContext';
import PaletaCampos from '../components/relatorioEditor/PaletaCampos';
import PainelPropriedades from '../components/relatorioEditor/PainelPropriedades';
import CanvasEditor from '../components/relatorioEditor/CanvasEditor';
import { CampoLayout, normalizarCampoLayout } from '../relatorios/tipoLayout';
import { CampoDisponivel, PROMISSORIA_CAMPOS } from '../relatorios/promissoriaCampos';
import PromissoriaDinamica from '../relatorios/PromissoriaDinamica';
import { FaturaData } from '../relatorios/RelatorioFaturaCompra';
import { ORDEM_ENTRADA_CAMPOS, COLUNAS_LOTES_PADRAO, LoteOrdemPDF } from '../relatorios/ordemEntradaCampos';
import OrdemEntradaDinamica from '../relatorios/OrdemEntradaDinamica';
import RelatorioFaturaCompradorDinamico from '../relatorios/RelatorioFaturaCompradorDinamico';
import EditorBlocoCartao from '../components/relatorioEditor/EditorBlocoCartao';

const { Title } = Typography;

const GRID_MM = 4;

const novoId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c${Date.now()}_${Math.random()}`;

interface TemplateResumo {
  id: number;
  nome: string;
  ativo: boolean;
  datcri: string;
}

/** Registro dos tipos de relatório suportados pelo editor. Cada tipo tem seu próprio catálogo de campos e blocos disponíveis. */
interface TipoRelatorioConfig {
  tipo: string;
  label: string;
  familia: 'fatura' | 'ordem_entrada';
  campos: CampoDisponivel[];
  tituloDocumento: string;
  larguraMM: number;
  alturaMM: number;
  suportaBlocoParcelas?: boolean;
  suportaBlocoCompradores?: boolean;
  suportaTabelaLotes?: boolean;
}

const TIPOS_RELATORIO: TipoRelatorioConfig[] = [
  {
    tipo: 'promissoria', label: 'Nota Promissória', familia: 'fatura',
    campos: PROMISSORIA_CAMPOS, tituloDocumento: 'Promissória', suportaBlocoParcelas: true,
    larguraMM: 210, alturaMM: 297,
  },
  {
    tipo: 'nota_venda', label: 'Nota de Venda', familia: 'fatura',
    campos: PROMISSORIA_CAMPOS, tituloDocumento: 'Nota de Venda', suportaBlocoParcelas: true,
    larguraMM: 210, alturaMM: 297,
  },
  {
    tipo: 'ordem_entrada', label: 'Ordem de Entrada', familia: 'ordem_entrada',
    campos: ORDEM_ENTRADA_CAMPOS, tituloDocumento: 'Ordem de Entrada', suportaTabelaLotes: true,
    larguraMM: 297, alturaMM: 210,
  },
  {
    tipo: 'fatura_comprador', label: 'Fatura de Comprador', familia: 'fatura',
    campos: PROMISSORIA_CAMPOS, tituloDocumento: 'Fatura de Comprador', suportaBlocoCompradores: true,
    larguraMM: 210, alturaMM: 297,
  },
];

export default function EditorRelatorios() {
  const config = useConfig();
  const [tipoSelecionado, setTipoSelecionado] = useState(TIPOS_RELATORIO[0].tipo);
  const tipoConfig = TIPOS_RELATORIO.find(t => t.tipo === tipoSelecionado) || TIPOS_RELATORIO[0];

  const [templates, setTemplates] = useState<TemplateResumo[]>([]);
  const [templateAtual, setTemplateAtual] = useState<{ id: number; nome: string } | null>(null);
  const [layout, setLayout] = useState<CampoLayout[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nomeModalOpen, setNomeModalOpen] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [cartaoAberto, setCartaoAberto] = useState(false);

  const [vendaOptions, setVendaOptions] = useState<{ value: number; label: string }[]>([]);
  const [vendaTesteId, setVendaTesteId] = useState<number | null>(null);
  const [vendaDados, setVendaDados] = useState<FaturaData | null>(null);

  const [leilaoOptions, setLeilaoOptions] = useState<{ value: number; label: string }[]>([]);
  const [leilaoTesteId, setLeilaoTesteId] = useState<number | null>(null);
  const [leilaoTesteNome, setLeilaoTesteNome] = useState<string>('');
  const [lotesTeste, setLotesTeste] = useState<LoteOrdemPDF[]>([]);

  const campoSelecionado = layout.find(c => c.id === selecionadoId) || null;

  const carregarTemplates = async (tipo: string) => {
    const r = await api.get('/relatorio-layouts/templates', { params: { tipo } });
    setTemplates(r.data);
  };

  useEffect(() => { carregarTemplates(tipoSelecionado); }, [tipoSelecionado]);

  useEffect(() => {
    if (!vendaTesteId) { setVendaDados(null); return; }
    api.get(`/vendas/${vendaTesteId}/fatura`).then(r => setVendaDados(r.data)).catch(() => setVendaDados(null));
  }, [vendaTesteId]);

  useEffect(() => {
    if (tipoConfig.familia !== 'ordem_entrada') return;
    api.get('/leiloes').then(r => setLeilaoOptions((r.data || []).map((l: any) => ({
      value: l.id, label: l.leilao || `Leilão #${l.id}`,
    })))).catch(() => setLeilaoOptions([]));
  }, [tipoConfig.familia]);

  useEffect(() => {
    if (!leilaoTesteId) { setLotesTeste([]); return; }
    api.get('/lotes', { params: { idLeilao: leilaoTesteId } }).then(r => {
      setLotesTeste((r.data || []).map((l: any) => ({
        id: l.id, lotexx: l.lotexx, deslot: l.deslot, nomeVendedor: l.nomeVendedor,
        nomeRaca: l.nomeRaca, catego: l.catego, ordem: l.ordem || '',
      })));
    }).catch(() => setLotesTeste([]));
  }, [leilaoTesteId]);

  const buscarVendas = async (busca: string) => {
    if (!busca) { setVendaOptions([]); return; }
    const r = await api.get('/vendas', { params: { busca } });
    setVendaOptions((r.data || []).map((v: any) => ({
      value: v.id,
      label: `${v.codnot || v.id}${v.leilao ? ' — ' + v.leilao : ''}`,
    })));
  };

  const trocarTipo = (tipo: string) => {
    if (layout.length > 0) {
      Modal.confirm({
        title: 'Trocar tipo de relatório?',
        content: 'O layout atual não salvo será descartado.',
        okText: 'Trocar',
        cancelText: 'Cancelar',
        onOk: () => { setTipoSelecionado(tipo); abrirNovo(); },
      });
      return;
    }
    setTipoSelecionado(tipo);
    abrirNovo();
  };

  const abrirNovo = () => {
    setTemplateAtual(null);
    setLayout([]);
    setSelecionadoId(null);
  };

  const abrirTemplate = async (id: number) => {
    const r = await api.get(`/relatorio-layouts/templates/${id}`);
    setTemplateAtual({ id: r.data.id, nome: r.data.nome });
    setLayout((r.data.conteudo || []).map(normalizarCampoLayout));
    setSelecionadoId(null);
  };

  const pedirNomeESalvar = () => {
    setNomeInput(templateAtual?.nome || '');
    setNomeModalOpen(true);
  };

  const salvar = async () => {
    if (!nomeInput.trim()) { message.warning('Informe um nome para o modelo'); return; }
    setSaving(true);
    try {
      if (templateAtual) {
        await api.put(`/relatorio-layouts/templates/${templateAtual.id}`, { nome: nomeInput, conteudo: layout });
        setTemplateAtual({ id: templateAtual.id, nome: nomeInput });
        message.success('Modelo atualizado');
      } else {
        const r = await api.post('/relatorio-layouts/templates', { nome: nomeInput, tipo: tipoSelecionado, conteudo: layout });
        setTemplateAtual({ id: r.data.id, nome: nomeInput });
        message.success('Modelo criado');
      }
      setNomeModalOpen(false);
      carregarTemplates(tipoSelecionado);
    } finally {
      setSaving(false);
    }
  };

  const ativar = async () => {
    if (!templateAtual) return;
    await api.post(`/relatorio-layouts/templates/${templateAtual.id}/ativar`, { tipo: tipoSelecionado });
    message.success(`Modelo ativado — passa a ser usado na geração de "${tipoConfig.label}"`);
    carregarTemplates(tipoSelecionado);
  };

  const deletar = async () => {
    if (!templateAtual) return;
    await api.delete(`/relatorio-layouts/templates/${templateAtual.id}`);
    message.success('Modelo excluído');
    abrirNovo();
    carregarTemplates(tipoSelecionado);
  };

  const BASE_CAMPO: Pick<CampoLayout, 'fontFamily' | 'fontSize' | 'color' | 'align' | 'bold' | 'italic' | 'underline' | 'verticalAlign' | 'opacity' | 'rotacao'> = {
    fontFamily: 'Helvetica', fontSize: 9, color: '#000000', align: 'left',
    bold: false, italic: false, underline: false, verticalAlign: 'top', opacity: 1, rotacao: 0,
  };

  const adicionarCampo = (campo: CampoDisponivel) => {
    const novo: CampoLayout = {
      id: novoId(), tipo: 'campo', key: campo.key,
      x: 10, y: 10, largura: 60, altura: 8,
      ...BASE_CAMPO,
    };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarTextoLivre = () => {
    const novo: CampoLayout = {
      id: novoId(), tipo: 'texto_livre', textoFixo: 'Texto',
      x: 10, y: 10, largura: 60, altura: 8,
      ...BASE_CAMPO,
    };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarBlocoParcelas = () => {
    if (layout.some(c => c.tipo === 'bloco:parcelas')) {
      message.warning('Já existe uma tabela de parcelas neste layout');
      return;
    }
    const novo: CampoLayout = {
      id: novoId(), tipo: 'bloco:parcelas',
      x: 10, y: 60, largura: 190, altura: 60,
      ...BASE_CAMPO, fontSize: 8,
    };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarBlocoCompradores = () => {
    if (layout.some(c => c.tipo === 'bloco:compradores')) {
      message.warning('Já existe um bloco de compradores neste layout');
      return;
    }
    const novo: CampoLayout = {
      id: novoId(), tipo: 'bloco:compradores',
      x: 10, y: 100, largura: 190, altura: 30,
      ...BASE_CAMPO,
      subLayout: [], alturaCartao: 30, espacamentoCartao: 4,
    };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarTabelaLotes = () => {
    if (layout.some(c => c.tipo === 'bloco:tabela-lotes')) {
      message.warning('Já existe uma tabela de lotes neste layout');
      return;
    }
    const novo: CampoLayout = {
      id: novoId(), tipo: 'bloco:tabela-lotes',
      x: 10, y: 30, largura: 260, altura: 150,
      ...BASE_CAMPO, fontSize: 8,
      colunas: COLUNAS_LOTES_PADRAO.map(c => ({ ...c })),
    };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarLogo = () => {
    if (layout.some(c => c.tipo === 'logo')) {
      message.warning('Já existe um logotipo neste layout');
      return;
    }
    const novo: CampoLayout = {
      id: novoId(), tipo: 'logo',
      x: 10, y: 10, largura: 25, altura: 25,
      ...BASE_CAMPO,
    };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarRetangulo = () => {
    const novo: CampoLayout = {
      id: novoId(), tipo: 'retangulo',
      x: 10, y: 10, largura: 60, altura: 30,
      ...BASE_CAMPO,
      borderColor: '#000000', borderWidth: 1, borderRadius: 0,
    };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarMarcaDagua = () => {
    const novo: CampoLayout = {
      id: novoId(), tipo: 'texto_livre', textoFixo: 'CONFIDENCIAL',
      x: 15, y: 130, largura: 180, altura: 40,
      ...BASE_CAMPO,
      fontSize: 44, bold: true, color: '#999999', align: 'center', verticalAlign: 'middle',
      opacity: 0.18, rotacao: -35,
    };
    // marca d'água entra no início do layout para ficar atrás dos demais campos
    setLayout(l => [novo, ...l]);
    setSelecionadoId(novo.id);
  };

  const atualizarCampo = (id: string, patch: Partial<CampoLayout>) => {
    setLayout(l => l.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removerCampo = (id: string) => {
    setLayout(l => l.filter(c => c.id !== id));
    setSelecionadoId(null);
  };

  const enviarParaTras = (id: string) => {
    setLayout(l => {
      const campo = l.find(c => c.id === id);
      if (!campo) return l;
      return [campo, ...l.filter(c => c.id !== id)];
    });
  };

  const trazerParaFrente = (id: string) => {
    setLayout(l => {
      const campo = l.find(c => c.id === id);
      if (!campo) return l;
      return [...l.filter(c => c.id !== id), campo];
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Title level={4} style={{ margin: 0 }}>Editor de Relatórios</Title>
          <Select
            style={{ width: 200 }}
            value={tipoSelecionado}
            onChange={trocarTipo}
            options={TIPOS_RELATORIO.map(t => ({ value: t.tipo, label: t.label }))}
          />
        </Space>
        <Space wrap>
          <Select
            placeholder="Modelos salvos"
            style={{ width: 220 }}
            value={templateAtual?.id}
            onChange={abrirTemplate}
            options={templates.map(t => ({
              value: t.id,
              label: <>{t.nome} {t.ativo ? <Tag color="green" style={{ marginLeft: 4 }}>ativo</Tag> : null}</>,
            }))}
            allowClear
            onClear={abrirNovo}
          />
          <Button icon={<PlusOutlined />} onClick={abrirNovo}>Novo</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={pedirNomeESalvar}>
            Salvar
          </Button>
          <Button
            icon={<CheckCircleOutlined />}
            disabled={!templateAtual}
            onClick={ativar}
          >
            Ativar
          </Button>
          <Popconfirm title="Excluir este modelo?" onConfirm={deletar} okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button danger icon={<DeleteOutlined />} disabled={!templateAtual}>Excluir</Button>
          </Popconfirm>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {tipoConfig.familia === 'ordem_entrada' ? (
          <>
            <span style={{ fontSize: 13, color: '#666' }}>Pré-visualizar com leilão:</span>
            <Select
              showSearch
              placeholder="Escolher leilão…"
              style={{ width: 260 }}
              value={leilaoTesteId ?? undefined}
              optionFilterProp="label"
              onChange={(id, option: any) => { setLeilaoTesteId(id); setLeilaoTesteNome(option?.label || ''); }}
              options={leilaoOptions}
              allowClear
              onClear={() => { setLeilaoTesteId(null); setLeilaoTesteNome(''); }}
            />
            {leilaoTesteId && (
              <BlobProvider document={<OrdemEntradaDinamica lotes={lotesTeste} layout={layout} titulo={leilaoTesteNome} empresa={config.empresa} logoBase64={config.logoBase64} />}>
                {({ url, loading }) => (
                  <Button
                    icon={<EyeOutlined />}
                    loading={loading}
                    disabled={!url || layout.length === 0}
                    onClick={() => url && window.open(url, '_blank')}
                  >
                    Pré-visualizar PDF
                  </Button>
                )}
              </BlobProvider>
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, color: '#666' }}>Pré-visualizar com venda:</span>
            <Select
              showSearch
              placeholder="Buscar nota/leilão…"
              style={{ width: 260 }}
              value={vendaTesteId ?? undefined}
              filterOption={false}
              onSearch={buscarVendas}
              onChange={setVendaTesteId}
              options={vendaOptions}
              allowClear
              onClear={() => setVendaTesteId(null)}
            />
            {vendaDados && (
              <BlobProvider
                document={
                  tipoConfig.suportaBlocoCompradores
                    ? <RelatorioFaturaCompradorDinamico dados={vendaDados} layout={layout} empresa={config.empresa} logoBase64={config.logoBase64} titulo={tipoConfig.tituloDocumento} />
                    : <PromissoriaDinamica dados={vendaDados} layout={layout} empresa={config.empresa} logoBase64={config.logoBase64} titulo={tipoConfig.tituloDocumento} />
                }
              >
                {({ url, loading }) => (
                  <Button
                    icon={<EyeOutlined />}
                    loading={loading}
                    disabled={!url || layout.length === 0}
                    onClick={() => url && window.open(url, '_blank')}
                  >
                    Pré-visualizar PDF
                  </Button>
                )}
              </BlobProvider>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 8, minHeight: 0 }}>
        <div style={{ width: 220, border: '1px solid #eee', borderRadius: 4 }}>
          <PaletaCampos
            camposDisponiveis={tipoConfig.campos}
            onAdicionarCampo={adicionarCampo}
            onAdicionarTextoLivre={adicionarTextoLivre}
            onAdicionarLogo={adicionarLogo}
            onAdicionarRetangulo={adicionarRetangulo}
            onAdicionarMarcaDagua={adicionarMarcaDagua}
            onAdicionarBlocoParcelas={tipoConfig.suportaBlocoParcelas ? adicionarBlocoParcelas : undefined}
            onAdicionarTabelaLotes={tipoConfig.suportaTabelaLotes ? adicionarTabelaLotes : undefined}
            onAdicionarBlocoCompradores={tipoConfig.suportaBlocoCompradores ? adicionarBlocoCompradores : undefined}
          />
        </div>

        <CanvasEditor
          larguraMM={tipoConfig.larguraMM}
          alturaMM={tipoConfig.alturaMM}
          gridMM={GRID_MM}
          layout={layout}
          selecionadoId={selecionadoId}
          logoSrc={config.logoBase64}
          resolverRotuloCampo={campo => tipoConfig.campos.find(c => c.key === campo.key)?.label || campo.key || ''}
          onSelecionar={setSelecionadoId}
          onMover={(id, x, y) => atualizarCampo(id, { x, y })}
          onRedimensionar={(id, x, y, largura, altura) => atualizarCampo(id, { x, y, largura, altura })}
        />

        <div style={{ width: 280, border: '1px solid #eee', borderRadius: 4, overflowY: 'auto' }}>
          <PainelPropriedades
            campo={campoSelecionado}
            camposDisponiveis={tipoConfig.campos}
            onChange={patch => campoSelecionado && atualizarCampo(campoSelecionado.id, patch)}
            onRemover={() => campoSelecionado && removerCampo(campoSelecionado.id)}
            onEnviarParaTras={() => campoSelecionado && enviarParaTras(campoSelecionado.id)}
            onTrazerParaFrente={() => campoSelecionado && trazerParaFrente(campoSelecionado.id)}
            onEditarCartao={() => setCartaoAberto(true)}
          />
        </div>
      </div>

      {campoSelecionado && campoSelecionado.tipo === 'bloco:compradores' && (
        <EditorBlocoCartao
          open={cartaoAberto}
          larguraMM={campoSelecionado.largura}
          alturaMM={campoSelecionado.alturaCartao ?? 30}
          subLayout={campoSelecionado.subLayout || []}
          camposDisponiveis={tipoConfig.campos}
          onClose={() => setCartaoAberto(false)}
          onSalvar={subLayout => {
            atualizarCampo(campoSelecionado.id, { subLayout });
            setCartaoAberto(false);
          }}
        />
      )}

      <Modal
        title={templateAtual ? 'Salvar alterações' : 'Novo modelo'}
        open={nomeModalOpen}
        onCancel={() => setNomeModalOpen(false)}
        onOk={salvar}
        confirmLoading={saving}
        okText="Salvar"
      >
        <Input
          value={nomeInput}
          onChange={e => setNomeInput(e.target.value)}
          placeholder="Nome do modelo"
          onPressEnter={salvar}
        />
      </Modal>
    </div>
  );
}
