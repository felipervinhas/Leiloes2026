import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';

export interface ClienteFichaPDF {
  id: number;
  nomexx?: string;
  cpfxxx?: string;
  cnpjxx?: string;
  rgxxxx?: string;
  endere?: string;
  bairro?: string;
  nomeCidade?: string;
  nomeEstado?: string;
  cepxxx?: string;
  telres?: string;
  telcom?: string;
  celu1?: string;
  emailx?: string;
  estciv?: string;
  profiss?: string;
  obsxxx?: string;
  datnas?: string;
}

export interface PropriedadeFichaPDF {
  id: number;
  nomePropriedade?: string;
  inscricao?: string;
  cidade?: string;
  estado?: string;
  localidade?: string;
}

interface Props {
  cliente: ClienteFichaPDF;
  propriedades: PropriedadeFichaPDF[];
  empresa?: string;
  logoBase64?: string | null;
}

const ESCURO = '#222';
const CINZA  = '#bbb';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#222',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 36,
    backgroundColor: '#fff',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: ESCURO,
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    marginBottom: 14,
  },
  logo: { width: 90, height: 40, objectFit: 'contain' },
  titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ESCURO },

  linha: { flexDirection: 'row', marginBottom: 7, flexWrap: 'wrap' },
  campo: { marginRight: 18 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#555' },
  valor: { fontSize: 9.5, marginTop: 1 },

  secaoTitulo: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: ESCURO,
    marginTop: 16, marginBottom: 6, borderBottomColor: CINZA, borderBottomWidth: 0.5, paddingBottom: 3,
  },

  tabela: { borderWidth: 0.5, borderColor: CINZA, borderRadius: 3, overflow: 'hidden' },
  tHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingVertical: 4, paddingHorizontal: 6, borderBottomColor: CINZA, borderBottomWidth: 1 },
  tRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomColor: '#f0f0f0', borderBottomWidth: 1 },
  tRowAlt: { backgroundColor: '#fafafa' },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#444' },
  td: { fontSize: 8.5 },

  cPropriedade: { width: '28%' },
  cIE:          { width: '16%' },
  cCidade:      { width: '24%' },
  cUf:          { width: '8%' },
  cLocalidade:  { flex: 1 },

  footer: {
    position: 'absolute', bottom: 14, left: 28, right: 28,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopColor: CINZA, borderTopWidth: 1, paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: '#aaa' },
});

function Campo({ label, valor, largura }: { label: string; valor?: string | null; largura?: string }) {
  return (
    <View style={[s.campo, largura ? { width: largura } : {}]}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.valor}>{valor?.trim() ? valor : '—'}</Text>
    </View>
  );
}

function FichaClientePDF({ cliente, propriedades, empresa, logoBase64 }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const nascimento = cliente.datnas ? new Date(cliente.datnas).toLocaleDateString('pt-BR') : undefined;

  return (
    <Document title={`Ficha de Cliente — ${cliente.nomexx || ''}`} author={nomeEmpresa}>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <Image src={logoBase64 || logotipoLocal} style={s.logo} />
          <Text style={s.titulo}>FICHA DE CLIENTE</Text>
        </View>

        <View style={s.linha}>
          <Campo label="Nome" valor={cliente.nomexx} largura="70%" />
          <Campo label="Nasc." valor={nascimento} />
        </View>

        <View style={s.linha}>
          <Campo label="CPF" valor={cliente.cpfxxx} largura="30%" />
          <Campo label="CNPJ" valor={cliente.cnpjxx} largura="30%" />
          <Campo label="RG" valor={cliente.rgxxxx} />
        </View>

        <View style={s.linha}>
          <Campo label="Endereço" valor={cliente.endere} largura="96%" />
        </View>

        <View style={s.linha}>
          <Campo label="Bairro" valor={cliente.bairro} largura="45%" />
          <Campo label="Cidade/UF" valor={cliente.nomeCidade ? `${cliente.nomeCidade}${cliente.nomeEstado ? ' - ' + cliente.nomeEstado : ''}` : undefined} largura="35%" />
          <Campo label="CEP" valor={cliente.cepxxx} />
        </View>

        <View style={s.linha}>
          <Campo label="Fone Res." valor={cliente.telres} largura="30%" />
          <Campo label="Fone Com." valor={cliente.telcom} largura="30%" />
          <Campo label="Celular" valor={cliente.celu1} />
        </View>

        <View style={s.linha}>
          <Campo label="E-mail" valor={cliente.emailx} largura="60%" />
        </View>

        <View style={s.linha}>
          <Campo label="Estado Civil" valor={cliente.estciv} largura="45%" />
          <Campo label="Profissão" valor={cliente.profiss} />
        </View>

        <View style={s.linha}>
          <Campo label="Observações" valor={cliente.obsxxx} largura="96%" />
        </View>

        <Text style={s.secaoTitulo}>Propriedades</Text>
        <View style={s.tabela}>
          <View style={s.tHeader}>
            <View style={s.cPropriedade}><Text style={s.th}>Propriedade</Text></View>
            <View style={s.cIE}><Text style={s.th}>IE</Text></View>
            <View style={s.cCidade}><Text style={s.th}>Cidade</Text></View>
            <View style={s.cUf}><Text style={s.th}>UF</Text></View>
            <View style={s.cLocalidade}><Text style={s.th}>Localidade</Text></View>
          </View>
          {propriedades.length === 0 ? (
            <Text style={{ padding: 10, textAlign: 'center', fontSize: 8, color: '#aaa', fontStyle: 'italic' }}>
              Nenhuma propriedade cadastrada
            </Text>
          ) : (
            propriedades.map((p, i) => (
              <View key={p.id} style={i % 2 === 1 ? [s.tRow, s.tRowAlt] : s.tRow} wrap={false}>
                <View style={s.cPropriedade}><Text style={s.td}>{p.nomePropriedade || '—'}</Text></View>
                <View style={s.cIE}><Text style={s.td}>{p.inscricao || '—'}</Text></View>
                <View style={s.cCidade}><Text style={s.td}>{p.cidade || '—'}</Text></View>
                <View style={s.cUf}><Text style={s.td}>{p.estado || '—'}</Text></View>
                <View style={s.cLocalidade}><Text style={s.td}>{p.localidade || '—'}</Text></View>
              </View>
            ))
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomeEmpresa} — Sistema de Gestão</Text>
          <Text style={s.footerText}>Gerado em: {agora}</Text>
        </View>

      </Page>
    </Document>
  );
}

export default FichaClientePDF;
