import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

export interface PropriedadeRelacaoPDF {
  id: number;
  nomePropriedade?: string;
  cidade?: string;
  estado?: string;
  inscricao?: string;
  incra?: string;
}

export interface CompradorRelacaoPDF {
  id: number;
  nomexx?: string;
  cpfxxx?: string;
  cnpjxx?: string;
  endere?: string;
  bairro?: string;
  cepxxx?: string;
  nomeCidade?: string;
  nomeEstado?: string;
  celu1?: string;
  celu2?: string;
  telcom?: string;
  telres?: string;
  emailx?: string;
  propriedades: PropriedadeRelacaoPDF[];
}

export interface RelacaoCompradoresPDF {
  idLeilao: number;
  leilao?: string;
  datlei?: string;
  compradores: CompradorRelacaoPDF[];
  totalPessoas: number;
  totalFazendas: number;
}

interface Props {
  dados: RelacaoCompradoresPDF;
  empresa?: string;
  logoBase64?: string | null;
  impressoPor?: string;
}

const PRETO  = '#000';
const ESCURO = '#222';
const MEDIO  = '#555';
const CINZA  = '#bbb';
const CLARO  = '#f0f0f0';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: ESCURO,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },

  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: PRETO,
    borderBottomWidth: 2,
    paddingBottom: 6,
    marginBottom: 8,
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
  leilaoNome:  { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#fff', marginTop: 1 },
  leilaoData:  { fontSize: 8, color: '#ddd', fontFamily: 'Helvetica-Bold' },

  compradorBox: {
    borderColor: CINZA, borderWidth: 0.5, borderRadius: 3,
    marginBottom: 7, overflow: 'hidden',
  },
  compradorHeader: { backgroundColor: CLARO, paddingHorizontal: 8, paddingVertical: 5 },
  compradorNome: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: PRETO, marginBottom: 3 },
  linhaContato: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  campoLabel: { fontSize: 5.5, color: MEDIO, textTransform: 'uppercase', letterSpacing: 0.4 },
  campoValor: { fontSize: 7.5, color: ESCURO, marginTop: 1 },

  tabela: { paddingHorizontal: 8, paddingBottom: 6 },
  tHeader: { flexDirection: 'row', paddingVertical: 3, borderBottomColor: CINZA, borderBottomWidth: 0.5 },
  tRow: { flexDirection: 'row', paddingVertical: 2.5, borderBottomColor: '#f0f0f0', borderBottomWidth: 0.5 },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: MEDIO, textTransform: 'uppercase' },
  td: { fontSize: 7.5 },
  cProp: { width: '38%' },
  cLoc:  { width: '24%' },
  cIE:   { width: '19%' },
  cIncra: { flex: 1 },
  semPropriedade: { padding: 8, fontSize: 7, color: '#aaa', fontStyle: 'italic' },

  totaisBox: {
    marginTop: 4, backgroundColor: CLARO, borderRadius: 3,
    paddingHorizontal: 10, paddingVertical: 8,
    flexDirection: 'row', gap: 24,
  },
  totalLabel: { fontSize: 6, color: MEDIO, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValor: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRETO, marginTop: 2 },

  footer: {
    position: 'absolute', bottom: 10, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopColor: CINZA, borderTopWidth: 0.5, paddingTop: 3,
  },
  footerText: { fontSize: 6, color: CINZA },
});

function Campo({ label, valor }: { label: string; valor?: string }) {
  if (!valor) return null;
  return (
    <View>
      <Text style={s.campoLabel}>{label}</Text>
      <Text style={s.campoValor}>{valor}</Text>
    </View>
  );
}

function RelatorioRelacaoCompradores({ dados, empresa, logoBase64, impressoPor }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Document title={`Relação de Compradores — ${dados.leilao || ''}`} author={nomeEmpresa}>
      <Page size="A4" style={s.page}>

        <View style={s.docHeader}>
          <View style={s.docHeaderLeft}>
            <Image src={logoBase64 || logotipoLocal} style={s.docLogo} />
            <Text style={s.docEmpresa}>{nomeEmpresa}</Text>
          </View>
          <View style={s.docHeaderRight}>
            <Text style={s.docTitulo}>RELAÇÃO DE COMPRADORES</Text>
            <Text style={s.docData}>Emissão: {agora}{impressoPor ? `   ·   Impresso por: ${impressoPor}` : ''}</Text>
          </View>
        </View>

        <View style={s.leilaoBox}>
          <View>
            <Text style={s.leilaoLabel}>Leilão</Text>
            <Text style={s.leilaoNome}>{dados.leilao || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.leilaoLabel}>Data do Leilão</Text>
            <Text style={s.leilaoData}>{dados.datlei || '—'}</Text>
          </View>
        </View>

        {dados.compradores.map(c => (
          <View key={c.id} style={s.compradorBox} wrap={false}>
            <View style={s.compradorHeader}>
              <Text style={s.compradorNome}>{c.nomexx || '—'}</Text>
              <View style={s.linhaContato}>
                <Campo label={c.cnpjxx ? 'CNPJ' : 'CPF'} valor={c.cnpjxx || c.cpfxxx} />
                <Campo label="Endereço" valor={[c.endere, c.bairro].filter(Boolean).join(', ')} />
                <Campo label="Localização" valor={[c.nomeCidade, c.nomeEstado].filter(Boolean).join(' — ')} />
                <Campo label="CEP" valor={c.cepxxx} />
                <Campo label="E-mail" valor={c.emailx} />
                <Campo label="Telefones" valor={[c.celu1, c.celu2, c.telcom, c.telres].filter(Boolean).join(' , ')} />
              </View>
            </View>

            <View style={s.tabela}>
              <View style={s.tHeader}>
                <View style={s.cProp}><Text style={s.th}>Cabanha / Fazenda / Chácara / Sítio</Text></View>
                <View style={s.cLoc}><Text style={s.th}>Localização</Text></View>
                <View style={s.cIE}><Text style={s.th}>Inscrição Estadual</Text></View>
                <View style={s.cIncra}><Text style={s.th}>INCRA</Text></View>
              </View>
              {c.propriedades.length === 0 ? (
                <Text style={s.semPropriedade}>Nenhuma propriedade cadastrada</Text>
              ) : (
                c.propriedades.map(p => (
                  <View key={p.id} style={s.tRow}>
                    <View style={s.cProp}><Text style={s.td}>{p.nomePropriedade || '—'}</Text></View>
                    <View style={s.cLoc}>
                      <Text style={s.td}>{p.cidade ? `${p.cidade}${p.estado ? ` / ${p.estado}` : ''}` : '—'}</Text>
                    </View>
                    <View style={s.cIE}><Text style={s.td}>{p.inscricao || '—'}</Text></View>
                    <View style={s.cIncra}><Text style={s.td}>{p.incra || '—'}</Text></View>
                  </View>
                ))
              )}
            </View>
          </View>
        ))}

        <View style={s.totaisBox} wrap={false}>
          <View>
            <Text style={s.totalLabel}>Total de Compradores</Text>
            <Text style={s.totalValor}>{dados.totalPessoas} pessoa{dados.totalPessoas !== 1 ? 's' : ''}</Text>
          </View>
          <View>
            <Text style={s.totalLabel}>Total de Fazendas</Text>
            <Text style={s.totalValor}>{dados.totalFazendas} fazenda{dados.totalFazendas !== 1 ? 's' : ''}</Text>
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

export default RelatorioRelacaoCompradores;
