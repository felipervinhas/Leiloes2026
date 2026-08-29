import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { fmtData, fmtR } from './promissoriaUtils';

interface Parcela {
  ordxxx?: string;
  datven?: string;
  vlrpar?: number;
  pripar?: string;
}

interface Props {
  parcelas: Parcela[];
  qtdCond?: number | null;
  /** Estilo extra (ex.: posicionamento absoluto no editor de layout). */
  style?: any;
  /** Quantos grupos #/Vencimento/Valor lado a lado por linha (default 4). */
  colunas?: number;
}

const PRETO  = '#000';
const ESCURO = '#222';
const CINZA  = '#bbb';
const CLARO  = '#f0f0f0';

const s = StyleSheet.create({
  tabelaBox: {
    borderRadius: 3, borderWidth: 0.5, borderColor: CINZA,
    marginBottom: 6, overflow: 'hidden', backgroundColor: '#fff',
  },
  tabelaHeader: {
    backgroundColor: ESCURO, flexDirection: 'row', flexShrink: 0,
    paddingVertical: 2, paddingHorizontal: 4,
  },
  tabelaRow: {
    flexDirection: 'row', flexShrink: 0, paddingVertical: 3.5, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: CLARO,
  },
  tabelaRowAlt: { backgroundColor: '#fafafa' },
  tabelaTotal: {
    backgroundColor: CLARO, flexDirection: 'row', flexShrink: 0,
    paddingVertical: 3, paddingHorizontal: 4,
  },
  cGrupo:    { flex: 1, flexDirection: 'row', paddingRight: 8 },
  cGrupoSep: { borderLeftWidth: 0.5, borderLeftColor: CINZA, paddingLeft: 10 },
  cNum:  { width: 20 },
  cData: { flex: 1, paddingLeft: 6 },
  cValor:{ width: 56, textAlign: 'right' },
  th:      { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' },
  td:      { fontSize: 6.5, color: ESCURO },
  tdRight: { fontSize: 6.5, color: ESCURO, textAlign: 'right' },
  tdBold:  { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PRETO },
  tdBoldRight: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PRETO, textAlign: 'right' },
});

/** Tabela de parcelas (N grupos por linha, default 4) usada tanto no relatório estático quanto no dinâmico. */
export default function TabelaParcelasBloco({ parcelas, qtdCond, style, colunas = 4 }: Props) {
  const totalParcelas = parcelas.reduce((a, p) => a + (p.vlrpar ?? 0), 0);
  const grupos = Array.from({ length: colunas }, (_, g) => g);

  const linhas: (Parcela | null)[][] = [];
  for (let i = 0; i < parcelas.length; i += colunas) {
    linhas.push(grupos.map(g => parcelas[i + g] ?? null));
  }

  return (
    <View style={style ? [s.tabelaBox, style] : s.tabelaBox}>
      <View style={s.tabelaHeader}>
        {grupos.map(g => (
          <View key={g} style={[s.cGrupo, g > 0 ? s.cGrupoSep : {}]}>
            <View style={s.cNum}><Text style={s.th}>#</Text></View>
            <View style={s.cData}><Text style={s.th}>Vencimento</Text></View>
            <View style={s.cValor}><Text style={s.thRight}>Valor</Text></View>
          </View>
        ))}
      </View>

      {parcelas.length === 0 ? (
        <Text style={{ padding: 10, textAlign: 'center', fontSize: 7.5, color: '#aaa', fontStyle: 'italic' }}>
          Parcelas ainda não geradas
        </Text>
      ) : (
        linhas.map((linha, li) => (
          <View key={li} wrap={false}
            style={[s.tabelaRow, li % 2 === 1 ? s.tabelaRowAlt : {}]}>
            {linha.map((p, gi) => (
              <View key={gi} style={[s.cGrupo, gi > 0 ? s.cGrupoSep : {}]}>
                {p ? (
                  <>
                    <View style={s.cNum}>
                      <Text style={p.pripar === 'S' ? s.tdBold : s.td}>
                        {p.ordxxx ?? String(li * 4 + gi + 1).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={s.cData}>
                      <Text style={p.pripar === 'S' ? s.tdBold : s.td}>
                        {fmtData(p.datven)}
                      </Text>
                    </View>
                    <View style={s.cValor}>
                      <Text style={p.pripar === 'S' ? s.tdBoldRight : s.tdRight}>
                        {fmtR(p.vlrpar)}
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}

      {parcelas.length > 0 && (
        <View style={s.tabelaTotal}>
          <Text style={{ flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>
            {(() => {
              const qtd = qtdCond ?? parcelas.length;
              return `TOTAL — ${qtd} parcela${qtd !== 1 ? 's' : ''}`;
            })()}
          </Text>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO }}>
            {fmtR(totalParcelas)}
          </Text>
        </View>
      )}
    </View>
  );
}
