import * as XLSX from 'xlsx';
import { ClienteCompleto } from './RelatorioClientes';
import { fmtDataUTC } from '../utils/data';
import { nomeCategoria } from '../utils/lote';

export function exportarClientesExcel(clientes: ClienteCompleto[], nomeArquivo = 'clientes') {
  const linhas = clientes.map(c => ({
    'ID': c.id,
    'Nome': c.nomexx ?? '',
    'CPF': c.cpfxxx ?? '',
    'CNPJ': c.cnpjxx ?? '',
    'RG': c.rgxxxx ?? '',
    'Estado Civil': c.estciv ?? '',
    'Data Nasc.': fmtDataUTC(c.datnas, ''),
    'E-mail': c.emailx ?? '',
    'E-mail 2': c.email2 ?? '',
    'Tel. Residencial': c.telres ?? '',
    'Tel. Comercial': c.telcom ?? '',
    'Celular 1': c.celu1 ?? '',
    'Celular 2': c.celu2 ?? '',
    'Endereço': c.endere ?? '',
    'Complemento': c.comple ?? '',
    'Bairro': c.bairro ?? '',
    'Cidade': c.nomeCidade ?? '',
    'Estado': c.nomeEstado ?? '',
    'CEP': c.cepxxx ?? '',
    'Profissão': c.profiss ?? '',
    'Empresa': c.empres ?? '',
    'Ativo': c.ativox === 'S' ? 'Sim' : 'Não',
    'Bloqueado': c.blocli ?? '',
    'Observações': c.obsxxx ?? '',
    'Cadastrado em': fmtDataUTC(c.datcad, ''),
  }));

  const ws = XLSX.utils.json_to_sheet(linhas);

  ws['!cols'] = [
    { wch: 8 },  // ID
    { wch: 36 }, // Nome
    { wch: 16 }, // CPF
    { wch: 18 }, // CNPJ
    { wch: 14 }, // RG
    { wch: 14 }, // Estado Civil
    { wch: 12 }, // Data Nasc
    { wch: 32 }, // E-mail
    { wch: 32 }, // E-mail 2
    { wch: 16 }, // Tel Res
    { wch: 16 }, // Tel Com
    { wch: 16 }, // Cel 1
    { wch: 16 }, // Cel 2
    { wch: 36 }, // Endereço
    { wch: 18 }, // Complemento
    { wch: 20 }, // Bairro
    { wch: 22 }, // Cidade
    { wch: 10 }, // Estado
    { wch: 12 }, // CEP
    { wch: 20 }, // Profissão
    { wch: 26 }, // Empresa
    { wch: 8 },  // Ativo
    { wch: 10 }, // Bloqueado
    { wch: 40 }, // Observações
    { wch: 14 }, // Cadastrado em
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}-${data}.xlsx`);
}

export function exportarVendasExcel(vendas: any[], nomeArquivo = 'vendas') {
  const linhas = vendas.map(v => ({
    'Cód': v.id,
    'Status': v.defesa === 'S' ? 'Vendido' : 'Pendente',
    'Boleto': v.codnot ?? '',
    'Leilão': v.leilao ?? '',
    'Data': fmtDataUTC(v.datlan, ''),
    'Lote': v.lotexx ?? '',
    'Descrição': v.deslot ?? '',
    'Comprador': v.nomexx ?? '',
    'Qtd': v.qtdxxx ?? '',
    'Vlr. Parcela': v.vlrpar ?? '',
    'Vlr. Total': v.vlrtot ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = [
    { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 26 }, { wch: 12 },
    { wch: 10 }, { wch: 30 }, { wch: 26 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}-${data}.xlsx`);
}

