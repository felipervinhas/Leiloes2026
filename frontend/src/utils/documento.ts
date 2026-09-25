/**
 * Documento do cliente para exibição: CNPJ quando houver (pessoa jurídica — ex.:
 * transportadora com só CNPJ cadastrado), senão CPF. Mesma prioridade da Fatura
 * Unificada (faturaUnificadaContext).
 */
export function documentoCliente(cpf?: string | null, cnpj?: string | null): { tipo: 'CPF' | 'CNPJ'; numero: string } {
  const c = (cnpj || '').trim();
  if (c) return { tipo: 'CNPJ', numero: c };
  return { tipo: 'CPF', numero: (cpf || '').trim() };
}

/** "CNPJ: 00.000.000/0001-00" / "CPF: 000.000.000-00" / "CPF: não informado". */
export function fmtDocumento(cpf?: string | null, cnpj?: string | null, vazio = 'não informado'): string {
  const d = documentoCliente(cpf, cnpj);
  return `${d.tipo}: ${d.numero || vazio}`;
}
