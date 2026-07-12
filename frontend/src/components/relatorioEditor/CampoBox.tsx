import { Rnd } from 'react-rnd';
import { CampoLayout } from '../../relatorios/tipoLayout';

interface Props {
  campo: CampoLayout;
  scale: number;    // px por mm
  grid: number;     // grid de snap, em px
  selecionado: boolean;
  logoSrc?: string | null;
  /** rótulo pré-calculado para tipo === 'campo' (o catálogo de campos varia por tipo de relatório) */
  rotuloCampo?: string;
  onSelecionar: () => void;
  onMover: (x: number, y: number) => void;
  onRedimensionar: (x: number, y: number, largura: number, altura: number) => void;
}

const JUSTIFY_H: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start', center: 'center', right: 'flex-end',
};
const ALIGN_V: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start', middle: 'center', bottom: 'flex-end',
};

const RESERVADO_PARA_BLOCO: Record<string, string> = {
  'bloco:parcelas': 'Tabela de Parcelas',
  'bloco:tabela-lotes': 'Tabela de Lotes',
  'bloco:compradores': 'Cartão de Comprador (repete)',
  'bloco:tabela-propriedades': 'Tabela de Propriedades',
  'bloco:tabela-lotes-fatura': 'Tabela de Lotes (Fatura)',
};

export default function CampoBox({ campo, scale, grid, selecionado, logoSrc, rotuloCampo, onSelecionar, onMover, onRedimensionar }: Props) {
  const ehBloco = campo.tipo in RESERVADO_PARA_BLOCO;

  const rotulo = campo.tipo === 'campo'
    ? (rotuloCampo || campo.key || '')
    : campo.tipo === 'texto_livre'
      ? (campo.textoFixo || 'Texto livre')
      : ehBloco
        ? RESERVADO_PARA_BLOCO[campo.tipo]
        : campo.tipo === 'logo'
          ? 'Logotipo'
          : 'Retângulo';

  const ehRetangulo = campo.tipo === 'retangulo';
  const ehLogo = campo.tipo === 'logo';
  const ehTexto = campo.tipo === 'campo' || campo.tipo === 'texto_livre';

  const corFundo = ehRetangulo
    ? (campo.backgroundColor || 'transparent')
    : ehTexto
      ? (campo.backgroundColor || (selecionado ? 'rgba(22,119,255,0.08)' : 'rgba(0,0,0,0.02)'))
      : (selecionado ? 'rgba(22,119,255,0.08)' : 'rgba(0,0,0,0.02)');

  const borda = ehRetangulo
    ? `${campo.borderWidth ?? 1}px solid ${campo.borderColor || '#000'}`
    : (selecionado ? '1.5px solid #1677ff' : '1px dashed #999');

  return (
    <Rnd
      size={{ width: campo.largura * scale, height: campo.altura * scale }}
      position={{ x: campo.x * scale, y: campo.y * scale }}
      dragGrid={[grid, grid]}
      resizeGrid={[grid, grid]}
      bounds="parent"
      onDragStart={onSelecionar}
      onDragStop={(_e, d) => onMover(d.x / scale, d.y / scale)}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        onRedimensionar(
          pos.x / scale,
          pos.y / scale,
          ref.offsetWidth / scale,
          ref.offsetHeight / scale,
        );
      }}
      style={{
        border: borda,
        outline: ehRetangulo && selecionado ? '1.5px solid #1677ff' : undefined,
        outlineOffset: 2,
        backgroundColor: corFundo,
        borderRadius: ehRetangulo ? (campo.borderRadius ?? 0) : 0,
        opacity: campo.opacity ?? 1,
        transform: campo.rotacao ? `rotate(${campo.rotacao}deg)` : undefined,
        display: 'flex',
        flexDirection: 'row',
        alignItems: ALIGN_V[campo.verticalAlign || 'top'],
        justifyContent: JUSTIFY_H[campo.align] || 'flex-start',
        padding: 2,
        overflow: 'hidden',
        cursor: 'move',
        boxSizing: 'border-box',
      }}
      onMouseDown={onSelecionar}
    >
      {ehLogo ? (
        logoSrc
          ? <img src={logoSrc} alt="Logotipo" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
          : <span style={{ fontSize: 10, color: '#999', pointerEvents: 'none' }}>Logotipo</span>
      ) : ehRetangulo ? null : (
        <span
          style={{
            fontFamily: ehBloco ? undefined : campo.fontFamily,
            fontWeight: !ehBloco && campo.bold ? 'bold' : 'normal',
            fontStyle: !ehBloco && campo.italic ? 'italic' : 'normal',
            textDecoration: !ehBloco && campo.underline ? 'underline' : 'none',
            fontSize: ehBloco ? 11 : Math.max(campo.fontSize * (scale / 2.834645669), 8),
            color: ehBloco ? '#777' : campo.color,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {campo.tipo === 'campo' ? `{{${rotulo}}}` : rotulo}
        </span>
      )}
    </Rnd>
  );
}
