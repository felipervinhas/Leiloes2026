// Linha de peso do lote nas faturas, promissória e fatura unificada.
// Quando o banco usa o peso TOTAL do lote (Knorr — lotes vendidos pelo preço do kg),
// mostra o total e o preço por kg: "Peso total: 3.193 kg · R$ 18,00/kg".
// Nos demais (peso por cabeça) continua como sempre foi: "Peso: 450 kg".

const fmtKg = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * @param pesoxx  Lotes.PESOXX
 * @param total   regra do banco (true = peso total do lote)
 * @param valor   valor bruto correspondente aos kg (lote inteiro ou parte do comprador)
 * @param kg      kg correspondentes ao valor; padrão = o próprio PESOXX
 */
export function linhaPeso(pesoxx?: number | null, total?: boolean, valor?: number | null, kg?: number | null): string | null {
  const peso = Number(pesoxx) || 0;
  if (peso <= 0) return null;
  if (!total) return `Peso: ${peso} kg`;
  const kgBase = Number(kg) || peso;
  const v = Number(valor) || 0;
  return `Peso total: ${fmtKg(kgBase)} kg${v > 0 ? ` · ${fmtR(v / kgBase)}/kg` : ''}`;
}
