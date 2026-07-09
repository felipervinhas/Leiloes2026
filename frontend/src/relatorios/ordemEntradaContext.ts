export interface OrdemEntradaContexto {
  titulo: string;
  empresa: string;
  agora: string;
  totalLotes: number;
}

export function montarContextoOrdemEntrada(titulo: string | undefined, empresa: string | undefined, totalLotes: number): OrdemEntradaContexto {
  return {
    titulo: titulo || '—',
    empresa: empresa || 'Leilões 2026',
    agora: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    totalLotes,
  };
}
