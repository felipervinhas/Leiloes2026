import * as XLSX from 'xlsx';
import { ClienteCompleto } from './RelatorioClientes';
import { fmtDataUTC } from '../utils/data';

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
  const sexo = (c?: string) => (c === 'M' ? 'Macho' : c === 'F' ? 'Fêmea' : c === 'N' ? 'Neutro' : '');
  const linhas = lotes.map(l => ({
    'Lote': l.lotexx ?? '',
    'Ordem': l.ordem ?? '',
    'Descrição': l.deslot ?? '',
    'Vendedor': l.nomeVendedor ?? '',
    'Raça': l.nomeRaca ?? '',
    'Sexo': sexo(l.catego),
    'Qtd. Animais': l.qtdAnimais ?? '',
    'Peso': l.pesoxx ?? '',
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
    { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 11 }, { wch: 30 }, { wch: 22 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lotes');

  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}-${data}.xlsx`);
}
