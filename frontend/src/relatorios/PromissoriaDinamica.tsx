import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { FaturaData } from './RelatorioFaturaCompra';
import { montarContextoPromissoria } from './promissoriaContext';
import { resolverCampo, interpolarTexto } from './promissoriaCampos';
import { CampoLayout, normalizarCampoLayout, resolverFontFamily } from './tipoLayout';
import TabelaParcelasBloco from './TabelaParcelasBloco';

interface Props {
  dados: FaturaData;
  layout: CampoLayout[];
  empresa?: string;
  /** Logotipo da empresa em data URI; se ausente, usa o logotipo padrão do sistema. */
  logoBase64?: string | null;
  /** título usado no Document (metadado do PDF) — este motor serve tanto a Promissória quanto a Nota de Venda */
  titulo?: string;
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

/** Renderiza a Nota Promissória a partir de um layout salvo pelo editor visual (uma página por comprador). */
function PromissoriaDinamica({ dados, layout, empresa, logoBase64, titulo }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const camposNormalizados = layout.map(normalizarCampoLayout);

  return (
    <Document title={`${titulo || 'Promissória'} — Nota ${dados.codnot || dados.id}`} author={nomeEmpresa}>
      {dados.compradores.map((comp, ci) => {
        const ctx = montarContextoPromissoria(dados, comp, empresa);

        return (
          <Page key={ci} size="A4" style={styles.page}>
            {camposNormalizados.map(campo => {
              const pos = posicao(campo);

              if (campo.tipo === 'bloco:parcelas') {
                return (
                  <TabelaParcelasBloco
                    key={campo.id}
                    parcelas={comp.parcelas}
                    qtdCond={comp.qtdparCond}
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
                ? interpolarTexto(campo.textoFixo || '', ctx)
                : resolverCampo(campo.key || '', ctx);

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

export default PromissoriaDinamica;
