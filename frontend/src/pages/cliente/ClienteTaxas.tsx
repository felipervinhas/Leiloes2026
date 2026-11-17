import React, { useEffect, useState } from 'react';
import { Drawer, Skeleton, message } from 'antd';
import portalApi from '../../services/portalApi';
import { useConfig } from '../../context/ConfigContext';
import { fmtData, fmtValor, nomeMes, SITUACOES_FECHAMENTO } from '../cobranca/comum';
import { pdfFechamento } from '../cobranca/CobrancaFechamento';

const titulo = (s: string | null) => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const PILULA_SITUACAO: Record<string, string> = { FECHADO: 'cinza', COBRADO: 'ouro', PAGO: 'verde' };

/** Fechamentos mensais da intermediação de cobrança, do ponto de vista do vendedor. */
export default function ClienteTaxas() {
  const config = useConfig();
  const [lista, setLista] = useState<any[] | null>(null);
  const [detalhe, setDetalhe] = useState<any | null>(null);
  useEffect(() => {
    portalApi.get('/fechamentos').then(r => setLista(r.data)).catch(() => { setLista([]); message.error('Não foi possível carregar'); });
  }, []);

  if (!lista) return <div className="pc-card"><Skeleton active paragraph={{ rows: 4 }} /></div>;

  // só o que a leiloeira cobrou (pedido da Macedo em 2026-11-17): os valores recebidos ficam em "O que recebo"
  const taxaDe = (f: any) => f.taxaRetida + f.taxaACobrar;
  const totalTaxa = lista.reduce((a, f) => a + taxaDe(f), 0);
  const taxaPaga = lista.filter(f => f.situacao === 'PAGO').reduce((a, f) => a + taxaDe(f), 0);
  const taxaAberta = totalTaxa - taxaPaga;

  return (
    <>
      <section className="pc-destaques">
        <div className="pc-card pc-destaque-principal">
          <div className="pc-rotulo">Taxa cobrada pela leiloeira</div>
          <div className="pc-valor">{fmtValor(totalTaxa)}</div>
          <div className="pc-sub">em <b>{lista.length}</b> {lista.length === 1 ? 'mês fechado' : 'meses fechados'}</div>
        </div>
        <div className="pc-card">
          <div className="pc-rotulo">Já paga</div>
          <div className="pc-valor medio">{fmtValor(taxaPaga)}</div>
          <div className="pc-sub">{taxaAberta > 0.009
            ? <span className="pc-pilula ouro">em aberto · {fmtValor(taxaAberta)}</span>
            : <span className="pc-pilula verde">tudo em dia</span>}</div>
        </div>
        <div className="pc-card">
          <div className="pc-rotulo">Como funciona</div>
          <div className="pc-sub" style={{ marginTop: 0 }}>
            Todo mês a leiloeira fecha as parcelas que recebeu na cobrança e calcula a taxa do serviço sobre elas.
          </div>
        </div>
      </section>

      {!lista.length ? (
        <div className="pc-card pc-vazio"><b>Nenhum mês fechado ainda</b>Os fechamentos da cobrança aparecem aqui todo mês.</div>
      ) : (
        <div className="pc-meses-taxa">
          {lista.map(f => {
            return (
              <article key={f.id} className="pc-card">
                <div className="pc-taxa-mes">
                  <span>{nomeMes(f.competencia)}</span>
                  <span className={`pc-pilula ${PILULA_SITUACAO[f.situacao] || 'cinza'}`}>{SITUACOES_FECHAMENTO[f.situacao]?.label}</span>
                </div>
                <div className="pc-rotulo" style={{ marginTop: 4 }}>Taxa cobrada</div>
                <div className="pc-valor medio">{fmtValor(taxaDe(f))}</div>
                <div className="pc-sub">sobre {f.qtdParcelas} parcela{f.qtdParcelas === 1 ? '' : 's'} recebida{f.qtdParcelas === 1 ? '' : 's'}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                  <button className="pc-acao" onClick={() => setDetalhe(f)}>Ver parcelas</button>
                  <button className="pc-acao" onClick={() => pdfFechamento(f.id, config, portalApi, '/fechamentos')}>PDF</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Drawer open={!!detalhe} width={520} destroyOnHidden onClose={() => setDetalhe(null)}
        title={detalhe ? `Parcelas de ${nomeMes(detalhe.competencia)}` : ''}>
        {detalhe && <ItensFechamento id={detalhe.id} />}
      </Drawer>
    </>
  );
}

function ItensFechamento({ id }: { id: number }) {
  const [itens, setItens] = useState<any[] | null>(null);
  useEffect(() => { portalApi.get(`/fechamentos/${id}`).then(r => setItens(r.data.itens)).catch(() => setItens([])); }, [id]);
  if (!itens) return <Skeleton active />;
  return (
    <div className="pc" style={{ minHeight: 0, background: 'transparent' }}>
      <div className="pc-agenda">
        {itens.map(i => (
          <div key={`${i.origem}${i.idBaixa}`} className="pc-agenda-item">
            <div className="pc-data"><b>{i.dataPagamento.slice(8, 10)}</b><span>{fmtData(i.dataPagamento).slice(3, 5)}/{i.dataPagamento.slice(2, 4)}</span></div>
            <div className="pc-agenda-txt">
              <div>{titulo(i.animal) || `Lote ${i.lote}`}</div>
              <small>{titulo(i.comprador)} · parcela {i.ordxxx} · {i.recebidoEm === 'MACEDO' ? 'conta da leiloeira' : 'sua conta'}</small>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pc-agenda-valor">{fmtValor(i.valor)}</div>
              <small style={{ color: 'var(--pc-suave)' }}>taxa {fmtValor(i.taxaValor)}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
