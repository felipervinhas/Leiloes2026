import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import { Button } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';

export interface ClienteCompleto {
  id: number;
  nomexx?: string;
  cpfxxx?: string;
  cnpjxx?: string;
  rgxxxx?: string;
  estciv?: string;
  datnas?: string;
  datcad?: string;
  emailx?: string;
  email2?: string;
  telres?: string;
  telcom?: string;
  celu1?: string;
  celu2?: string;
  endere?: string;
  comple?: string;
  bairro?: string;
  cepxxx?: string;
  nomeCidade?: string;
  nomeEstado?: string;
  profiss?: string;
  empres?: string;
  ativox?: string;
  blocli?: string;
  obsxxx?: string;
}

interface Props {
  clientes: ClienteCompleto[];
  titulo?: string;
  empresa?: string;
  logo?: string;
}

const AZUL = '#001529';
const AZUL_HEADER_CARD = '#e6f4ff';
const AZUL_CLARO = '#1677ff';
const CINZA_LABEL = '#888';
const CINZA_BORDA = '#d9d9d9';
const VERDE = '#389e0d';
const VERMELHO = '#cf1322';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#222',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    backgroundColor: '#f8f8f8',
  },

  // ---- Cabeçalho do documento ----
  docHeader: {
    backgroundColor: AZUL,
    borderRadius: 4,
    padding: '10 14',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docHeaderEsquerda: { flexDirection: 'column', justifyContent: 'center' },
  docHeaderLogo: { maxHeight: 44, maxWidth: 140, objectFit: 'contain', marginBottom: 2 },
  docHeaderTitulo: { color: '#fff', fontSize: 13, fontFamily: 'Helvetica-Bold' },
  docHeaderSub: { color: '#a0b4c8', fontSize: 8, marginTop: 2 },
  docHeaderDireita: { alignItems: 'flex-end' },
  docHeaderData: { color: '#a0b4c8', fontSize: 7.5 },
  docHeaderTotal: { color: '#fff', fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 2 },

  // ---- Card de cliente ----
  card: {
    backgroundColor: '#fff',
    borderRadius: 4,
    borderColor: CINZA_BORDA,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },

  cardHeader: {
    backgroundColor: AZUL_HEADER_CARD,
    borderBottomColor: CINZA_BORDA,
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNome: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: AZUL, flex: 1 },
  cardId: { fontSize: 7.5, color: '#555', marginLeft: 6 },

  statusBadge: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  statusText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' },

  // ---- Seção dentro do card ----
  secao: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
  },
  secaoUltima: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  // ---- Campo label + valor ----
  campo: { marginRight: 16, marginBottom: 2 },
  campoLabel: { fontSize: 6.5, color: CINZA_LABEL, marginBottom: 1 },
  campoValor: { fontSize: 8, color: '#222' },
  campoVazio: { fontSize: 8, color: '#bbb' },

  // ---- Título de seção ----
  secaoTitulo: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: AZUL_CLARO,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    width: '100%',
  },

  // ---- Obs ----
  obsTexto: { fontSize: 7.5, color: '#444', fontStyle: 'italic' },

  // ---- Footer de página ----
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: CINZA_BORDA,
    borderTopWidth: 1,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: '#aaa' },
});

function Campo({ label, value, width }: { label: string; value?: string | null; width?: number | string }) {
  return (
    <View style={[s.campo, width ? { width } : {}]}>
      <Text style={s.campoLabel}>{label}</Text>
      {value ? (
        <Text style={s.campoValor}>{value}</Text>
      ) : (
        <Text style={s.campoVazio}>—</Text>
      )}
    </View>
  );
}

function formatarData(iso?: string | null) {
  if (!iso) return undefined;
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
}

function enderecoCompleto(c: ClienteCompleto) {
  const partes = [c.endere, c.comple, c.bairro].filter(Boolean).join(', ');
  const cidade = [c.nomeCidade, c.nomeEstado].filter(Boolean).join(' - ');
  const cep = c.cepxxx ? `CEP ${c.cepxxx}` : '';
  return [partes, cidade, cep].filter(Boolean).join(' — ') || null;
}

