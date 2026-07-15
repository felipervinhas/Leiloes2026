/**
 * Apelidos públicos de banco: o cliente acessa pelo alias (URL, login),
 * nunca pelo nome real do banco de dados. Necessário por cláusula contratual
 * com alguns clientes que não podem ver o nome real do tenant.
 */
const BANCO_ALIASES: Record<string, string> = {
  AgendaRemates: 'LoteRural',
};

export function resolveBancoReal(bancoPublico: string): string {
  return BANCO_ALIASES[bancoPublico] ?? bancoPublico;
}
