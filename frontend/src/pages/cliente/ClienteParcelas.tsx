import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer, Skeleton, message } from 'antd';
import portalApi from '../../services/portalApi';
import { useConfig } from '../../context/ConfigContext';
import { baixarRelatorioFinanceiro } from '../../relatorios/RelatorioFinanceiro';
import { exportarPlanilha } from '../financeiro/comum';
import { fmtData, fmtValor } from '../cobranca/comum';
import { Historico, ModalRenegociar } from '../cobranca/CobrancaParcelas';

type Lado = 'VENDEDOR' | 'COMPRADOR';
interface ParcelaPortal {
  id: number; idMovLote: number; idLeilao: number | null; leilao: string | null; dataLeilao: string | null;
  lote: string | null; animal: string | null; vendedor: string | null; comprador: string | null; ordxxx: string;
  vencimento: string | null; valor: number; pago: number; saldo: number; dataPagamento: string | null;
  quemCobra: 'ESCRITORIO' | 'COBRANCA' | 'VENDEDOR'; destino: 'MACEDO' | 'VENDEDOR' | null;
  situacao: string | null; podeRenegociar: boolean;
}
type Estado = 'pago' | 'parcial' | 'atraso' | 'passou' | 'futuro';
interface Venda {
  chave: number; leilao: string | null; dataLeilao: string | null; lote: string | null; animal: string | null;
  pessoa: string | null; parcelas: ParcelaPortal[]; total: number; falta: number; proxima: ParcelaPortal | null;
  naCobranca: boolean; atrasos: number;
}

