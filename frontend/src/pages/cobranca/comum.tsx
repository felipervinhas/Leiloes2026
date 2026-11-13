import React from 'react';
import { Select, Spin, Tag } from 'antd';
import { useBuscaClientes } from '../../hooks/useBuscaClientes';

export const fmtValor = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtData = (v: string | null | undefined) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '—');

export const SITUACOES: Record<string, { label: string; cor: string }> = {
  ABERTA: { label: 'A vencer', cor: 'blue' },
  VENCIDA: { label: 'Vencida', cor: 'red' },
  PARCIAL: { label: 'Paga em parte', cor: 'gold' },
  PAGA: { label: 'Paga', cor: 'green' },
  QUITADA_ANTERIOR: { label: 'Quitada antes', cor: 'default' },
};

export const TagSituacao = ({ s }: { s: string }) => {
  const x = SITUACOES[s] || { label: s, cor: 'default' };
  return <Tag color={x.cor} style={{ marginRight: 0 }}>{x.label}</Tag>;
};

export const DESTINOS = [
  { value: 'VENDEDOR', label: 'Conta do vendedor' },
  { value: 'MACEDO', label: 'Conta da leiloeira' },
];
export const nomeDestino = (d: string) => (d === 'MACEDO' ? 'Conta da leiloeira' : 'Conta do vendedor');

export const SITUACOES_FECHAMENTO: Record<string, { label: string; cor: string }> = {
  FECHADO: { label: 'Fechado', cor: 'blue' },
  COBRADO: { label: 'Cobrado', cor: 'gold' },
  PAGO: { label: 'Pago', cor: 'green' },
};

/** Seletor de cliente (vendedor/comprador) por digitação. */
export function SeletorCliente({ value, onChange, rotulo, placeholder, style }: {
  value?: number; onChange: (id?: number, nome?: string) => void; rotulo?: string | null; placeholder?: string; style?: React.CSSProperties;
}) {
  const { opcoes, carregando, buscar, garantirOpcao } = useBuscaClientes();
  React.useEffect(() => { if (value && rotulo) garantirOpcao(value, rotulo); }, [value, rotulo, garantirOpcao]);
  return (
    <Select showSearch allowClear filterOption={false} placeholder={placeholder || 'Digite o nome'} style={{ width: 320, ...style }}
      value={value} options={opcoes} onSearch={buscar} loading={carregando}
      notFoundContent={carregando ? <Spin size="small" /> : 'Digite 2 letras ou mais'}
      onChange={(v?: number) => onChange(v, opcoes.find(o => o.value === v)?.label)} />
  );
}

/** Mês atual em AAAA-MM. */
export const mesAtual = () => new Date().toISOString().slice(0, 7);
export const nomeMes = (comp: string) => {
  const [a, m] = comp.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

/** Cabeçalho das páginas da área Cobrança (cobranca.css). */
export function Cabecalho({ titulo, sub, extra }: { titulo: string; sub?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="cb-cabecalho">
      <div>
        <h1>{titulo}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {extra && <div>{extra}</div>}
    </div>
  );
}

/** Cartão de número em destaque (principal = verde, para o número mais importante da tela). */
export function Destaque({ rotulo, valor, sub, tom, principal }: {
  rotulo: string; valor: React.ReactNode; sub?: React.ReactNode; tom?: 'alerta' | 'ok'; principal?: boolean;
}) {
  return (
    <div className={`cb-destaque${principal ? ' principal' : ''}`}>
      <div className="cb-destaque-rotulo">{rotulo}</div>
      <div className={`cb-destaque-valor${tom ? ` ${tom}` : ''}`}>{valor}</div>
      {sub && <div className="cb-destaque-sub">{sub}</div>}
    </div>
  );
}
