import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { ColunaTabela } from './tipoLayout';
import { FaturaUnificadaLote } from './RelatorioFaturaUnificada';

interface Props {
  lotes: FaturaUnificadaLote[];
  colunas: ColunaTabela[];
  fontFamily: string;
  fontSize: number;
  color: string;
  style?: any;
}

const fmtR = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

function valorColuna(lote: FaturaUnificadaLote, key: string): string {
  if (key === 'sinal') {
    const primeira = lote.parcelas.find(p => p.pripar === 'S');
    return fmtR(primeira ? primeira.vlrpar : lote.valorPagar);
  }
  if (key === 'valorOriginal' || key === 'valorPagar') return fmtR((lote as any)[key]);
  const v = (lote as any)[key];
  return v ?? '—';
}

const s = StyleSheet.create({
  tabela: { borderWidth: 0.5, borderColor: '#bbb', borderRadius: 3, overflow: 'hidden', backgroundColor: '#fff' },
  header: { flexDirection: 'row', backgroundColor: '#222', paddingVertical: 3, paddingHorizontal: 4 },
  row: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  rowAlt: { backgroundColor: '#fafafa' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' },
});

/** Tabela de lotes da Fatura Unificada, com colunas configuráveis pelo usuário no editor. */
export default function TabelaLotesFaturaBloco({ lotes, colunas, fontFamily, fontSize, color, style }: Props) {
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
          <View key={lote.idMc} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row} wrap={false}>
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
