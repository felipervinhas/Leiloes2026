import { useEffect, useState } from 'react';
import { Button, Drawer, Space } from 'antd';
import CanvasEditor from './CanvasEditor';
import PaletaCampos from './PaletaCampos';
import PainelPropriedades from './PainelPropriedades';
import { CampoLayout } from '../../relatorios/tipoLayout';
import { CampoDisponivel } from '../../relatorios/promissoriaCampos';

interface Props {
  open: boolean;
  larguraMM: number;
  alturaMM: number;
  subLayout: CampoLayout[];
  camposDisponiveis: CampoDisponivel[];
  onClose: () => void;
  onSalvar: (subLayout: CampoLayout[]) => void;
}

const novoId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c${Date.now()}_${Math.random()}`;

const BASE_CAMPO: Pick<CampoLayout, 'fontFamily' | 'fontSize' | 'color' | 'align' | 'bold' | 'italic' | 'underline' | 'verticalAlign' | 'opacity' | 'rotacao'> = {
  fontFamily: 'Helvetica', fontSize: 8, color: '#000000', align: 'left',
  bold: false, italic: false, underline: false, verticalAlign: 'top', opacity: 1, rotacao: 0,
};

/** Editor do mini-layout de um "cartão" que se repete uma vez por comprador na Fatura. */
export default function EditorBlocoCartao({ open, larguraMM, alturaMM, subLayout, camposDisponiveis, onClose, onSalvar }: Props) {
  const [layout, setLayout] = useState<CampoLayout[]>(subLayout);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setLayout(subLayout); setSelecionadoId(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const campoSelecionado = layout.find(c => c.id === selecionadoId) || null;

  const adicionarCampo = (campo: CampoDisponivel) => {
    const novo: CampoLayout = { id: novoId(), tipo: 'campo', key: campo.key, x: 5, y: 5, largura: 60, altura: 6, ...BASE_CAMPO };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarTextoLivre = () => {
    const novo: CampoLayout = { id: novoId(), tipo: 'texto_livre', textoFixo: 'Texto', x: 5, y: 5, largura: 60, altura: 6, ...BASE_CAMPO };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarBlocoParcelas = () => {
    if (layout.some(c => c.tipo === 'bloco:parcelas')) return;
    const novo: CampoLayout = { id: novoId(), tipo: 'bloco:parcelas', x: 5, y: Math.max(20, alturaMM - 35), largura: larguraMM - 10, altura: 30, ...BASE_CAMPO };
    setLayout(l => [...l, novo]);
    setSelecionadoId(novo.id);
  };

  const adicionarRetangulo = () => {
    const novo: CampoLayout = { id: novoId(), tipo: 'retangulo', x: 0, y: 0, largura: larguraMM, altura: alturaMM, ...BASE_CAMPO, borderColor: '#000000', borderWidth: 0.5, borderRadius: 2 };
    setLayout(l => [novo, ...l]);
    setSelecionadoId(novo.id);
  };

  const atualizarCampo = (id: string, patch: Partial<CampoLayout>) => setLayout(l => l.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const removerCampo = (id: string) => { setLayout(l => l.filter(c => c.id !== id)); setSelecionadoId(null); };
  const enviarParaTras = (id: string) => setLayout(l => { const c = l.find(x => x.id === id); return c ? [c, ...l.filter(x => x.id !== id)] : l; });
  const trazerParaFrente = (id: string) => setLayout(l => { const c = l.find(x => x.id === id); return c ? [...l.filter(x => x.id !== id), c] : l; });

  return (
    <Drawer
      title="Editar cartão do comprador (se repete uma vez por comprador)"
      open={open}
      onClose={onClose}
      width="90%"
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" onClick={() => onSalvar(layout)}>Salvar cartão</Button>
        </Space>
      }
      bodyStyle={{ padding: 12, height: '100%' }}
    >
      <div style={{ display: 'flex', height: '100%', gap: 8 }}>
        <div style={{ width: 220, border: '1px solid #eee', borderRadius: 4 }}>
          <PaletaCampos
            camposDisponiveis={camposDisponiveis}
            onAdicionarCampo={adicionarCampo}
            onAdicionarTextoLivre={adicionarTextoLivre}
            onAdicionarRetangulo={adicionarRetangulo}
            onAdicionarBlocoParcelas={adicionarBlocoParcelas}
          />
        </div>

        <CanvasEditor
          larguraMM={larguraMM}
          alturaMM={alturaMM}
          gridMM={2}
          layout={layout}
          selecionadoId={selecionadoId}
          mensagemVazio="Monte aqui os campos que aparecem em cada comprador"
          resolverRotuloCampo={campo => camposDisponiveis.find(c => c.key === campo.key)?.label || campo.key || ''}
          onSelecionar={setSelecionadoId}
          onMover={(id, x, y) => atualizarCampo(id, { x, y })}
          onRedimensionar={(id, x, y, largura, altura) => atualizarCampo(id, { x, y, largura, altura })}
        />

        <div style={{ width: 280, border: '1px solid #eee', borderRadius: 4, overflowY: 'auto' }}>
          <PainelPropriedades
            campo={campoSelecionado}
            camposDisponiveis={camposDisponiveis}
            onChange={patch => campoSelecionado && atualizarCampo(campoSelecionado.id, patch)}
            onRemover={() => campoSelecionado && removerCampo(campoSelecionado.id)}
            onEnviarParaTras={() => campoSelecionado && enviarParaTras(campoSelecionado.id)}
            onTrazerParaFrente={() => campoSelecionado && trazerParaFrente(campoSelecionado.id)}
          />
        </div>
      </div>
    </Drawer>
  );
}
