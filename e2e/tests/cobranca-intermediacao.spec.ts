import { test, expect } from '@playwright/test';
import { API_URL, BANCO, CPF, SENHA, exigirCredenciais, login } from '../helpers';

/**
 * Intermediação de Cobrança (/:banco/cobranca): marca dois lotes vendidos de um vendedor
 * na cobrança (via API), confere as telas (painel, lotes, parcelas), dá baixa numa parcela
 * pela tela, vê a baixa no detalhe e no fechamento do mês, desfaz e tira os lotes da cobrança.
 *
 * Pré-requisito: empresa de teste com o plano ligado (UPDATE Configuracoes SET COBR_ATIVA = 'S')
 * e o usuário de teste administrador ou com o controle "Intermediação de Cobrança".
 * Vendedor de teste: E2E_VENDEDOR_COBRANCA (padrão 302272, com vendas em 50x no MacedoBkp).
 */

const VENDEDOR = Number(process.env.E2E_VENDEDOR_COBRANCA || 302272);

test.beforeAll(() => {
  exigirCredenciais();
});

test('Cobrança: lotes marcados, baixa de parcela e fechamento do mês', async ({ page, request }) => {
  const token = await login(request);
  const h = { Authorization: `Bearer ${token}` };
  const api = (rota: string) => `${API_URL}/api/${BANCO}/cobranca${rota}`;
  const st = await (await request.get(api('/status'), { headers: h })).json();
  test.skip(!st.ativa, 'Plano de cobrança desligado na empresa de teste');
  test.skip(!st.acesso, 'Usuário de teste sem o controle "Intermediação de Cobrança"');

  // dois lotes vendidos do vendedor que ainda não estão na cobrança
  const lotes = await (await request.get(api(`/vendedores/${VENDEDOR}/lotes?soVendidos=S`), { headers: h })).json();
  const livres = lotes.filter((l: any) => !l.cobranca && l.qtdParcelas >= 12).slice(0, 2);
  test.skip(livres.length < 2, 'Vendedor de teste sem 2 lotes vendidos fora da cobrança');
  const ids = livres.map((l: any) => l.idLote);
  const marcar = await request.put(api('/lotes'), { headers: h, data: { idLotes: ids, ativa: true, destino: 'VENDEDOR' } });
  expect(marcar.ok()).toBeTruthy();

  let idBaixa: number | null = null;
  try {
    await page.goto(`/${BANCO}/cobranca/login`);
    await expect(page.getByText('Intermediação de cobrança')).toBeVisible();
    await page.fill('input[placeholder="CPF"]', CPF!);
    await page.fill('input[placeholder="Senha"]', SENHA!);
    await page.click('button:has-text("Entrar")', { force: true });
    await page.waitForURL(`**/${BANCO}/cobranca/painel`);
    await expect(page.getByText('Lotes em cobrança').first()).toBeVisible();

    // parcelas do primeiro lote, em aberto, pela API (para saber qual baixar na tela)
    const parcelas = await (await request.get(api(`/parcelas?idLote=${ids[0]}&situacao=EM_ABERTO`), { headers: h })).json();
    expect(parcelas.length).toBeGreaterThan(0);
    // a mais antiga: a lista vem por vencimento, então ela está na primeira página
    const alvo = parcelas[0];

    await page.locator('.cb-menu-item', { hasText: 'Parcelas' }).click();
    await page.waitForURL(`**/${BANCO}/cobranca/parcelas`);
    const linha = page.locator('tr.ant-table-row', { hasText: alvo.comprador }).filter({ hasText: alvo.ordxxx }).first();
    await expect(linha).toBeVisible({ timeout: 20_000 });

    await linha.locator('button:has(.anticon-check)').click();
    const modal = page.locator('.ant-modal', { hasText: 'Baixa da parcela' });
    await expect(modal).toBeVisible();
    const [resposta] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/cobranca/parcelas/baixar')),
      modal.getByRole('button', { name: 'Registrar baixa' }).click(),
    ]);
    expect(resposta.status()).toBe(200);
    await expect(modal).toBeHidden();

    const baixas = await (await request.get(api(`/parcelas/${alvo.id}/baixas`), { headers: h })).json();
    const manual = baixas.find((b: any) => b.origemTabela === 'COBR' && !b.desfeita);
    expect(manual?.valor).toBeCloseTo(alvo.saldo, 2);
    idBaixa = manual.id;

    // entra na prévia do fechamento do mês, com 5% (ou a taxa do lote) a cobrar do vendedor
    const comp = new Date().toISOString().slice(0, 7);
    const previa = await (await request.get(api(`/fechamentos/previa?competencia=${comp}&idVendedor=${VENDEDOR}`), { headers: h })).json();
    const item = previa.itens.find((i: any) => i.idBaixa === idBaixa);
    expect(item?.recebidoEm).toBe('VENDEDOR');
    expect(item?.taxaValor).toBeCloseTo(alvo.saldo * alvo.taxa / 100, 2);

    await page.locator('.cb-menu-item', { hasText: 'Fechamento mensal' }).click();
    await expect(page.locator('tr.ant-table-row', { hasText: alvo.vendedor }).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    if (idBaixa) await request.post(api(`/baixas/${idBaixa}/desfazer`), { headers: h });
    await request.put(api('/lotes'), { headers: h, data: { idLotes: ids, ativa: false } });
  }
});
