import React, { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { Cabecalho, Destaque, fmtData, fmtValor } from './comum';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const curto = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: v >= 10000 ? 0 : 1 })} mil` : Math.round(v).toString());
const titulo = (s: string | null) => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

export default function CobrancaPainel() {
  const { banco } = useBanco();
  const navigate = useNavigate();
  const [resumo, setResumo] = useState<any>(null);
  const [abertas, setAbertas] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.get('/cobranca/resumo'), api.get('/cobranca/parcelas', { params: { situacao: 'EM_ABERTO' } })])
      .then(([r, a]) => { setResumo(r.data); setAbertas(a.data); })
      .catch(() => { setResumo({}); message.error('Erro ao carregar o painel'); });
  }, []);

  const hoje = new Date().toISOString().slice(0, 10);

  const meses = useMemo(() => {
    const base = new Date();
    const lista = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      return { chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, nome: MES[d.getMonth()], ano: d.getFullYear(), valor: 0, vencido: false };
    });
    let vencido = 0;
    for (const p of abertas) {
      if (p.vencimento < hoje) { vencido += p.saldo; continue; }
      const m = lista.find(x => x.chave === p.vencimento.slice(0, 7));
      if (m) m.valor += p.saldo;
    }
    return vencido > 0 ? [{ chave: 'vencido', nome: 'atraso', ano: 0, valor: vencido, vencido: true }, ...lista] : lista;
  }, [abertas, hoje]);
  const maior = Math.max(1, ...meses.map(m => m.valor));

  const atrasados = useMemo(() => {
    const m = new Map<number, any>();
    for (const p of abertas.filter(x => x.vencimento < hoje)) {
      const a = m.get(p.idComprador) || { id: p.idComprador, nome: p.comprador, vendedor: p.vendedor, qtd: 0, valor: 0, antiga: p.vencimento };
      a.qtd++; a.valor += p.saldo; if (p.vencimento < a.antiga) a.antiga = p.vencimento;
      m.set(p.idComprador, a);
    }
    return Array.from(m.values()).sort((a, b) => b.valor - a.valor);
  }, [abertas, hoje]);

  const vendedores = useMemo(() => {
    const m = new Map<number, any>();
    for (const p of abertas) {
      const v = m.get(p.idVendedor) || { id: p.idVendedor, nome: p.vendedor, lotes: new Set<number>(), aberto: 0, vencido: 0 };
      v.lotes.add(p.idLote); v.aberto += p.saldo; if (p.vencimento < hoje) v.vencido += p.saldo;
      m.set(p.idVendedor, v);
    }
    return Array.from(m.values()).sort((a, b) => b.aberto - a.aberto);
  }, [abertas, hoje]);
  const maiorVendedor = Math.max(1, ...vendedores.map(v => v.aberto));

  if (!resumo) return <><Cabecalho titulo="Painel" /><div className="cb-card"><Skeleton active paragraph={{ rows: 6 }} /></div></>;
  if (!resumo.lotes) {
    return (
      <>
        <Cabecalho titulo="Painel" sub="Acompanhe o que a leiloeira cobra para os vendedores." />
        <div className="cb-card cb-vazio">
          <b>Nenhum lote em cobrança ainda</b>
          Marque os lotes dos vendedores que contrataram a intermediação.
          <div style={{ marginTop: 16 }}><Button type="primary" onClick={() => navigate(`/${banco}/cobranca/lotes`)}>Incluir lotes na cobrança</Button></div>
        </div>
      </>
    );
  }

  const irParcelas = (q: string) => navigate(`/${banco}/cobranca/parcelas?${q}`);

  return (
    <>
      <Cabecalho titulo="Painel" sub={`${resumo.lotes} lote${resumo.lotes > 1 ? 's' : ''} em cobrança · ${resumo.vendedores} vendedor${resumo.vendedores > 1 ? 'es' : ''} · ${resumo.compradores} comprador${resumo.compradores > 1 ? 'es' : ''}`}
        extra={<Button type="primary" onClick={() => irParcelas('situacao=EM_ABERTO')}>Ver parcelas</Button>} />

      <section className="cb-destaques">
        <Destaque principal rotulo="A receber" valor={fmtValor(resumo.valorEmAberto)} sub={`${resumo.parcelasEmAberto} parcelas em aberto`} />
        <Destaque rotulo="Em atraso" valor={fmtValor(resumo.valorVencido)} tom={resumo.valorVencido > 0 ? 'alerta' : 'ok'}
          sub={resumo.parcelasVencidas ? `${resumo.parcelasVencidas} parcelas · ${atrasados.length} comprador${atrasados.length === 1 ? '' : 'es'}` : 'nenhuma parcela atrasada'} />
        <Destaque rotulo="Vence neste mês" valor={fmtValor(resumo.valorVencendoNoMes)} sub={`${resumo.vencendoNoMes} parcelas`} />
        <Destaque rotulo="Recebido no mês" valor={fmtValor(resumo.recebidoNoMes)} tom="ok" sub="baixas na cobrança e no extrato" />
      </section>

      <section className="cb-grade-2">
        <div className="cb-card cb-grafico">
          <h3 className="cb-card-titulo">A receber por mês <small>{meses[0]?.vencido ? 'em vermelho, o que já venceu' : 'próximos 12 meses'}</small></h3>
          <div className="cb-meses">
            {meses.map(m => (
              <div key={m.chave} className="cb-mes" title={`${m.vencido ? 'Em atraso' : `${m.nome}/${m.ano}`}: ${fmtValor(m.valor)}`}
                style={{ cursor: 'pointer' }} onClick={() => irParcelas(m.vencido ? 'situacao=VENCIDA' : 'situacao=EM_ABERTO')}>
                <div className="cb-mes-valor">{m.valor ? curto(m.valor) : ''}</div>
                <div className={`cb-mes-barra${m.vencido ? ' vencido' : ''}`} style={{ height: `${Math.max(2, (m.valor / maior) * 100)}%`, opacity: m.valor ? 1 : 0.25 }} />
                <div className="cb-mes-nome">{m.nome}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="cb-card">
          <h3 className="cb-card-titulo">Quem cobrar primeiro <small>{atrasados.length ? `${atrasados.length} em atraso` : ''}</small></h3>
          {!atrasados.length ? <div className="cb-vazio" style={{ padding: 24 }}><b>Tudo em dia</b>Nenhum comprador com parcela vencida.</div> : (
            <div className="cb-lista">
              {atrasados.slice(0, 7).map(a => (
                <div key={a.id} className="cb-lista-item" onClick={() => irParcelas(`situacao=VENCIDA&idComprador=${a.id}&comprador=${encodeURIComponent(a.nome || '')}`)}>
                  <div className="cb-lista-txt">
                    <b>{titulo(a.nome)}</b>
                    <small>{a.qtd} parcela{a.qtd > 1 ? 's' : ''} · desde {fmtData(a.antiga)} · {titulo(a.vendedor)}</small>
                  </div>
                  <div className="cb-lista-valor" style={{ color: 'var(--cb-vermelho)' }}>{fmtValor(a.valor)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="cb-card">
        <h3 className="cb-card-titulo">Por vendedor <small>clique para ver as parcelas</small></h3>
        <div className="cb-lista">
          {vendedores.map(v => (
            <div key={v.id} className="cb-lista-item" onClick={() => irParcelas(`situacao=EM_ABERTO&idVendedor=${v.id}&vendedor=${encodeURIComponent(v.nome || '')}`)}>
              <div className="cb-lista-txt">
                <b>{titulo(v.nome)}</b>
                <small>{v.lotes.size} lote{v.lotes.size > 1 ? 's' : ''} em cobrança{v.vencido > 0 ? <> · <span style={{ color: 'var(--cb-vermelho)' }}>{fmtValor(v.vencido)} em atraso</span></> : ' · em dia'}</small>
                <div className="cb-barrinha"><i style={{ width: `${(v.aberto / maiorVendedor) * 100}%` }} /></div>
              </div>
              <div className="cb-lista-valor">{fmtValor(v.aberto)}<small>a receber</small></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
