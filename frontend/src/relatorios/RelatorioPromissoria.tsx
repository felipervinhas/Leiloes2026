import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logotipoLocal from '../assets/LogotipoMacedoLeiloes.png';
import { FaturaData } from './RelatorioFaturaCompra';

interface Props {
  dados: FaturaData;
  empresa?: string;
}

// ─── Valor por extenso ────────────────────────────────────────────────────────

const UNIDADES  = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
                   'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS   = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS  = ['', 'cem', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
                   'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function centenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const cStr = c > 0 ? CENTENAS[c] : '';
  if (resto === 0) return cStr;
  if (resto < 20) return (cStr ? cStr + ' e ' : '') + UNIDADES[resto];
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const dStr = DEZENAS[d];
  const uStr = u > 0 ? dStr + ' e ' + UNIDADES[u] : dStr;
  return (cStr ? cStr + ' e ' : '') + uStr;
}

function extensoInteiro(n: number): string {
  if (n === 0) return 'zero';
  const bi = Math.floor(n / 1_000_000_000);
  const mi = Math.floor((n % 1_000_000_000) / 1_000_000);
  const mil = Math.floor((n % 1_000_000) / 1_000);
  const resto = n % 1_000;

  const partes: string[] = [];
  if (bi > 0) partes.push(centenas(bi) + (bi === 1 ? ' bilhão' : ' bilhões'));
  if (mi > 0) partes.push(centenas(mi) + (mi === 1 ? ' milhão' : ' milhões'));
  if (mil > 0) partes.push(mil === 1 ? 'mil' : centenas(mil) + ' mil');
  if (resto > 0) partes.push(centenas(resto));

  return partes.join(' e ');
}

export function valorExtenso(valor: number): string {
  if (!valor || valor <= 0) return 'zero reais';
  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);
  const rStr = extensoInteiro(reais) + (reais === 1 ? ' real' : ' reais');
  if (centavos === 0) return rStr;
  return rStr + ' e ' + extensoInteiro(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

const fmtR = (v?: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';

const fmtData = (iso?: string | null) => {
  if (!iso) return '___/___/______';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
};

const ordinal = (n?: string | number) => {
  const num = Number(n);
  if (!num) return '1ª';
  return `${num}ª`;
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const AZUL   = '#001529';
const CINZA  = '#d9d9d9';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#222',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },

  // Caixa principal de cada promissória
  promBox: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 0,
  },

  // ── Canhoto ──
  canhoto: {
    width: 155,
    borderRightWidth: 1,
    borderRightColor: '#555',
    borderRightStyle: 'dashed',
    padding: 8,
    backgroundColor: '#fafafa',
  },
  canhotoTitle: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: CINZA,
    paddingBottom: 4,
    marginBottom: 6,
  },
  canhotoNum: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: AZUL,
    textAlign: 'center',
    marginBottom: 2,
  },
  canhotoLabel: { fontSize: 6, color: '#888', marginTop: 5, marginBottom: 1 },
  canhotoValor: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  canhotoInfo: { fontSize: 7, color: '#444', marginBottom: 1, lineHeight: 1.3 },
  canhotoInfoBold: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#222', marginBottom: 1 },
  canhotoAssinLinha: { borderTopWidth: 0.5, borderTopColor: '#333', marginTop: 12, marginBottom: 3, marginHorizontal: 4 },
  canhotoAssinLabel: { fontSize: 6, color: '#666', textAlign: 'center' },

  // ── Corpo da promissória ──
  corpo: { flex: 1, padding: 10 },

  corpoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: AZUL,
    paddingBottom: 6,
    marginBottom: 7,
  },
  corpoTopEsq: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  corpoLogo: { width: 28, height: 28, objectFit: 'contain' },
  corpoEmpresa: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: AZUL },
  corpoEmpresaSub: { fontSize: 6, color: '#666' },

  corpoTitulo: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: AZUL, letterSpacing: 0.5 },

  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  metaBox: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    borderRadius: 3,
    padding: 5,
  },
  metaLabel: { fontSize: 5.5, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  metaValor: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL },
  metaValorGrande: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333' },

  textoPromissoria: {
    fontSize: 8,
    lineHeight: 1.6,
    color: '#222',
    marginBottom: 8,
    textAlign: 'justify',
  },

  devedor: {
    backgroundColor: '#f6f6f6',
    borderRadius: 3,
    padding: 6,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: CINZA,
  },
  devedorLabel: { fontSize: 5.5, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  devedorNome: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 1 },
  devedorInfo: { fontSize: 7, color: '#555', lineHeight: 1.4 },

  rodapeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  localData: { fontSize: 7, color: '#555' },
  assinRow: { alignItems: 'center' },
  assinLinha: { borderTopWidth: 0.5, borderTopColor: '#333', width: 160, marginBottom: 3 },
  assinNome: { fontSize: 6.5, color: '#444', textAlign: 'center' },
  assinCPF:  { fontSize: 6, color: '#888', textAlign: 'center' },

  // Linha de corte entre promissórias
  corte: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  corteLinha: { flex: 1, borderTopWidth: 0.5, borderTopColor: '#aaa', borderTopStyle: 'dashed' },
  corteTexto: { fontSize: 6, color: '#bbb', marginHorizontal: 6, letterSpacing: 1 },

  // Rodapé de página
  footer: {
    position: 'absolute',
    bottom: 8,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: CINZA,
    borderTopWidth: 0.5,
    paddingTop: 2,
  },
  footerText: { fontSize: 5.5, color: '#bbb' },
});