const hojeIso = () => new Date().toISOString().slice(0, 10);
const curto = (v: number) => v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: v >= 10000 ? 0 : 1 })} mil` : fmtValor(v).replace('R$', '').trim();
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const titulo = (s: string | null) => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

function estado(p: ParcelaPortal, hoje: string): Estado {
  if (p.situacao === 'PAGA' || p.situacao === 'QUITADA_ANTERIOR') return 'pago';
  if (p.situacao === 'PARCIAL') return 'parcial';
  if (p.situacao === 'VENCIDA') return 'atraso';
  return p.vencimento && p.vencimento < hoje ? 'passou' : 'futuro';
}
const ROTULO: Record<Estado, string> = { pago: 'Pago', parcial: 'Pago em parte', atraso: 'Em atraso', passou: 'Venceu', futuro: 'A vencer' };
const PILULA: Record<Estado, string> = { pago: 'verde', parcial: 'ouro', atraso: 'vermelha', passou: 'cinza', futuro: 'cinza' };

/**
 * "O que recebo" (lado VENDEDOR) e "O que pago" (lado COMPRADOR). Valores a vencer são
 * sempre confiáveis; pago/atraso só aparecem onde a leiloeira controla (intermediação de
 * cobrança) ou há baixa registrada — o resto mostra só que a data já passou.
 */
export default function ClienteParcelas({ lado }: { lado: Lado }) {
  const config = useConfig();
  const ehVendedor = lado === 'VENDEDOR';
  const [dados, setDados] = useState<ParcelaPortal[] | null>(null);
  const [filtro, setFiltro] = useState<'ANDAMENTO' | 'TODAS'>('ANDAMENTO');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<number | null>(null);
  const [limite, setLimite] = useState(12);
  const [hist, setHist] = useState<ParcelaPortal | null>(null);
  const [reneg, setReneg] = useState<ParcelaPortal | null>(null);

  const carregar = useCallback(async () => {
    try { setDados((await portalApi.get(ehVendedor ? '/recebimentos' : '/pagamentos')).data); }
    catch (e: any) { setDados([]); message.error(e.response?.data?.error || 'Não foi possível carregar'); }
  }, [ehVendedor]);
  useEffect(() => { setDados(null); setAberta(null); carregar(); }, [carregar]);

  const hoje = hojeIso();
  const todas = dados || [];
  const futuras = todas.filter(p => p.vencimento && p.vencimento >= hoje && p.saldo > 0.009);
  const aVencer = futuras.reduce((a, p) => a + p.saldo, 0);
  const proxima = futuras[0] || null;
  const cobranca = todas.filter(p => p.quemCobra === 'COBRANCA');
  const recebidoCobranca = cobranca.reduce((a, p) => a + p.pago, 0);
  const atrasadas = cobranca.filter(p => p.situacao === 'VENCIDA' || (p.situacao === 'PARCIAL' && !!p.vencimento && p.vencimento < hoje));
  const valorAtraso = atrasadas.reduce((a, p) => a + p.saldo, 0);
  const ultima = futuras.length ? futuras[futuras.length - 1].vencimento : null;

  const meses = useMemo(() => {
    const base = new Date();
    const lista = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      return { chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, nome: MES[d.getMonth()], ano: d.getFullYear(), valor: 0 };
    });
    for (const p of futuras) { const m = lista.find(x => x.chave === p.vencimento!.slice(0, 7)); if (m) m.valor += p.saldo; }
    return lista;
  }, [futuras]);
  const maiorMes = Math.max(1, ...meses.map(m => m.valor));

  const vendas = useMemo<Venda[]>(() => {
    const mapa = new Map<number, Venda>();
    for (const p of todas) {
      const v = mapa.get(p.idMovLote) || {
        chave: p.idMovLote, leilao: p.leilao, dataLeilao: p.dataLeilao, lote: p.lote, animal: p.animal,
        pessoa: ehVendedor ? p.comprador : p.vendedor, parcelas: [], total: 0, falta: 0, proxima: null, naCobranca: false, atrasos: 0,
      };
      // lote dividido entre compradores: a mesma venda aparece por comprador
      if (ehVendedor && v.pessoa !== p.comprador && v.parcelas.length) v.pessoa = 'Vários compradores';
      v.parcelas.push(p); v.total += p.valor;
      if (p.vencimento && p.vencimento >= hoje) v.falta += p.saldo;
      if (!v.proxima && p.vencimento && p.vencimento >= hoje && p.saldo > 0.009) v.proxima = p;
      if (p.quemCobra === 'COBRANCA') v.naCobranca = true;
      if (estado(p, hoje) === 'atraso') v.atrasos++;
      mapa.set(p.idMovLote, v);
    }
    return Array.from(mapa.values()).sort((a, b) =>
      (b.atrasos ? 1 : 0) - (a.atrasos ? 1 : 0)
      || (a.proxima ? 0 : 1) - (b.proxima ? 0 : 1)
      || String(a.proxima?.vencimento || '').localeCompare(String(b.proxima?.vencimento || ''))
      || String(b.dataLeilao).localeCompare(String(a.dataLeilao)));
  }, [todas, ehVendedor, hoje]);

  const termo = busca.trim().toLowerCase();
  const visiveis = vendas.filter(v => {
    if (filtro === 'ANDAMENTO' && !v.proxima && !v.atrasos) return false;
    if (termo && ![v.animal, v.pessoa, v.leilao, v.lote].some(x => String(x || '').toLowerCase().includes(termo))) return false;
    return true;
  });

  const exportar = () => exportarPlanilha(todas.map(p => ({
    Vencimento: fmtData(p.vencimento), Leilão: p.leilao, Lote: p.lote, Animal: p.animal,
    [ehVendedor ? 'Comprador' : 'Vendedor']: ehVendedor ? p.comprador : p.vendedor, Parcela: p.ordxxx, Valor: p.valor,
    [ehVendedor ? 'Recebido' : 'Pago']: p.pago, Situação: ROTULO[estado(p, hoje)],
  })), ehVendedor ? 'meus-recebimentos' : 'meus-pagamentos', ehVendedor ? 'Recebimentos' : 'Pagamentos');

  const pdf = async () => {
    try {
      await baixarRelatorioFinanceiro({
        titulo: ehVendedor ? 'Meus recebimentos' : 'Meus pagamentos', subtitulo: 'Parcelas a vencer',
        empresa: config.empresa, logoBase64: config.logoBase64,
        resumo: [
          { label: ehVendedor ? 'A receber' : 'A pagar', valor: fmtValor(aVencer), detalhe: `${futuras.length} parcelas` },
          { label: 'Próximo vencimento', valor: proxima ? fmtData(proxima.vencimento) : '—', detalhe: proxima ? fmtValor(proxima.saldo) : undefined },
        ],
        colunas: [{ titulo: 'Vencimento', flex: 0.8 }, { titulo: 'Leilão', flex: 1.6 }, { titulo: 'Lote', flex: 0.4 }, { titulo: 'Animal', flex: 1.6 },
          { titulo: ehVendedor ? 'Comprador' : 'Vendedor', flex: 1.8 }, { titulo: 'Parcela', flex: 0.6 }, { titulo: 'Valor', direita: true }],
        linhas: futuras.map(p => ({ celulas: [fmtData(p.vencimento), p.leilao || '', p.lote || '', p.animal || '',
          (ehVendedor ? p.comprador : p.vendedor) || '', p.ordxxx, fmtValor(p.saldo)] })),
        total: ['', 'Total', '', '', '', '', fmtValor(aVencer)],
      }, ehVendedor ? 'meus-recebimentos' : 'meus-pagamentos');
    } catch { message.error('Não foi possível gerar o PDF'); }
  };

  if (!dados) {
    return <div className="pc-card"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  }
  if (!todas.length) {
    return (
      <div className="pc-card pc-vazio">
        <b>{ehVendedor ? 'Nenhuma venda sua na cobrança da leiloeira' : 'Nenhuma compra por aqui ainda'}</b>
        {ehVendedor ? 'Quando a leiloeira assumir a cobrança de um animal seu, as parcelas aparecem aqui.' : 'Quando você arrematar em um leilão, as parcelas aparecem aqui.'}
      </div>
    );
  }

  return (
    <>
      <section className="pc-destaques">
        <div className="pc-card pc-destaque-principal">
          <div className="pc-rotulo">{ehVendedor ? 'Ainda vai receber' : 'Ainda vai pagar'}</div>
          <div className="pc-valor">{fmtValor(aVencer)}</div>
          <div className="pc-sub">em <b>{futuras.length}</b> parcela{futuras.length === 1 ? '' : 's'}{ultima ? <> · até <b>{MES[Number(ultima.slice(5, 7)) - 1]}/{ultima.slice(0, 4)}</b></> : null}</div>
        </div>
        <div className="pc-card">
          <div className="pc-rotulo">Próximo vencimento</div>
          {proxima ? <>
            <div className="pc-valor medio">{fmtValor(proxima.saldo)}</div>
            <div className="pc-sub"><b>{fmtData(proxima.vencimento)}</b> · {titulo(ehVendedor ? proxima.comprador : proxima.vendedor)}</div>
          </> : <div className="pc-sub">Nada a vencer</div>}
        </div>
        <div className="pc-card">
          <div className="pc-rotulo">Cobrança da leiloeira</div>
          {cobranca.length ? <>
            <div className="pc-valor medio">{fmtValor(recebidoCobranca)}</div>
            <div className="pc-sub">{ehVendedor ? 'já recebido' : 'já pago'}{' '}
              {atrasadas.length
                ? <span className="pc-pilula vermelha">{atrasadas.length} em atraso · {fmtValor(valorAtraso)}</span>
                : <span className="pc-pilula verde">em dia</span>}
            </div>
          </> : <div className="pc-sub">{ehVendedor ? 'Nenhum lote seu está na cobrança da leiloeira.' : 'Nenhuma compra sua está na cobrança da leiloeira.'}</div>}
        </div>
      </section>

      {futuras.length > 0 && (
        <section className="pc-duas">
          <div className="pc-card pc-grafico">
            <h3 className="pc-titulo">{ehVendedor ? 'Quanto entra por mês' : 'Quanto sai por mês'} <small>próximos 12 meses</small></h3>
            <div className="pc-meses">
              {meses.map(m => (
                <div key={m.chave} className="pc-mes" title={`${m.nome}/${m.ano}: ${fmtValor(m.valor)}`}>
                  <div className="pc-mes-valor">{m.valor ? curto(m.valor) : ''}</div>
                  <div className="pc-mes-barra" style={{ height: `${Math.max(3, (m.valor / maiorMes) * 100)}%`, opacity: m.valor ? 1 : 0.25 }} />
                  <div className="pc-mes-nome">{m.nome}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pc-card">
            <h3 className="pc-titulo">Agenda</h3>
            <div className="pc-agenda">
              {futuras.slice(0, 5).map(p => (
                <div key={p.id} className={`pc-agenda-item${p.vencimento === hoje ? ' hoje' : ''}`}>
                  <div className="pc-data"><b>{p.vencimento!.slice(8, 10)}</b><span>{MES[Number(p.vencimento!.slice(5, 7)) - 1]}</span></div>
                  <div className="pc-agenda-txt">
                    <div>{titulo(p.animal) || `Lote ${p.lote}`}</div>
                    <small>{titulo(ehVendedor ? p.comprador : p.vendedor)} · parcela {p.ordxxx}</small>
                  </div>
                  <div className="pc-agenda-valor">{fmtValor(p.saldo)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <h3 className="pc-titulo">
        {ehVendedor ? 'Suas vendas' : 'Suas compras'}
        <span>
          <button className="pc-acao" onClick={exportar}>Planilha</button>
          <button className="pc-acao" onClick={pdf}>PDF</button>
        </span>
      </h3>
      <div className="pc-filtros">
        <input className="pc-busca" placeholder={`Buscar animal, ${ehVendedor ? 'comprador' : 'vendedor'} ou leilão`} value={busca}
          onChange={e => { setBusca(e.target.value); setLimite(12); }} />
        {([['ANDAMENTO', 'Em andamento'], ['TODAS', 'Todas']] as const).map(([k, l]) => (
          <button key={k} className={`pc-chip${filtro === k ? ' ativo' : ''}`} onClick={() => { setFiltro(k); setLimite(12); }}>{l}</button>
        ))}
      </div>
      <div className="pc-legenda">
        <span><i style={{ background: 'var(--pc-pago)' }} />Pago</span>
        <span><i style={{ background: 'var(--pc-atraso)' }} />Em atraso</span>
        <span><i style={{ background: 'var(--pc-passou)' }} />Data já passou</span>
        <span><i style={{ background: 'var(--pc-futuro)' }} />A vencer</span>
      </div>

      {!visiveis.length ? (
        <div className="pc-card pc-vazio"><b>Nada encontrado</b>Tente outro filtro ou outra busca.</div>
      ) : (
        <div className="pc-vendas">
          {visiveis.slice(0, limite).map(v => {
            const ab = aberta === v.chave;
            const pagas = v.parcelas.filter(p => estado(p, hoje) === 'pago').length;
            return (
              <article key={v.chave} className={`pc-card pc-venda${ab ? ' aberta' : ''}`} onClick={() => !ab && setAberta(v.chave)}>
                <div className="pc-venda-topo">
                  <div style={{ minWidth: 0 }}>
                    <span className="pc-lote">Lote {v.lote}</span>
                    {v.atrasos > 0 && <span className="pc-pilula vermelha" style={{ marginLeft: 6 }}>{v.atrasos} em atraso</span>}
                    <div className="pc-animal">{titulo(v.animal) || 'Lote sem descrição'}</div>
                    <div className="pc-leilao">{titulo(v.leilao)} · {fmtData(v.dataLeilao)}</div>
                  </div>
                  {ab && <button className="pc-fechar" onClick={e => { e.stopPropagation(); setAberta(null); }}>Fechar</button>}
                </div>
                <div className="pc-pessoa">{ehVendedor ? 'Comprador' : 'Vendedor'}: <b>{titulo(v.pessoa)}</b></div>
                <div className="pc-trilho" title={`${v.parcelas.length} parcelas`}>
                  {v.parcelas.map(p => <i key={p.id} className={estado(p, hoje)} />)}
                </div>
                <div className="pc-venda-rodape">
                  <div>{v.proxima
                    ? <>Próxima <b>{fmtData(v.proxima.vencimento)}</b> · {fmtValor(v.proxima.saldo)}</>
                    : <>Sem parcelas a vencer</>}
                    {v.naCobranca && pagas > 0 ? <> · {pagas} paga{pagas > 1 ? 's' : ''}</> : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>{v.falta > 0 ? <>faltam<br /><b>{fmtValor(v.falta)}</b></> : <>total<br /><b>{fmtValor(v.total)}</b></>}</div>
                </div>
                {ab && (
                  <>
                    <div className="pc-parcelas">
                      {v.parcelas.map(p => {
                        const e = estado(p, hoje);
                        return (
                          <div key={p.id} className={`pc-parcela ${e === 'pago' ? 'pago' : e === 'atraso' ? 'atraso' : ''}`}>
                            <div className="pc-parcela-l1"><span>Parcela {p.ordxxx}</span><span>{fmtData(p.vencimento)}</span></div>
                            <div className="pc-parcela-valor">{fmtValor(p.valor)}</div>
                            <div className="pc-parcela-l3">
                              <span className={`pc-pilula ${PILULA[e]}`}>{ROTULO[e]}{e === 'pago' && p.dataPagamento ? ` em ${fmtData(p.dataPagamento)}` : ''}</span>
                              <span>
                                {p.podeRenegociar && <button className="pc-mini" onClick={() => setReneg(p)}>Alterar</button>}{' '}
                                <button className="pc-mini" onClick={() => setHist(p)}>Histórico</button>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pc-nota">
                      {v.naCobranca
                        ? <>Nas parcelas da cobrança da leiloeira, {ehVendedor ? 'você pode alterar vencimento e valor ("Alterar") — vale na hora e fica no histórico' : 'o pagamento é registrado pela leiloeira'}. </>
                        : null}
                      "Data já passou" indica parcela cujo pagamento não é controlado pela leiloeira{ehVendedor ? ' (você recebe direto do comprador)' : ''}.
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
      {visiveis.length > limite && (
        <button className="pc-chip pc-mais" onClick={() => setLimite(l => l + 12)}>Mostrar mais {Math.min(12, visiveis.length - limite)} de {visiveis.length - limite}</button>
      )}

      {reneg && <ModalRenegociar http={portalApi} rota="/parcelas"
        parcela={{ id: reneg.id, ordxxx: reneg.ordxxx, lote: reneg.lote || '', comprador: reneg.comprador || '', valor: reneg.valor, vencimento: reneg.vencimento || '' }}
        onClose={ok => { setReneg(null); if (ok) carregar(); }} />}
      <Drawer open={!!hist} width={460} title={hist ? `Parcela ${hist.ordxxx} · lote ${hist.lote}` : ''} onClose={() => setHist(null)} destroyOnHidden>
        {hist && <HistoricoParcela id={hist.id} />}
      </Drawer>
    </>
  );
}

function HistoricoParcela({ id }: { id: number }) {
  const [itens, setItens] = useState<any[] | null>(null);
  useEffect(() => { portalApi.get(`/parcelas/${id}/historico`).then(r => setItens(r.data)).catch(() => setItens([])); }, [id]);
  return itens ? <Historico itens={itens} /> : <Skeleton active />;
}
