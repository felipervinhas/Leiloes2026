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

  const totalTaxa = lista.reduce((a, f) => a + f.taxaRetida + f.taxaACobrar, 0);
  const totalRecebido = lista.reduce((a, f) => a + f.recebidoMacedo + f.recebidoVendedor, 0);

  return (
    <>
      <section className="pc-destaques">
        <div className="pc-card pc-destaque-principal">
          <div className="pc-rotulo">Recebido pela cobrança da leiloeira</div>
          <div className="pc-valor">{fmtValor(totalRecebido)}</div>
          <div className="pc-sub">em <b>{lista.length}</b> {lista.length === 1 ? 'mês fechado' : 'meses fechados'}</div>
        </div>
        <div className="pc-card">
          <div className="pc-rotulo">Taxa do serviço</div>
          <div className="pc-valor medio">{fmtValor(totalTaxa)}</div>
          <div className="pc-sub">sobre cada parcela recebida</div>
        </div>
        <div className="pc-card">
          <div className="pc-rotulo">Como funciona</div>
          <div className="pc-sub" style={{ marginTop: 0 }}>
            Todo mês a leiloeira fecha as parcelas recebidas. Se o dinheiro caiu na conta dela, a taxa é descontada no repasse;
            se caiu na sua, a taxa é cobrada de você.
          </div>
        </div>
      </section>

      {!lista.length ? (
        <div className="pc-card pc-vazio"><b>Nenhum mês fechado ainda</b>Os fechamentos da cobrança aparecem aqui todo mês.</div>
      ) : (
        <div className="pc-meses-taxa">
          {lista.map(f => {
            const recebe = f.saldo > 0.009, paga = f.saldo < -0.009;
            return (
              <article key={f.id} className="pc-card">
                <div className="pc-taxa-mes">
                  <span>{nomeMes(f.competencia)}</span>
                  <span className={`pc-pilula ${PILULA_SITUACAO[f.situacao] || 'cinza'}`}>{SITUACOES_FECHAMENTO[f.situacao]?.label}</span>
                </div>
                <div className="pc-taxa-linha"><span>Parcelas recebidas</span><b>{f.qtdParcelas}</b></div>
                <div className="pc-taxa-linha"><span>Na conta da leiloeira</span><b>{fmtValor(f.recebidoMacedo)}</b></div>
                <div className="pc-taxa-linha"><span>Na sua conta</span><b>{fmtValor(f.recebidoVendedor)}</b></div>
                <div className="pc-taxa-linha"><span>Taxa</span><b>{fmtValor(f.taxaRetida + f.taxaACobrar)}</b></div>
                <div className={`pc-taxa-acerto ${recebe ? 'recebe' : paga ? 'paga' : ''}`}>
                  {recebe ? `Você recebe ${fmtValor(f.saldo)}` : paga ? `Você paga ${fmtValor(-f.saldo)}` : 'Sem acerto'}
                </div>
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
