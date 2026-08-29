import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { ColunaTabela } from './tipoLayout';
import { PropriedadeFichaPDF } from './fichaClienteCampos';

interface Props {
  propriedades: PropriedadeFichaPDF[];
  colunas: ColunaTabela[];
  /** fonte já resolvida (variante negrito/itálico embutida no nome, ex. "Helvetica-Bold") */
  fontFamily: string;
  fontSize: number;
  color: string;
  style?: any;
}

function valorColuna(p: PropriedadeFichaPDF, key: string): string {
  const v = (p as any)[key];
  return v ?? '—';
}

const s = StyleSheet.create({
  tabela: { borderWidth: 0.5, borderColor: '#bbb', borderRadius: 3, overflow: 'hidden', backgroundColor: '#fff' },
  header: { flexDirection: 'row', flexShrink: 0, backgroundColor: '#222', paddingVertical: 3, paddingHorizontal: 4 },
  row: { flexDirection: 'row', flexShrink: 0, paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  rowAlt: { backgroundColor: '#fafafa' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' },
});

/** Tabela de propriedades do cliente, com colunas configuráveis pelo usuário no editor (visibilidade, ordem, largura). */
export default function TabelaPropriedadesBloco({ propriedades, colunas, fontFamily, fontSize, color, style }: Props) {
  const visiveis = colunas.filter(c => c.visivel);
  const totalLargura = visiveis.reduce((a, c) => a + c.largura, 0) || 1;

  return (
    <View style={style ? [s.tabela, style] : s.tabela}>
      <View style={s.header}>
        {visiveis.map(c => (
          <Text key={c.key} style={[s.th, { width: `${(c.largura / totalLargura) * 100}%` }]}>{c.label}</Text>
        ))}
      </View>
      {propriedades.length === 0 ? (
        <Text style={{ padding: 10, textAlign: 'center', fontSize: 7.5, color: '#aaa', fontStyle: 'italic' }}>
          Nenhuma propriedade cadastrada
        </Text>
      ) : (
        propriedades.map((p, i) => (
          <View key={p.id} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row} wrap={false}>
            {visiveis.map(c => (
              <Text
                key={c.key}
                style={{
                  width: `${(c.largura / totalLargura) * 100}%`,
                  fontFamily, fontSize, color,
                }}
              >
                {valorColuna(p, c.key)}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}
