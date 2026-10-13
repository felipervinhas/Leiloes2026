import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';

// Modelo único dos relatórios do Financeiro (Pendências, Repasses, Recebimentos):
// cabeçalho com logo e período, faixa de resumo e uma tabela que quebra de página
// repetindo o cabeçalho das colunas. Mesmo estilo dos relatórios do sistema de leilões.

export interface ColunaPDF { titulo: string; flex?: number; direita?: boolean }
export interface LinhaPDF { celulas: string[]; destaque?: boolean; recuo?: boolean }

interface Props {
  titulo: string;
  subtitulo?: string;
  empresa?: string;
  logoBase64?: string | null;
  resumo?: { label: string; valor: string }[];
  colunas: ColunaPDF[];
  linhas: LinhaPDF[];
  total?: string[];
  rodapeNota?: string;
}

const ESCURO = '#222', MEDIO = '#555', CINZA = '#bbb', CLARO = '#f0f0f0';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 7.5, color: '#222', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  header: {
    borderBottomColor: ESCURO, borderBottomWidth: 2, paddingHorizontal: 6, paddingVertical: 8, marginBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 140, height: 44, objectFit: 'contain', marginRight: 12 },
  titulo: { color: ESCURO, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  sub: { color: MEDIO, fontSize: 7.5, marginTop: 2 },
  data: { color: MEDIO, fontSize: 7 },
  resumo: {
    flexDirection: 'row', backgroundColor: CLARO, borderRadius: 4, borderColor: CINZA, borderWidth: 1,
    marginBottom: 7, paddingVertical: 6, paddingHorizontal: 8,
  },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoLabel: { fontSize: 6, color: '#888', marginBottom: 2 },
  resumoValor: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  thRow: { flexDirection: 'row', backgroundColor: ESCURO, paddingVertical: 4, paddingHorizontal: 4 },
  th: { color: '#fff', fontSize: 6.8, fontFamily: 'Helvetica-Bold' },
  tr: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottomColor: '#e5e5e5', borderBottomWidth: 0.5 },
  trDestaque: { backgroundColor: '#f7f7f7' },
  td: { fontSize: 7.2 },
  totalRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderTopColor: ESCURO, borderTopWidth: 1 },
  totalTd: { fontSize: 7.4, fontFamily: 'Helvetica-Bold' },
  rodape: {
    position: 'absolute', bottom: 12, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between',
    color: '#999', fontSize: 6.5, borderTopColor: CINZA, borderTopWidth: 0.5, paddingTop: 3,
  },
});

export function RelatorioFinanceiroPDF({ titulo, subtitulo, empresa, logoBase64, resumo, colunas, linhas, total, rodapeNota }: Props) {
  const estilo = (c: ColunaPDF) => ({ flexGrow: c.flex ?? 1, flexShrink: 1, flexBasis: 0, textAlign: (c.direita ? 'right' : 'left') as 'right' | 'left', paddingRight: 4 });
  return (
    <Document title={titulo}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            {logoBase64 ? <Image src={logoBase64} style={s.logo} /> : null}
            <View>
              <Text style={s.titulo}>{titulo}</Text>
              {subtitulo ? <Text style={s.sub}>{subtitulo}</Text> : null}
              {empresa ? <Text style={s.sub}>{empresa}</Text> : null}
            </View>
          </View>
          <Text style={s.data}>Emitido em {new Date().toLocaleString('pt-BR')}</Text>
        </View>

        {resumo?.length ? (
          <View style={s.resumo}>
            {resumo.map((r, i) => (
              <View key={i} style={s.resumoItem}>
                <Text style={s.resumoLabel}>{r.label}</Text>
                <Text style={s.resumoValor}>{r.valor}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.thRow} fixed>
          {colunas.map((c, i) => <Text key={i} style={[s.th, estilo(c)]}>{c.titulo}</Text>)}
        </View>
        {linhas.map((l, i) => (
          <View key={i} style={[s.tr, l.destaque ? s.trDestaque : {}]} wrap={false}>
            {l.celulas.map((v, j) => (
              // recuo com espaços (não padding): no @react-pdf o padding soma à largura e desalinhava as colunas
              <Text key={j} style={[s.td, estilo(colunas[j]), l.destaque ? { fontFamily: 'Helvetica-Bold' } : {},
                l.recuo && j === 0 ? { color: MEDIO } : {}]}>{l.recuo && j === 0 ? `    ${v}` : v}</Text>
            ))}
          </View>
        ))}
        {total ? (
          <View style={s.totalRow} wrap={false}>
            {total.map((v, j) => <Text key={j} style={[s.totalTd, estilo(colunas[j])]}>{v}</Text>)}
          </View>
        ) : null}

        <View style={s.rodape} fixed>
          <Text>{rodapeNota || 'Conciliação bancária'}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/**
 * Gera e baixa o PDF no clique. Gerar no clique (e não com PDFDownloadLink) evita
 * montagens simultâneas do @react-pdf, que já duplicaram linhas na Ordem de Entrada.
 */
export async function baixarRelatorioFinanceiro(props: Props, nomeArquivo: string) {
  const blob = await pdf(<RelatorioFinanceiroPDF {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