// ─── Componente de uma promissória ────────────────────────────────────────────

interface PromissoriaProps {
  parcela: FaturaData['compradores'][0]['parcelas'][0];
  totalParcelas: number;
  comprador: FaturaData['compradores'][0];
  dados: FaturaData;
  empresa: string;
}

function Promissoria({ parcela, totalParcelas, comprador, dados, empresa }: PromissoriaProps) {
  const numero = `${dados.codnot || dados.id}/${String(parcela.ordxxx ?? '01').padStart(2, '0')}`;
  const credor = dados.lote?.nomeVendedor || empresa;
  const cpfCredor = dados.lote?.cpfVendedor;
  const valor = parcela.vlrpar ?? 0;
  const extenso = valorExtenso(valor).toUpperCase();
  const ordStr = ordinal(parcela.ordxxx);
  const enderecoComp = [comprador.endere, comprador.bairro, comprador.nomeCidade, comprador.nomeEstado]
    .filter(Boolean).join(', ');

  const agora = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <View style={s.promBox}>

      {/* ── CANHOTO ── */}
      <View style={s.canhoto}>
        <Text style={s.canhotoTitle}>✂ Canhoto / Recibo</Text>

        <Text style={s.canhotoNum}>Nº {numero}</Text>

        <View style={[s.metaBox, { alignItems: 'center', marginBottom: 4 }]}>
          <Text style={s.metaLabel}>Vencimento</Text>
          <Text style={[s.metaValor, { textAlign: 'center' }]}>{fmtData(parcela.datven)}</Text>
        </View>

        <Text style={s.canhotoValor}>{fmtR(valor)}</Text>

        <Text style={s.canhotoLabel}>Recebi de</Text>
        <Text style={s.canhotoInfoBold}>{comprador.nomexx || '—'}</Text>
        {comprador.cpfxxx ? <Text style={s.canhotoInfo}>CPF: {comprador.cpfxxx}</Text> : null}

        <Text style={s.canhotoLabel}>Referente à</Text>
        <Text style={s.canhotoInfo}>
          {ordStr} parcela de {totalParcelas} — Lote {dados.lote?.lotexx}
        </Text>
        <Text style={s.canhotoInfo} >{dados.lote?.deslot}</Text>

        <Text style={s.canhotoLabel}>Leilão</Text>
        <Text style={s.canhotoInfo} >{dados.leilao}</Text>

        <View style={s.canhotoAssinLinha} />
        <Text style={s.canhotoAssinLabel}>{credor}</Text>
        <Text style={[s.canhotoAssinLabel, { color: '#aaa', fontSize: 5.5 }]}>Credor / Assinatura</Text>
      </View>

      {/* ── CORPO ── */}
      <View style={s.corpo}>
        {/* Topo: logo + título */}
        <View style={s.corpoTop}>
          <View style={s.corpoTopEsq}>
            <Image src={logotipoLocal} style={s.corpoLogo} />
            <View>
              <Text style={s.corpoEmpresa}>{empresa}</Text>
              <Text style={s.corpoEmpresaSub}>Sistema de Gestão de Leilões</Text>
            </View>
          </View>
          <Text style={s.corpoTitulo}>PROMISSÓRIA</Text>
        </View>

        {/* Metadados: Nº, Vencimento, Valor */}
        <View style={s.metaRow}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Número</Text>
            <Text style={s.metaValor}>{numero}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Vencimento</Text>
            <Text style={s.metaValor}>{fmtData(parcela.datven)}</Text>
          </View>
          <View style={[s.metaBox, { flex: 2 }]}>
            <Text style={s.metaLabel}>Valor</Text>
            <Text style={s.metaValorGrande}>{fmtR(valor)}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Parcela</Text>
            <Text style={s.metaValor}>{ordStr} de {totalParcelas}</Text>
          </View>
        </View>

        {/* Texto jurídico */}
        <Text style={s.textoPromissoria}>
          {'      '}Devo(emos) e pagarei(emos) por esta única via de PROMISSÓRIA a{' '}
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{credor}</Text>
          {cpfCredor ? `, CPF ${cpfCredor},` : ','} ou à sua ordem, a importância de{' '}
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmtR(valor)}</Text>{' '}
          ({extenso}), referente à {ordStr} parcela de {totalParcelas}{' '}
          do Lote {dados.lote?.lotexx} — {dados.lote?.deslot},{' '}
          adquirido no Leilão{' '}
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{dados.leilao}</Text>
          {dados.datlei ? `, realizado em ${fmtData(dados.datlei)}` : ''}.
          {comprador.formaPagamento ? ` Forma de pagamento: ${comprador.formaPagamento}.` : ''}
        </Text>

        {/* Devedor */}
        <View style={s.devedor}>
          <Text style={s.devedorLabel}>Emitente / Devedor</Text>
          <Text style={s.devedorNome}>{comprador.nomexx || '—'}</Text>
          <Text style={s.devedorInfo}>
            CPF: {comprador.cpfxxx || 'não informado'}
            {enderecoComp ? `  ·  ${enderecoComp}` : ''}
            {comprador.cepxxx ? `  CEP ${comprador.cepxxx}` : ''}
          </Text>
          {comprador.celu1 ? <Text style={s.devedorInfo}>Tel: {comprador.celu1}</Text> : null}
        </View>

        {/* Rodapé: local/data + assinatura */}
        <View style={s.rodapeRow}>
          <Text style={s.localData}>
            {comprador.nomeCidade || '_______________'}, {agora}
          </Text>
          <View style={s.assinRow}>
            <View style={s.assinLinha} />
            <Text style={s.assinNome}>{comprador.nomexx || 'Devedor'}</Text>
            {comprador.cpfxxx ? <Text style={s.assinCPF}>CPF: {comprador.cpfxxx}</Text> : null}
          </View>
        </View>
      </View>

    </View>
  );
}

