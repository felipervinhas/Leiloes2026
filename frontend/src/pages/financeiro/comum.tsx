import React from 'react';
import { Select, Spin } from 'antd';
import * as XLSX from 'xlsx';
import { useBuscaLeiloes } from '../../hooks/useBuscaLeiloes';

/** Planilha simples a partir de linhas já com os nomes de coluna em português. */
export function exportarPlanilha(linhas: Record<string, any>[], nomeArquivo: string, aba = 'Dados') {
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba.slice(0, 31));
  XLSX.writeFile(wb, `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Seletor de leilão por digitação (mesma busca das outras telas do sistema). */
export function SeletorLeilao({ value, onChange, style }: {
  value?: number; onChange: (id?: number, nome?: string) => void; style?: React.CSSProperties;
}) {
  const { opcoes, carregando, buscar } = useBuscaLeiloes();
  return (
    <Select showSearch allowClear filterOption={false} placeholder="Digite o nome do leilão" style={{ width: 380, ...style }}
      value={value} options={opcoes} onSearch={buscar} loading={carregando}
      notFoundContent={carregando ? <Spin size="small" /> : 'Digite 2 letras ou mais'}
      onChange={(v?: number) => onChange(v, opcoes.find(o => o.value === v)?.label)} />
  );
}
