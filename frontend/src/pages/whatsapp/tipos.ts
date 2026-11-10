export interface TemplateResumo {
  nome: string;
  idioma: string;
  categoria: string;
  status: string;
  formatoParametros: 'POSITIONAL' | 'NAMED';
  headerFormato: string | null;
  headerTexto: string | null;
  headerVariaveis: string[];
  bodyTexto: string;
  bodyVariaveis: string[];
  footerTexto: string | null;
  botoes: { indice: number; tipo: string; texto: string; url?: string; variavel: boolean }[];
}

export interface Fonte { value: string; label: string; exige?: 'leilao' | 'parcelas' }

export interface MapeamentoVar { fonte: string; valor?: string }

export interface Mapeamento {
  header?: Record<string, MapeamentoVar>;
  headerMidiaUrl?: string;
  body?: Record<string, MapeamentoVar>;
  botoes?: Record<string, MapeamentoVar>;
}

export interface Campanha {
  id: number;
  nome: string;
  templateNome: string;
  templateIdioma: string;
  categoria: string;
  templateTexto: string;
  idLeilao: number | null;
  leilao: string | null;
  status: string;
  agendadaPara: string | null;
  total: number;
  custoEstimado: number;
  custoReal: number;
  ultimoErro: string | null;
  criadaEm: string;
  criadaPor: string | null;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  pendentes: number;
  enviados: number;
  entregues: number;
  lidos: number;
  falhas: number;
  cancelados: number;
}

export const STATUS_CAMPANHA: Record<string, { label: string; color: string }> = {
  AGUARDANDO: { label: 'Aguardando início', color: 'default' },
  AGENDADA: { label: 'Agendada', color: 'purple' },
  ENVIANDO: { label: 'Enviando', color: 'processing' },
  PAUSADA: { label: 'Pausada', color: 'warning' },
  CONCLUIDA: { label: 'Concluída', color: 'success' },
  CANCELADA: { label: 'Cancelada', color: 'error' },
};

export const STATUS_ENVIO: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: 'Na fila', color: 'default' },
  PROCESSANDO: { label: 'Enviando', color: 'processing' },
  ENVIADO: { label: 'Enviada', color: 'blue' },
  ENTREGUE: { label: 'Entregue', color: 'cyan' },
  LIDO: { label: 'Lida', color: 'green' },
  FALHOU: { label: 'Falhou', color: 'red' },
  CANCELADO: { label: 'Cancelada', color: 'default' },
  IGNORADO: { label: 'Descadastrado', color: 'orange' },
};

export const CATEGORIA: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
};

export const fmtReais = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtDataHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const erroApi = (e: any, padrao: string) => e?.response?.data?.error || padrao;
