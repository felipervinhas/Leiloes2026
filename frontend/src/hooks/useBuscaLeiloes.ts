import { useCallback, useRef, useState } from 'react';
import api from '../services/api';
import { fmtDataUTC } from '../utils/data';

export interface OpcaoLeilao { value: number; label: string; }

/**
 * Busca leilões por digitação (debounce 350ms, mínimo 2 letras) em vez de
 * pré-carregar a tabela inteira de uma vez — usado nos vários Selects de
 * leilão espalhados pelo sistema (Lotes, Vendas, Despesas, Consulta de
 * Vendas etc.) que antes traziam todos os leilões ao montar a página.
 */
export function useBuscaLeiloes() {
  const [opcoes, setOpcoes] = useState<OpcaoLeilao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const buscar = useCallback((busca: string) => {
    clearTimeout(timer.current);
    if (busca.length < 2) { setOpcoes([]); return; }
    timer.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await api.get('/leiloes', { params: { busca } });
        // Data junto do nome — leilões recorrentes (ex.: mesmo remate todo ano)
        // têm o mesmo nome, e sem a data não dá pra saber qual escolher na busca.
        setOpcoes(r.data.map((l: any) => ({
          value: l.id,
          label: l.leilao
            ? `${l.leilao}${l.datlei ? ` — ${fmtDataUTC(l.datlei)}` : ''}`
            : `Leilão #${l.id}`,
        })));
      } finally { setCarregando(false); }
    }, 350);
  }, []);

  // Garante que o valor já selecionado (ex.: ao editar um registro
  // existente) apareça com o nome certo mesmo antes de o usuário digitar
  // uma busca — sem isso o Select mostraria só o código bruto.
  const garantirOpcao = useCallback((value?: number | null, label?: string | null) => {
    if (!value) return;
    setOpcoes(prev => prev.some(o => o.value === value)
      ? prev
      : [...prev, { value, label: label || `Leilão #${value} (não encontrado)` }]);
  }, []);

  return { opcoes, carregando, buscar, garantirOpcao, setOpcoes };
}
