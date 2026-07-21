import { useCallback, useRef, useState } from 'react';
import api from '../services/api';

export interface OpcaoCliente { value: number; label: string; }

/**
 * Busca clientes por digitação (debounce 350ms, mínimo 2 letras) em vez de
 * pré-carregar a tabela inteira (+11 mil registros) — mesmo padrão do
 * useBuscaLeiloes, usado onde o Select de Cliente ainda carrega tudo de uma
 * vez (ex.: Despesas), o que deixa o campo lento/travado a ponto de parecer
 * que não é possível selecionar nada.
 */
export function useBuscaClientes() {
  const [opcoes, setOpcoes] = useState<OpcaoCliente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const buscar = useCallback((busca: string) => {
    clearTimeout(timer.current);
    if (busca.length < 2) { setOpcoes([]); return; }
    timer.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await api.get('/clientes', { params: { nome: busca } });
        setOpcoes(r.data.map((c: any) => ({ value: c.id, label: c.nomexx })));
      } finally { setCarregando(false); }
    }, 350);
  }, []);

  // Garante que o cliente já selecionado (ex.: ao editar um registro
  // existente) apareça com o nome certo antes do usuário digitar uma busca.
  const garantirOpcao = useCallback((value?: number | null, label?: string | null) => {
    if (!value) return;
    setOpcoes(prev => prev.some(o => o.value === value)
      ? prev
      : [...prev, { value, label: label || `Cliente #${value} (não encontrado)` }]);
  }, []);

  return { opcoes, carregando, buscar, garantirOpcao, setOpcoes };
}
