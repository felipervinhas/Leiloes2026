import React from 'react';
import { Col, Divider, Form, InputNumber, Radio, Switch, Typography } from 'antd';
import type { FormInstance } from 'antd';
import api from '../../services/api';
import { DESTINOS } from './comum';

const { Text } = Typography;

// Marcação "Cobrança pela leiloeira" dentro do formulário de Lotes. Os campos (cobr*) não vão
// para /lotes: a tela de Lotes os tira do payload e grava em /cobranca/lotes depois de salvar.

export const CAMPOS_COBRANCA = ['cobrAtiva', 'cobrDestino', 'cobrParcInicial', 'cobrTaxa'] as const;

/** Plano contratado e usuário com acesso? (sem isso a seção nem aparece) */
export async function cobrancaDisponivel(): Promise<{ disponivel: boolean; taxaPadrao: number }> {
  try {
    const r = await api.get('/cobranca/status');
    return { disponivel: !!(r.data.ativa && r.data.acesso), taxaPadrao: Number(r.data.taxaPadrao) || 0 };
  } catch { return { disponivel: false, taxaPadrao: 0 }; }
}

export async function carregarCobrancaDoLote(form: FormInstance, idLote: number) {
  try {
    const c = (await api.get(`/cobranca/lotes/${idLote}`)).data;
    form.setFieldsValue({
      cobrAtiva: !!c, cobrDestino: c?.destino || 'VENDEDOR', cobrParcInicial: c?.parcInicial ?? null, cobrTaxa: c?.taxa ?? null,
    });
    return !!c;
  } catch { return false; }
}

/** Lote novo: o vendedor com "lotes novos já entram" marca a cobrança sozinho. */
export async function aplicarPadraoDoVendedor(form: FormInstance, idVendedor?: number) {
  if (!idVendedor) return;
  try {
    const p = (await api.get(`/cobranca/vendedores/${idVendedor}/padrao`)).data;
    if (p?.padrao) form.setFieldsValue({ cobrAtiva: true, cobrDestino: p.destino });
  } catch { /* sem padrão */ }
}

/** Grava a marcação (só quando está ligada agora ou estava antes). */
export async function salvarCobrancaDoLote(idLote: number, v: any, estavaAtiva: boolean) {
  if (!v.cobrAtiva && !estavaAtiva) return;
  await api.put('/cobranca/lotes', {
    idLotes: [idLote], ativa: !!v.cobrAtiva, destino: v.cobrDestino || 'VENDEDOR',
    parcInicial: v.cobrParcInicial || null, taxa: v.cobrTaxa ?? null,
  });
}

export function CamposCobrancaLote({ taxaPadrao }: { taxaPadrao: number }) {
  return (
    <>
      <Col span={24}><Divider plain style={{ margin: '4px 0 12px' }}>Intermediação de cobrança</Divider></Col>
      <Col xs={24} md={6}>
        <Form.Item name="cobrAtiva" label="Cobrança pela leiloeira" valuePropName="checked"
          tooltip="A leiloeira cobra as parcelas que vêm depois das do escritório (ex.: no 2+2+46, as 46).">
          <Switch />
        </Form.Item>
      </Col>
      <Form.Item noStyle shouldUpdate={(a, b) => a.cobrAtiva !== b.cobrAtiva}>
        {({ getFieldValue }) => getFieldValue('cobrAtiva') ? (
          <>
            <Col xs={24} md={8}>
              <Form.Item name="cobrDestino" label="Dinheiro vai para" initialValue="VENDEDOR">
                <Radio.Group options={DESTINOS} />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item name="cobrParcInicial" label="A partir da parcela" tooltip="Em branco: logo depois das parcelas do escritório.">
                <InputNumber min={1} max={200} style={{ width: '100%' }} placeholder="Automático" />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item name="cobrTaxa" label="Taxa (%)" tooltip="Em branco: a do vendedor ou a padrão da empresa.">
                <InputNumber min={0} max={100} precision={2} decimalSeparator="," style={{ width: '100%' }} placeholder={`Padrão (${taxaPadrao}%)`} />
              </Form.Item>
            </Col>
          </>
        ) : <Col xs={24} md={18}><Text type="secondary" style={{ display: 'block', paddingTop: 30 }}>As parcelas deste lote ficam com o vendedor, como hoje.</Text></Col>}
      </Form.Item>
    </>
  );
}
