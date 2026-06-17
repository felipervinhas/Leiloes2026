import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

export function useColumnWidths(chave: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(defaults);
  const latestRef = useRef<Record<string, number>>(defaults);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get(`/preferencias/colWidths_${chave}`)
      .then(r => {
        if (r.data?.valor && typeof r.data.valor === 'object') {
          const merged = { ...defaults, ...r.data.valor };
          latestRef.current = merged;
          setWidths(merged);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const setWidth = useCallback((col: string, width: number) => {
    const w = Math.max(width, 50);
    const next = { ...latestRef.current, [col]: w };
    latestRef.current = next;
    setWidths(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api.put(`/preferencias/colWidths_${chave}`, { valor: latestRef.current }).catch(() => {});
    }, 800);
  }, [chave]);

  // Retorna helper para simplificar a definição de colunas
  function rz(col: string) {
    return {
      width: widths[col],
      onHeaderCell: (c: any) => ({
        width: c.width,
        onResize: (_: any, { size }: any) => setWidth(col, size.width),
      }),
    };
  }

  return { widths, setWidth, rz };
}
