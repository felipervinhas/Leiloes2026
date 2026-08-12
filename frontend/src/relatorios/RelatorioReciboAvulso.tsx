import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { valorExtenso } from './promissoriaUtils';

export interface ReciboAvulsoPDF {
  id: number;
  pagador: string;
  valor: number;
  observacoes?: string;
  data?: string;
  /** 'R' = Recebimento (Knorr recebe e assina) | 'P' = Pagamento (cliente recebe e assina). Default 'R'. */
  tipo?: 'R' | 'P';
}

interface Props {
  dados: ReciboAvulsoPDF;
  empresa?: string;
  empresaEndereco?: string;
  logoBase64?: string | null;
}

const PRETO  = '#000';
const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';

const fmtR = (v?: number | null) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: ESCURO,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 36,
    backgroundColor: '#fff',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: PRETO,
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    marginBottom: 18,
  },
  headerEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 120, height: 54, objectFit: 'contain' },
  empresa: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PRETO },
  empresaEndereco: { fontSize: 6.5, color: MEDIO, marginTop: 2, maxWidth: 200 },
  titulo: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: PRETO },

  numero: { fontSize: 7, color: MEDIO, textAlign: 'right' as const, marginBottom: 16 },

  valorBox: {
    backgroundColor: ESCURO,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  valorLabel: { fontSize: 7, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 },
  valorNumero: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#fff', marginTop: 4 },

  frase: { fontSize: 10, color: ESCURO, lineHeight: 1.6, marginBottom: 18 },
  extenso: { fontSize: 10, fontFamily: 'Helvetica-BoldOblique', color: PRETO },

  detalhesBox: {
    borderColor: CINZA, borderWidth: 0.5, borderRadius: 4,
    padding: 10, marginBottom: 30,
  },
  linha: { flexDirection: 'row', marginBottom: 6 },
  label: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MEDIO, width: 90 },
  valor: { fontSize: 9, color: PRETO, flex: 1 },

  assinatura: { alignItems: 'center', marginTop: 20 },
  assinaturaLinha: { borderTopColor: ESCURO, borderTopWidth: 0.5, width: '65%', marginBottom: 4 },
  assinaturaNome: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: ESCURO, textAlign: 'center' as const },
  assinaturaRole: { fontSize: 7.5, color: MEDIO, textAlign: 'center' as const },

  footer: {
    position: 'absolute', bottom: 14, left: 28, right: 28,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopColor: CINZA, borderTopWidth: 0.5, paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: CINZA },
});

function RelatorioReciboAvulso({ dados, empresa, empresaEndereco, logoBase64 }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const dataFmt = dados.data ? new Date(dados.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : new Date().toLocaleDateString('pt-BR');
  const ehPagamento = dados.tipo === 'P';
  const pessoa = dados.pagador || 'acima identificado(a)';
  // Recebimento (padrão): Knorr recebe do pagador e assina. Pagamento: Knorr
  // paga ao beneficiário, que assina recebendo (chamado #53).
  const quemAssina = ehPagamento ? pessoa : nomeEmpresa;

  return (
    <Document title={`RECIBO #${dados.id}`} author={nomeEmpresa}>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <View style={s.headerEsquerda}>
            <Image src={logoBase64 || logotipoLocal} style={s.logo} />
            <View>
              <Text style={s.empresa}>{nomeEmpresa}</Text>
              {empresaEndereco ? <Text style={s.empresaEndereco}>{empresaEndereco}</Text> : null}
            </View>
          </View>
          <Text style={s.titulo}>RECIBO</Text>
        </View>

        <Text style={s.numero}>Nº {dados.id}   ·   {dataFmt}</Text>

        <View style={s.valorBox}>
          <Text style={s.valorLabel}>Valor</Text>
          <Text style={s.valorNumero}>{fmtR(dados.valor)}</Text>
        </View>

        <Text style={s.frase}>
          {ehPagamento ? `Pagamos a ${pessoa} a quantia de ` : `Recebemos de ${pessoa} a quantia de `}
          <Text style={s.extenso}>({valorExtenso(dados.valor)})</Text>.
        </Text>

        <View style={s.detalhesBox}>
          <View style={s.linha}>
            <Text style={s.label}>{ehPagamento ? 'Beneficiário' : 'Pagador'}</Text>
            <Text style={s.valor}>{dados.pagador || '—'}</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.label}>Data</Text>
            <Text style={s.valor}>{dataFmt}</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.label}>Referente a</Text>
            <Text style={s.valor}>{dados.observacoes || '—'}</Text>
          </View>
        </View>

        <View style={s.assinatura}>
          <View style={s.assinaturaLinha} />
          <Text style={s.assinaturaNome}>{quemAssina}</Text>
          <Text style={s.assinaturaRole}>Assinatura</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomeEmpresa}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

export default RelatorioReciboAvulso;
