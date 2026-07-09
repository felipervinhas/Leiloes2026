import { Empty } from 'antd';
import { CampoLayout } from '../../relatorios/tipoLayout';
import CampoBox from './CampoBox';

export const SCALE_MM_PX = 96 / 25.4; // px por mm (96dpi)

interface Props {
  larguraMM: number;
  alturaMM: number;
  gridMM?: number;
  layout: CampoLayout[];
  selecionadoId: string | null;
  logoSrc?: string | null;
  mensagemVazio?: string;
  /** resolve o rótulo exibido para campos do tipo 'campo' (o catálogo varia por tipo de relatório) */
  resolverRotuloCampo?: (campo: CampoLayout) => string;
  onSelecionar: (id: string | null) => void;
  onMover: (id: string, x: number, y: number) => void;
  onRedimensionar: (id: string, x: number, y: number, largura: number, altura: number) => void;
}

/** Canvas de edição de layout (drag-and-drop com grid de snap), reutilizado tanto no editor de página quanto no editor de cartões repetidos. */
export default function CanvasEditor({
  larguraMM, alturaMM, gridMM = 4, layout, selecionadoId, logoSrc, mensagemVazio, resolverRotuloCampo,
  onSelecionar, onMover, onRedimensionar,
}: Props) {
  const gridPx = gridMM * SCALE_MM_PX;

  return (
    <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#f0f2f5', borderRadius: 4, padding: 24 }}>
      <div
        onMouseDown={e => { if (e.target === e.currentTarget) onSelecionar(null); }}
        style={{
          position: 'relative',
          width: larguraMM * SCALE_MM_PX,
          height: alturaMM * SCALE_MM_PX,
          margin: '0 auto',
          backgroundColor: '#fff',
          boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
          backgroundImage: 'linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)',
          backgroundSize: `${gridPx}px ${gridPx}px`,
        }}
      >
        {layout.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description={mensagemVazio || 'Arraste campos da paleta à esquerda para começar'} />
          </div>
        )}
        {layout.map(campo => (
          <CampoBox
            key={campo.id}
            campo={campo}
            scale={SCALE_MM_PX}
            grid={gridPx}
            selecionado={campo.id === selecionadoId}
            logoSrc={logoSrc}
            rotuloCampo={resolverRotuloCampo?.(campo)}
            onSelecionar={() => onSelecionar(campo.id)}
            onMover={(x, y) => onMover(campo.id, x, y)}
            onRedimensionar={(x, y, largura, altura) => onRedimensionar(campo.id, x, y, largura, altura)}
          />
        ))}
      </div>
    </div>
  );
}
