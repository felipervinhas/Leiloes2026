import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { ColunaTabela } from './tipoLayout';
import { LoteOrdemPDF } from './ordemEntradaCampos';

interface Props {
  lotes: LoteOrdemPDF[];
  colunas: ColunaTabela[];
  /** fonte já resolvida (variante negrito/itálico embutida no nome, ex. "Helvetica-Bold") */
  fontFamily: string;
  fontSize: number;
  color: string;
  style?: any;
}

const SEXO: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro', C: 'Castrado' };

function valorColuna(lote: LoteOrdemPDF, key: string): string {
  const v = (lote as any)[key];
  if (key === 'catego') return SEXO[v as string] || v || '—';
  return v ?? '—';
}

const s = StyleSheet.create({
  tabela: { borderWidth: 0.5, borderColor: '#bbb', borderRadius: 3, overflow: 'hidden', backgroundColor: '#fff' },
  header: { flexDirection: 'row', flexShrink: 0, backgroundColor: '#222', paddingVertical: 3, paddingHorizontal: 4 },
  row: { flexDirection: 'row', flexShrink: 0, paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  rowAlt: { backgroundColor: '#fafafa' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' },
});

/** Tabela de lotes com colunas configuráveis pelo usuário no editor (visibilidade, ordem, largura). */
export default function TabelaLotesBloco({ lotes, colunas, fontFamily, fontSize, color, style }: Props) {
  const visiveis = colunas.filter(c => c.visivel);
  const totalLargura = visiveis.reduce((a, c) => a + c.largura, 0) || 1;

  return (
    <View style={style ? [s.tabela, style] : s.tabela}>
      <View style={s.header}>
        {visiveis.map(c => (
          <Text key={c.key} style={[s.th, { width: `${(c.largura / totalLargura) * 100}%` }]}>{c.label}</Text>
        ))}
      </View>
      {lotes.length === 0 ? (
        <Text style={{ padding: 10, textAlign: 'center', fontSize: 7.5, color: '#aaa', fontStyle: 'italic' }}>
          Nenhum lote encontrado
        </Text>
      ) : (
        lotes.map((lote, i) => (
          <View key={lote.id} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row} wrap={false}>
            {visiveis.map(c => (
              <Text
                key={c.key}
                style={{
                  width: `${(c.largura / totalLargura) * 100}%`,
                  fontFamily, fontSize, color,
                }}
              >
                {valorColuna(lote, c.key)}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}