// ─── Documento completo ───────────────────────────────────────────────────────

function PromissoriaPDF({ dados, empresa }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  // Gera lista plana: uma entrada por (comprador × parcela)
  type Item = { comp: FaturaData['compradores'][0]; parc: FaturaData['compradores'][0]['parcelas'][0] };
  const itens: Item[] = [];
  for (const comp of dados.compradores) {
    for (const parc of comp.parcelas) {
      itens.push({ comp, parc });
    }
  }

  // Agrupa em pares (2 por página)
  const paginas: Item[][] = [];
  for (let i = 0; i < itens.length; i += 2) {
    paginas.push([itens[i], itens[i + 1]].filter(Boolean));
  }

  // Se não há parcelas, gera uma promissória em branco por comprador
  if (itens.length === 0) {
    for (const comp of dados.compradores) {
      itens.push({ comp, parc: { ordxxx: '01', vlrpar: comp.valorPagar, datven: undefined } });
    }
    for (let i = 0; i < itens.length; i += 2) {
      paginas.push([itens[i], itens[i + 1]].filter(Boolean));
    }
  }

  return (
    <Document
      title={`Promissórias — Boleto ${dados.codnot || dados.id}`}
      author={nomeEmpresa}
    >
      {paginas.map((par, pi) => (
        <Page key={pi} size="A4" style={s.page}>

          {par.map((item, idx) => (
            <View key={idx}>
              <Promissoria
                parcela={item.parc}
                totalParcelas={item.comp.parcelas.length || 1}
                comprador={item.comp}
                dados={dados}
                empresa={nomeEmpresa}
              />
              {/* Linha de corte entre as duas promissórias */}
              {idx === 0 && par.length > 1 && (
                <View style={s.corte}>
                  <View style={s.corteLinha} />
                  <Text style={s.corteTexto}>✂  RECORTE AQUI  ✂</Text>
                  <View style={s.corteLinha} />
                </View>
              )}
            </View>
          ))}

          <View style={s.footer} fixed>
            <Text style={s.footerText}>{nomeEmpresa} — Promissórias · Boleto {dados.codnot || dados.id}</Text>
            <Text style={s.footerText}>Emitido em {agora}</Text>
            <Text
              style={s.footerText}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>

        </Page>
      ))}
    </Document>
  );
}

export default PromissoriaPDF;
