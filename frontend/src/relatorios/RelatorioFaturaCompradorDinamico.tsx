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
  logoBase64?: string | null;
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
    opacity: campo.opacity ?? 1,
    transform: campo.rotacao ? `rotate(${campo.rotacao}deg)` : undefined,
  };
}

const JUSTIFY_V: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start', middle: 'center', bottom: 'flex-end',
};

/** Renderiza um campo "de texto" (campo ou texto_livre) do tipo genérico, absolutamente posicionado. */
function CampoTexto({ campo, texto, altura }: { campo: CampoLayout; texto: string; altura?: number }) {
  return (
    <View
      style={{
        ...posicao(campo),
        height: altura,
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
}

/**
 * Renderiza a Fatura de Comprador a partir de um layout salvo pelo editor visual.
 * Diferente da Promissória/Nota de Leilão: é UMA página única, com campos fixos
 * (cabeçalho, lote, vendedor) mais um bloco "de compradores" que se repete em
 * fluxo normal do documento (empilhado, com quebra de página automática).
 */
function RelatorioFaturaCompradorDinamico({ dados, layout, empresa, logoBase64, titulo }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const camposNormalizados = layout.map(normalizarCampoLayout);
  // contexto "neutro" para campos fixos que referenciem comp.* fora do bloco de compradores
  const ctxCabecalho = montarContextoPromissoria(dados, dados.compradores[0] || ({} as any), empresa);

  return (
    <Document title={`${titulo || 'Fatura'} — Nota ${dados.codnot || dados.id}`} author={nomeEmpresa}>
      <Page size="A4" style={styles.page}>
        {camposNormalizados.map(campo => {
          if (campo.tipo === 'bloco:compradores') {
            const alturaCartaoPt = (campo.alturaCartao ?? 30) * MM_TO_PT;
            const espacamentoPt = (campo.espacamentoCartao ?? 4) * MM_TO_PT;
            const subLayout = (campo.subLayout || []).map(normalizarCampoLayout);

            return (
              <View key={campo.id} style={{ position: 'absolute', left: campo.x * MM_TO_PT, top: campo.y * MM_TO_PT, width: campo.largura * MM_TO_PT }}>
                {dados.compradores.map((comp, i) => {
                  const ctx = montarContextoPromissoria(dados, comp, empresa);
                  return (
                    <View
                      key={comp.id}
                      wrap={false}
                      style={{
                        position: 'relative',
                        width: campo.largura * MM_TO_PT,
                        height: alturaCartaoPt,
                        marginBottom: i < dados.compradores.length - 1 ? espacamentoPt : 0,
                      }}
                    >
                      {subLayout.map(sub => {
                        if (sub.tipo === 'bloco:parcelas') {
                          return (
                            <TabelaParcelasBloco
                              key={sub.id}
                              parcelas={comp.parcelas}
                              qtdCond={comp.qtdparCond}
                              style={posicao(sub)}
                            />
                          );
                        }
                        if (sub.tipo === 'retangulo') {
                          return (
                            <View
                              key={sub.id}
                              style={{
                                ...posicao(sub),
                                height: sub.altura * MM_TO_PT,
                                backgroundColor: sub.backgroundColor || 'transparent',
                                borderColor: sub.borderColor || '#000000',
                                borderWidth: sub.borderWidth ?? 0,
                                borderRadius: sub.borderRadius ?? 0,
                                borderStyle: 'solid',
                              }}
                            />
                          );
                        }
                        const texto = sub.tipo === 'texto_livre'
                          ? interpolarTexto(sub.textoFixo || '', ctx)
                          : resolverCampo(sub.key || '', ctx);
                        return <CampoTexto key={sub.id} campo={sub} texto={texto} altura={sub.altura * MM_TO_PT} />;
                      })}
                    </View>
                  );
                })}
              </View>
            );
          }

          if (campo.tipo === 'bloco:parcelas') {
            // parcelas na região fixa: usa o primeiro comprador como referência
            return (
              <TabelaParcelasBloco
                key={campo.id}
                parcelas={dados.compradores[0]?.parcelas || []}
                qtdCond={dados.compradores[0]?.qtdparCond}
                style={{ ...posicao(campo), height: campo.altura * MM_TO_PT }}
              />
            );
          }

          if (campo.tipo === 'logo') {
            return <Image key={campo.id} src={logoBase64 || logotipoLocal} style={{ ...posicao(campo), height: campo.altura * MM_TO_PT }} />;
          }

          if (campo.tipo === 'retangulo') {
            return (
              <View
                key={campo.id}
                style={{
                  ...posicao(campo),
                  height: campo.altura * MM_TO_PT,
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
            ? interpolarTexto(campo.textoFixo || '', ctxCabecalho)
            : resolverCampo(campo.key || '', ctxCabecalho);
          return <CampoTexto key={campo.id} campo={campo} texto={texto} altura={campo.altura * MM_TO_PT} />;
        })}
      </Page>
    </Document>
  );
}

export default RelatorioFaturaCompradorDinamico;
