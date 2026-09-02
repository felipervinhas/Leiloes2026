import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

export interface AcertoCompradorPDF {
  idLeilao?: number;
  leilao?: string;
  datlei?: string;
  idComprador: number;
  comprador?: string;
  compras: Array<{ idMc: number; lotexx?: string; deslot?: string; nomeVendedor?: string; valorEntrada: number; leilao?: string }>;
  promissorias: Array<{ datven: string; valor: number }>;
  lancamentos: Array<{ id: number; dc: string; valor: number; observacoes?: string; tipoOrigem?: string }>;
  totais: {
    totalPrimeirasParcelas: number; totalPromissorias: number; totalComissao: number;
    totalDespesas: number; totalCreditos: number; totalFechamentos: number; saldo: number;
  };
}

interface Props {
  dados: AcertoCompradorPDF;
  empresa?: string;
  logoBase64?: string | null;
}

const PRETO  = '#000';
const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';
const CLARO  = '#f0f0f0';

const fmtR = (v?: number | null) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const DC_LABEL: Record<string, string> = { E: 'E', D: 'D', S: 'D', C: 'C', F: 'F', P: 'P' };

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: ESCURO,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: '#fff',
  },

  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: PRETO,
    borderBottomWidth: 2,
    paddingBottom: 5,
    marginBottom: 6,
  },
  docHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docLogo: { width: 48, height: 48, objectFit: 'contain' },
  docEmpresa: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRETO },
  docHeaderRight: { alignItems: 'flex-end' },
  docTitulo: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: PRETO, letterSpacing: 0.5 },
  docData: { fontSize: 6.5, color: MEDIO, marginTop: 1 },

  leilaoBox: {
    backgroundColor: ESCURO,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leilaoLabel: { fontSize: 5.5, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  leilaoNome:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff', marginTop: 1 },
  leilaoData:  { fontSize: 7.5, color: '#ddd', fontFamily: 'Helvetica-Bold' },

  tabela: { borderWidth: 0.5, borderColor: CINZA, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  tHeader: { flexDirection: 'row', backgroundColor: ESCURO, paddingVertical: 3, paddingHorizontal: 5 },
  tRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 5, borderBottomColor: CLARO, borderBottomWidth: 0.5 },
  tRowAlt: { backgroundColor: '#fafafa' },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff' },
  td: { fontSize: 7 },

  cLote:  { width: 30 },
  cComp:  { flex: 1.3 },
  cDet:   { flex: 1.6 },
  cTipo:  { flex: 1.3 },
  cDC:    { width: 22, textAlign: 'center' as const },
  cValor: { width: 70, textAlign: 'right' as const },

  dcBadge: { fontSize: 6.5, fontFamily: 'Helvetica-Bold' },

  totaisBox: {
    backgroundColor: '#fafafa', borderRadius: 3, borderColor: CINZA, borderWidth: 0.5,
    padding: 8, marginBottom: 10,
  },
  totaisLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totaisLabel: { fontSize: 7.5, color: MEDIO },
  totaisValor: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRETO },
  totaisLinhaFinal: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 5, marginTop: 3, borderTopColor: CINZA, borderTopWidth: 0.5,
  },
  totaisLabelFinal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: PRETO },
  totaisValorFinal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRETO },

  cienciaBox: {
    borderColor: PRETO, borderWidth: 0.5, borderRadius: 3,
    padding: 10, marginBottom: 24,
  },
  cienciaTexto: { fontSize: 8, color: ESCURO, lineHeight: 1.5 },

  assinatura: { alignItems: 'center', marginTop: 4 },
  assinaturaLinha: { borderTopColor: ESCURO, borderTopWidth: 0.5, width: '60%', marginBottom: 3 },
  assinaturaNome: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: ESCURO, textAlign: 'center' as const },

  footer: {
    position: 'absolute', bottom: 10, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopColor: CINZA, borderTopWidth: 0.5, paddingTop: 3,
  },
  footerText: { fontSize: 6, color: CINZA },
});

function LinhaTabela({ lote, comp, det, tipo, dc, valor, alt }: {
  lote?: string; comp?: string; det: string; tipo?: string; dc: string; valor: number; alt: boolean;
}) {
  return (
    <View style={alt ? [s.tRow, s.tRowAlt] : s.tRow} wrap={false}>
      <View style={s.cLote}><Text style={s.td}>{lote || ''}</Text></View>
      <View style={s.cComp}><Text style={s.td}>{comp || ''}</Text></View>
      <View style={s.cDet}><Text style={s.td}>{det}</Text></View>
      <View style={s.cTipo}><Text style={s.td}>{tipo || ''}</Text></View>
      <View style={s.cDC}><Text style={s.dcBadge}>{DC_LABEL[dc] || dc}</Text></View>
      <View style={s.cValor}><Text style={s.td}>{fmtR(valor)}</Text></View>
    </View>
  );
}

