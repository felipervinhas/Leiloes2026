import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { CampoLayout, normalizarCampoLayout, resolverFontFamily } from './tipoLayout';
import { montarContextoOrdemEntrada } from './ordemEntradaContext';
import { resolverCampoOrdemEntrada, interpolarTextoOrdemEntrada, LoteOrdemPDF } from './ordemEntradaCampos';
import TabelaLotesBloco from './TabelaLotesBloco';

interface Props {
  lotes: LoteOrdemPDF[];
  layout: CampoLayout[];
  titulo?: string;
  empresa?: string;
  logoBase64?: string | null;
  orientacao?: 'retrato' | 'paisagem';
}

const MM_TO_PT = 2.834645669;

const styles = StyleSheet.create({
  page: { position: 'relative', backgroundColor: '#fff' },
});

function posicao(campo: CampoLayout) {
  return {
    position: 'absolute' as const,
    left: campo.x * MM_TO_PT,
    top: campo.y * MM_TO_PT,
    width: campo.largura * MM_TO_PT,
    height: campo.altura * MM_TO_PT,
    opacity: campo.opacity ?? 1,
    transform: campo.rotacao ? `rotate(${campo.rotacao}deg)` : undefined,
  };
}

const JUSTIFY_V: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start', middle: 'center', bottom: 'flex-end',
};

/** Espaço mínimo (pt) da área da tabela por página — evita layout impossível se a caixa desenhada for baixa demais. */
const ALTURA_MINIMA_TABELA = 60;

/** Renderiza a Ordem de Entrada a partir de um layout salvo pelo editor visual.
 * A tabela de lotes flui por quantas páginas forem necessárias, sempre dentro da
 * faixa vertical da caixa desenhada; os demais elementos (logo, textos, retângulos)
 * se repetem em todas as páginas. */
function OrdemEntradaDinamica({ lotes, layout, titulo, empresa, logoBase64, orientacao = 'paisagem' }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const ctx = montarContextoOrdemEntrada(titulo, nomeEmpresa, lotes);
  const camposNormalizados = layout.map(normalizarCampoLayout);
  const pageSize = orientacao === 'paisagem' ? ([841.89, 595.28] as [number, number]) : 'A4';
  const alturaPagina = orientacao === 'paisagem' ? 595.28 : 841.89;

  // Só a primeira tabela flui entre páginas; as outras (caso raro) ficam fixas na posição desenhada.
  const tabela = camposNormalizados.find(c => c.tipo === 'bloco:tabela-lotes');
  const topoTabela = tabela ? tabela.y * MM_TO_PT : 0;
  const rodapeTabela = tabela
    ? Math.max(0, Math.min(alturaPagina - (tabela.y + tabela.altura) * MM_TO_PT, alturaPagina - topoTabela - ALTURA_MINIMA_TABELA))
    : 0;

  return (
    <Document title={`Ordem de Entrada — ${titulo || ''}`} author={nomeEmpresa}>
      <Page size={pageSize} style={[styles.page, { paddingTop: topoTabela, paddingBottom: rodapeTabela }]}>
        {/* Camada fixa: repete logo, textos e retângulos em todas as páginas */}
        <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: alturaPagina }}>
          {camposNormalizados.map(campo => {
            if (campo === tabela) return null;
            const pos = posicao(campo);

            if (campo.tipo === 'bloco:tabela-lotes') {
              return (
                <TabelaLotesBloco
                  key={campo.id}
                  lotes={lotes}
                  colunas={campo.colunas || []}
                  fontFamily={resolverFontFamily(campo.fontFamily, campo.bold, campo.italic)}
                  fontSize={campo.fontSize}
                  color={campo.color}
                  style={pos}
                />
              );
            }

            if (campo.tipo === 'logo') {
              return <Image key={campo.id} src={logoBase64 || logotipoLocal} style={pos} />;
            }

            if (campo.tipo === 'retangulo') {
              return (
                <View
                  key={campo.id}
                  style={{
                    ...pos,
                    backgroundColor: campo.backgroundColor || 'transparent',
                    borderColor: campo.borderColor || '#000000',
                    borderWidth: campo.borderWidth ?? 0,
                    borderRadius: campo.borderRadius ?? 0,
                    borderStyle: 'solid',
                  }}
                />
              );
            }

            const texto = campo.tipo === 'texto_livre'
              ? interpolarTextoOrdemEntrada(campo.textoFixo || '', ctx)
              : resolverCampoOrdemEntrada(campo.key || '', ctx);

            return (
              <View
                key={campo.id}
                style={{
                  ...pos,
                  flexDirection: 'column',
                  justifyContent: JUSTIFY_V[campo.verticalAlign || 'top'],
                }}
              >
                <Text
                  style={{
                    fontFamily: resolverFontFamily(campo.fontFamily, campo.bold, campo.italic),
                    textDecoration: campo.underline ? 'underline' : undefined,
                    fontSize: campo.fontSize,
                    color: campo.color,
                    textAlign: campo.align,
                    backgroundColor: campo.backgroundColor || undefined,
                    padding: campo.backgroundColor ? 2 : 0,
                  }}
                >
                  {texto}
                </Text>
              </View>
            );
          })}
        </View>
        {tabela && (
          <TabelaLotesBloco
            lotes={lotes}
            colunas={tabela.colunas || []}
            fontFamily={resolverFontFamily(tabela.fontFamily, tabela.bold, tabela.italic)}
            fontSize={tabela.fontSize}
            color={tabela.color}
            style={{ marginLeft: tabela.x * MM_TO_PT, width: tabela.largura * MM_TO_PT, opacity: tabela.opacity ?? 1 }}
          />
        )}
      </Page>
    </Document>
  );
}

export default OrdemEntradaDinamica;