function CardCliente({ cliente: c, index }: { cliente: ClienteCompleto; index: number }) {
  const ativo = c.ativox === 'S';
  const bloqueado = c.blocli === 'Sim';
  const temContatos = c.telres || c.telcom || c.celu1 || c.celu2;
  const temEndereco = c.endere || c.nomeCidade || c.cepxxx;
  const temProfissao = c.profiss || c.empres;
  const temObs = !!c.obsxxx;

  return (
    <View style={s.card} wrap={false}>

      {/* Cabeçalho do card */}
      <View style={s.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={s.cardNome}>{c.nomexx ?? 'Sem nome'}</Text>
          <Text style={s.cardId}>  #{String(c.id).padStart(4, '0')}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {bloqueado && (
            <View style={[s.statusBadge, { backgroundColor: '#faad14' }]}>
              <Text style={s.statusText}>BLOQUEADO</Text>
            </View>
          )}
          <View style={[s.statusBadge, { backgroundColor: ativo ? VERDE : VERMELHO }]}>
            <Text style={s.statusText}>{ativo ? 'ATIVO' : 'INATIVO'}</Text>
          </View>
        </View>
      </View>

      {/* Identificação */}
      <View style={s.secao}>
        <Text style={s.secaoTitulo}>Identificação</Text>
        <Campo label="CPF" value={c.cpfxxx} width={110} />
        <Campo label="CNPJ" value={c.cnpjxx} width={130} />
        <Campo label="RG" value={c.rgxxxx} width={90} />
        <Campo label="Estado Civil" value={c.estciv} width={90} />
        <Campo label="Data Nasc." value={formatarData(c.datnas)} width={80} />
        <Campo label="Cadastrado em" value={formatarData(c.datcad)} width={80} />
      </View>

      {/* E-mails */}
      <View style={s.secao}>
        <Text style={s.secaoTitulo}>E-mail</Text>
        <Campo label="E-mail principal" value={c.emailx} width={240} />
        <Campo label="E-mail secundário" value={c.email2} width={240} />
      </View>

      {/* Telefones */}
      {temContatos && (
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Telefones</Text>
          <Campo label="Residencial" value={c.telres} width={110} />
          <Campo label="Comercial" value={c.telcom} width={110} />
          <Campo label="Celular 1" value={c.celu1} width={110} />
          <Campo label="Celular 2" value={c.celu2} width={110} />
        </View>
      )}

      {/* Endereço */}
      {temEndereco && (
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Endereço</Text>
          <Campo label="Logradouro" value={c.endere} width={260} />
          <Campo label="Complemento" value={c.comple} width={100} />
          <Campo label="Bairro" value={c.bairro} width={120} />
          <Campo label="Cidade / UF" value={[c.nomeCidade, c.nomeEstado].filter(Boolean).join(' - ') || null} width={150} />
          <Campo label="CEP" value={c.cepxxx} width={80} />
        </View>
      )}

      {/* Profissão */}
      {temProfissao && (
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Profissional</Text>
          <Campo label="Profissão" value={c.profiss} width={180} />
          <Campo label="Empresa" value={c.empres} width={200} />
        </View>
      )}

      {/* Observações */}
      {temObs && (
        <View style={s.secaoUltima}>
          <Text style={s.secaoTitulo}>Observações</Text>
          <Text style={s.obsTexto}>{c.obsxxx}</Text>
        </View>
      )}

    </View>
  );
}

function RelatorioClientesPDF({ clientes, titulo = 'Relatório de Clientes', empresa, logo }: Props) {
  const nomeEmpresa = empresa || 'Leilões 2026';
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

  return (
    <Document title={titulo} author={nomeEmpresa} creator={nomeEmpresa}>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho do documento */}
        <View style={s.docHeader} fixed>
          <View style={s.docHeaderEsquerda}>
            {logo ? (
              <Image src={logo} style={s.docHeaderLogo} />
            ) : (
              <Text style={s.docHeaderTitulo}>{nomeEmpresa}</Text>
            )}
            <Text style={s.docHeaderSub}>{titulo}</Text>
          </View>
          <View style={s.docHeaderDireita}>
            <Text style={s.docHeaderData}>Gerado em: {agora}</Text>
            <Text style={s.docHeaderTotal}>{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} selecionado{clientes.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Cards dos clientes */}
        {clientes.map((c, i) => (
          <CardCliente key={c.id} cliente={c} index={i} />
        ))}

        {/* Footer com paginação */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{nomeEmpresa} — Sistema de Gestão</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

export function BotaoBaixarPDF({ clientes, titulo, empresa, logo }: Props) {
  const nomeArquivo = `relatorio-clientes-${new Date().toISOString().slice(0, 10)}.pdf`;

  return (
    <PDFDownloadLink
      document={<RelatorioClientesPDF clientes={clientes} titulo={titulo} empresa={empresa} logo={logo} />}
      fileName={nomeArquivo}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <Button
          type="primary"
          danger
          icon={<FilePdfOutlined />}
          loading={loading}
          disabled={clientes.length === 0}
        >
          {loading ? 'Gerando PDF...' : 'Baixar PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

export default RelatorioClientesPDF;
