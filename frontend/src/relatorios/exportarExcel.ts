import * as XLSX from 'xlsx';
import { ClienteCompleto } from './RelatorioClientes';

export function exportarClientesExcel(clientes: ClienteCompleto[], nomeArquivo = 'clientes') {
  const linhas = clientes.map(c => ({
    'ID': c.id,
    'Nome': c.nomexx ?? '',
    'CPF': c.cpfxxx ?? '',
    'CNPJ': c.cnpjxx ?? '',
    'RG': c.rgxxxx ?? '',
    'Estado Civil': c.estciv ?? '',
    'Data Nasc.': c.datnas ? new Date(c.datnas).toLocaleDateString('pt-BR') : '',
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
    'Cadastrado em': c.datcad ? new Date(c.datcad).toLocaleDateString('pt-BR') : '',
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