/** Lotes cadastrados num leilão (tela de Lotes) — conferência antes do lançamento das vendas. */
export function exportarLotesExcel(lotes: any[], condicoes: Record<number, string>, nomeArquivo = 'lotes') {
  const sexo = (c?: string) => nomeCategoria(c);
  const linhas = lotes.map(l => ({
    'Lote': l.lotexx ?? '',
    'Ordem': l.ordem ?? '',
    'Descrição': l.deslot ?? '',
    'Vendedor': l.nomeVendedor ?? '',
    'Raça': l.nomeRaca ?? '',
    'Sexo': sexo(l.catego),
    'Qtd. Animais': l.qtdAnimais ?? '',
    'Peso': l.pesoxx ?? '',
    'Perímetro Escrotal (cm)': l.perimetroEscrotal ?? '',
    'RP / Tatuagem': l.rpxxx ?? '',
    'SBB / Registro': l.sbbxxx ?? '',
    'Pelagem': l.pelage ?? '',
    'Data Nasc.': fmtDataUTC(l.datnas, ''),
    'Filiação': l.filiacao ?? '',
    'Condição Pagto.': l.condic ? (condicoes[l.condic] ?? '') : '',
    'Comissão Leiloeiro (%)': l.comcom ?? '',
    'Comissão Vendedor (%)': l.comven ?? '',
    'Vendido': l.vendido === 'S' ? 'Sim' : 'Não',
    'Observações': l.obslot ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = [
    { wch: 8 }, { wch: 7 }, { wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 10 },
    { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 11 }, { wch: 30 }, { wch: 22 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lotes');

  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}-${data}.xlsx`);
}

/** Ajusta a largura das colunas ao maior conteúdo (limitada), para a planilha abrir legível. */
function larguraAutomatica(linhas: Record<string, any>[]) {
  const cabecalho = Object.keys(linhas[0] || {});
  return cabecalho.map(k => ({
    wch: Math.min(50, Math.max(k.length, ...linhas.map(l => String(l[k] ?? '').length)) + 2),
  }));
}

/**
 * Mapa de Compradores em planilha — mesmo conteúdo da página "Mapa de Compradores" do PDF:
 * uma linha por lote, com os dados do comprador repetidos e o destino (localidade,
 * propriedade, inscrição), ordenada por comprador e lote.
 */
export function exportarMapaCompradoresExcel(vendas: any[], rotuloRP: string, nomeArquivo = 'mapa-compradores') {
  const telefones = (v: any) => Array.from(new Set(
    [v.celularComprador, v.celular2Comprador, v.telcomComprador, v.telresComprador]
      .map((t: any) => String(t || '').trim()).filter(Boolean),
  )).join(' / ');
  const linhas = [...vendas]
    .sort((a, b) => String(a.nomeComprador || '').localeCompare(String(b.nomeComprador || ''))
      || String(a.lotexx || '').localeCompare(String(b.lotexx || ''), 'pt-BR', { numeric: true }))
    .map(v => ({
      'Comprador': v.nomeComprador || '',
      'CPF/CNPJ': v.cpfComprador || v.cnpjComprador || '',
      'Telefones': telefones(v),
      'Cidade (propriedade)': v.cidadePropriedade || '',
      'UF': v.estadoPropriedade || '',
      'Lote': v.lotexx || '',
      'Descrição': v.deslot || '',
      [rotuloRP]: v.rpxxx || '',
      // propriedade sem localidade preenchida: mesma regra do PDF (cidade da propriedade)
      'Localidade': String(v.localidade || '').trim() || [v.cidadePropriedade, v.estadoPropriedade].filter(Boolean).join(' / '),
      'Propriedade': v.nomePropriedade || '',
      'Inscrição': v.inscricao || '',
      'Vendedor': v.nomeVendedor || '',
    }));
  if (!linhas.length) return;
  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = larguraAutomatica(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mapa de Compradores');
  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}-${data}.xlsx`);
}

/**
 * Relação de Compradores em planilha — uma linha por fazenda de cada comprador (o comprador
 * sem propriedade cadastrada sai numa linha só), com endereço, telefones e e-mail.
 */
export function exportarRelacaoCompradoresExcel(dados: { leilao?: string; compradores: any[] }, nomeArquivo = 'relacao-compradores') {
  const linhas: Record<string, any>[] = [];
  for (const c of dados.compradores || []) {
    const base = {
      'Comprador': c.nomexx || '',
      'CPF/CNPJ': c.cpfxxx || c.cnpjxx || '',
      'Endereço': c.endere || '',
      'Bairro': c.bairro || '',
      'CEP': c.cepxxx || '',
      'Cidade': c.nomeCidade || '',
      'UF': c.nomeEstado || '',
      'Celular': c.celu1 || '',
      'Celular 2': c.celu2 || '',
      'Tel. comercial': c.telcom || '',
      'Tel. residencial': c.telres || '',
      'E-mail': c.emailx || '',
    };
    const props = c.propriedades?.length ? c.propriedades : [null];
    for (const p of props) {
      linhas.push({
        ...base,
        'Propriedade': p?.nomePropriedade || '',
        'Cidade da propriedade': p?.cidade || '',
        'UF da propriedade': p?.estado || '',
        'Inscrição': p?.inscricao || '',
        'INCRA': p?.incra || '',
      });
    }
  }
  if (!linhas.length) return;
  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = larguraAutomatica(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relação de Compradores');
  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}-${data}.xlsx`);
}
