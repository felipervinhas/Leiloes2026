import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { CampoLayout, normalizarCampoLayout, resolverFontFamily } from './tipoLayout';
import { montarContextoFichaCliente, ClienteFichaPDF } from './fichaClienteContext';
import { resolverCampoFichaCliente, interpolarTextoFichaCliente, PropriedadeFichaPDF } from './fichaClienteCampos';
import TabelaPropriedadesBloco from './TabelaPropriedadesBloco';

interface Props {
  cliente: ClienteFichaPDF;
  propriedades: PropriedadeFichaPDF[];
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

/** Renderiza a Ficha de Cliente a partir de um layout salvo pelo editor visual (página única A4). */
function FichaClienteDinamica({ cliente, propriedades, layout, empresa, logoBase64 }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const ctx = montarContextoFichaCliente(cliente, nomeEmpresa, propriedades.length);
  const camposNormalizados = layout.map(normalizarCampoLayout);

  return (
    <Document title={`Ficha de Cliente — ${cliente.nomexx || ''}`} author={nomeEmpresa}>
      <Page size="A4" style={styles.page}>
        {camposNormalizados.map(campo => {
          const pos = posicao(campo);

          if (campo.tipo === 'bloco:tabela-propriedades') {
            return (
              <TabelaPropriedadesBloco
                key={campo.id}
                propriedades={propriedades}
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
            ? interpolarTextoFichaCliente(campo.textoFixo || '', ctx)
            : resolverCampoFichaCliente(campo.key || '', ctx);

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
    </Document>
  );
}

export default FichaClienteDinamica;
