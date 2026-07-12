import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { CampoLayout, normalizarCampoLayout, resolverFontFamily } from './tipoLayout';
import { montarContextoFaturaUnificada } from './faturaUnificadaContext';
import { resolverCampoFaturaUnificada, interpolarTextoFaturaUnificada } from './faturaUnificadaCampos';
import { FaturaUnificadaGrupo } from './RelatorioFaturaUnificada';
import TabelaLotesFaturaBloco from './TabelaLotesFaturaBloco';

interface Props {
  grupos: FaturaUnificadaGrupo[];
  layout: CampoLayout[];
  empresa?: string;
  logoBase64?: string | null;
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

/** Renderiza a Fatura Unificada (uma página por grupo comprador+vendedor+leilão) a partir de um layout salvo pelo editor. */
function FaturaUnificadaDinamica({ grupos, layout, empresa, logoBase64 }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const camposNormalizados = layout.map(normalizarCampoLayout);

  return (
    <Document title="Fatura Unificada" author={nomeEmpresa}>
      {grupos.map((grupo, gi) => {
        const ctx = montarContextoFaturaUnificada(grupo, nomeEmpresa);
        return (
          <Page key={gi} size="A4" style={styles.page}>
            {camposNormalizados.map(campo => {
              const pos = posicao(campo);

              if (campo.tipo === 'bloco:tabela-lotes-fatura') {
                return (
                  <TabelaLotesFaturaBloco
                    key={campo.id}
                    lotes={grupo.lotes}
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
                ? interpolarTextoFaturaUnificada(campo.textoFixo || '', ctx)
                : resolverCampoFaturaUnificada(campo.key || '', ctx);

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
          </Page>
        );
      })}
    </Document>
  );
}

export default FaturaUnificadaDinamica;
