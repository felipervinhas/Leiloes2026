import { Button, Collapse } from 'antd';
import { PlusOutlined, TableOutlined, FontSizeOutlined, PictureOutlined, BorderOutlined, EyeInvisibleOutlined, TeamOutlined } from '@ant-design/icons';
import { CampoDisponivel } from '../../relatorios/promissoriaCampos';

interface Props {
  camposDisponiveis: CampoDisponivel[];
  onAdicionarCampo: (campo: CampoDisponivel) => void;
  onAdicionarTextoLivre: () => void;
  onAdicionarRetangulo: () => void;
  onAdicionarLogo?: () => void;
  onAdicionarMarcaDagua?: () => void;
  onAdicionarBlocoParcelas?: () => void;
  onAdicionarTabelaLotes?: () => void;
  onAdicionarBlocoCompradores?: () => void;
}

export default function PaletaCampos({
  camposDisponiveis, onAdicionarCampo, onAdicionarTextoLivre, onAdicionarLogo, onAdicionarRetangulo, onAdicionarMarcaDagua,
  onAdicionarBlocoParcelas, onAdicionarTabelaLotes, onAdicionarBlocoCompradores,
}: Props) {
  const grupos = Array.from(new Set(camposDisponiveis.map(c => c.grupo)));

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '8px 8px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Button block icon={<FontSizeOutlined />} onClick={onAdicionarTextoLivre}>
          Texto livre
        </Button>
        {onAdicionarBlocoParcelas && (
          <Button block icon={<TableOutlined />} onClick={onAdicionarBlocoParcelas}>
            Tabela de parcelas
          </Button>
        )}
        {onAdicionarTabelaLotes && (
          <Button block icon={<TableOutlined />} onClick={onAdicionarTabelaLotes}>
            Tabela de lotes
          </Button>
        )}
        {onAdicionarBlocoCompradores && (
          <Button block icon={<TeamOutlined />} onClick={onAdicionarBlocoCompradores}>
            Bloco de compradores
          </Button>
        )}
        {onAdicionarLogo && (
          <Button block icon={<PictureOutlined />} onClick={onAdicionarLogo}>
            Logotipo
          </Button>
        )}
        <Button block icon={<BorderOutlined />} onClick={onAdicionarRetangulo}>
          Retângulo / quadrado
        </Button>
        {onAdicionarMarcaDagua && (
          <Button block icon={<EyeInvisibleOutlined />} onClick={onAdicionarMarcaDagua}>
            Marca d'água
          </Button>
        )}
      </div>
      <Collapse
        ghost
        defaultActiveKey={grupos[0] ? [grupos[0]] : []}
        items={grupos.map(grupo => ({
          key: grupo,
          label: grupo,
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {camposDisponiveis.filter(c => c.grupo === grupo).map(campo => (
                <Button
                  key={campo.key}
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => onAdicionarCampo(campo)}
                  style={{ textAlign: 'left', justifyContent: 'flex-start', display: 'flex', width: '100%' }}
                >
                  {campo.label}
                </Button>
              ))}
            </div>
          ),
        }))}
      />
    </div>
  );
}
