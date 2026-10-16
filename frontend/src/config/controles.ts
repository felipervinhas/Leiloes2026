/**
 * Controles da área Financeiro (/:banco/financeiro), contratada à parte. Não contam como
 * restrição do sistema principal: lá, nenhum controle marcado = acesso total, e marcar só
 * "Conciliação Bancária" não pode tirar o resto do menu do usuário.
 */
export const CONTROLES_FINANCEIRO = ['Conciliação Bancária'];

/** Os controles que restringem o menu do sistema principal (sem os do Financeiro). */
export const controlesDoSistema = (controles: string[] | undefined | null) =>
  (controles || []).filter(c => !CONTROLES_FINANCEIRO.includes(c));