function RelatorioAcertoComprador({ dados, empresa, logoBase64 }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';

  let alt = false;
  const proximaAlt = () => { alt = !alt; return alt; };

  return (
    <Document title={`Acerto de Comprador — ${dados.comprador || ''}`} author={nomeEmpresa}>
      <Page size="A4" style={s.page}>

        <View style={s.docHeader}>
          <View style={s.docHeaderLeft}>
            <Image src={logoBase64 || logotipoLocal} style={s.docLogo} />
            <Text style={s.docEmpresa}>{nomeEmpresa}</Text>
          </View>
          <View style={s.docHeaderRight}>
            <Text style={s.docTitulo}>ACERTO DE COMPRADOR</Text>
            {dados.idLeilao && <Text style={s.docData}>Data do Leilão: {dados.datlei || '—'}</Text>}
          </View>
        </View>

        <View style={s.leilaoBox}>
          <View>
            <Text style={s.leilaoLabel}>Leilão</Text>
            <Text style={s.leilaoNome}>{dados.leilao || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.leilaoLabel}>Comprador</Text>
            <Text style={s.leilaoData}>{dados.comprador || '—'}</Text>
          </View>
        </View>

        <View style={s.tabela}>
          <View style={s.tHeader} fixed>
            <View style={s.cLote}><Text style={s.th}>Lote</Text></View>
            <View style={s.cComp}><Text style={s.th}>Vendedor</Text></View>
            <View style={s.cDet}><Text style={s.th}>Detalhes</Text></View>
            <View style={s.cTipo}><Text style={s.th}>Tipo</Text></View>
            <View style={s.cDC}><Text style={s.th}>D/C</Text></View>
            <View style={s.cValor}><Text style={[s.th, { textAlign: 'right' }]}>Valor</Text></View>
          </View>

          {dados.compras.map(e => (
            <LinhaTabela
              key={`e${e.idMc}`}
              lote={e.lotexx}
              comp={e.nomeVendedor}
              det="1ª PARCELA"
              tipo={!dados.idLeilao ? e.leilao : undefined}
              dc="E"
              valor={e.valorEntrada}
              alt={proximaAlt()}
            />
          ))}

          {dados.promissorias.map(p => (
            <LinhaTabela
              key={`p${p.datven}`}
              det={`Total de Promissórias: ${p.datven}`}
              tipo="PROMISSORIA"
              dc="P"
              valor={p.valor}
              alt={proximaAlt()}
            />
          ))}

          {dados.lancamentos.map(l => (
            <LinhaTabela
              key={`l${l.id}`}
              det={
                l.tipoOrigem === 'COMISSAO_VENDEDOR'  ? 'COMISSÃO VENDEDOR'  :
                l.tipoOrigem === 'COMISSAO_COMPRADOR' ? 'COMISSÃO COMPRADOR' :
                l.dc === 'F' ? 'FECHAMENTO' : (l.dc === 'C' || l.dc === 'E') ? 'CRÉDITO' : 'DESPESA'
              }
              tipo={l.observacoes}
              dc={l.dc}
              valor={l.valor}
              alt={proximaAlt()}
            />
          ))}
        </View>

        <View style={s.totaisBox} wrap={false}>
          <View style={s.totaisLinha}>
            <Text style={s.totaisLabel}>Total de Primeiras Parcelas</Text>
            <Text style={s.totaisValor}>{fmtR(dados.totais.totalPrimeirasParcelas)}</Text>
          </View>
          <View style={s.totaisLinha}>
            <Text style={s.totaisLabel}>Total Promissórias (futuro)</Text>
            <Text style={s.totaisValor}>{fmtR(dados.totais.totalPromissorias)}</Text>
          </View>
          <View style={s.totaisLinha}>
            <Text style={s.totaisLabel}>Total Comissão</Text>
            <Text style={s.totaisValor}>{fmtR(dados.totais.totalComissao)}</Text>
          </View>
          <View style={s.totaisLinha}>
            <Text style={s.totaisLabel}>Total Despesas</Text>
            <Text style={s.totaisValor}>{fmtR(dados.totais.totalDespesas)}</Text>
          </View>
          <View style={s.totaisLinha}>
            <Text style={s.totaisLabel}>Total Créditos</Text>
            <Text style={s.totaisValor}>{fmtR(dados.totais.totalCreditos)}</Text>
          </View>
          <View style={s.totaisLinha}>
            <Text style={s.totaisLabel}>Total Fechamentos</Text>
            <Text style={s.totaisValor}>{fmtR(dados.totais.totalFechamentos)}</Text>
          </View>
          <View style={s.totaisLinhaFinal}>
            <Text style={s.totaisLabelFinal}>Total a Pagar</Text>
            <Text style={s.totaisValorFinal}>{fmtR(dados.totais.saldo)}</Text>
          </View>
        </View>

        <View style={s.cienciaBox} wrap={false}>
          <Text style={s.cienciaTexto}>
            Eu, {dados.comprador || '—'}, dou ciência e concordo com as informações contidas no relatório
            apresentado sobre {dados.idLeilao ? `o ${dados.leilao || '—'} ocorrido em ${dados.datlei || '—'}` : 'os leilões acima computados'},
            reiterando que afirmo ter pago {fmtR(dados.totais.saldo)} à empresa {nomeEmpresa}.
          </Text>
          <View style={{ height: 24 }} />
          <View style={s.assinatura}>
            <View style={s.assinaturaLinha} />
            <Text style={s.assinaturaNome}>{dados.comprador || '—'}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomeEmpresa}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

export default RelatorioAcertoComprador;
