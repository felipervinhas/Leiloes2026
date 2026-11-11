import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login } from '../helpers';

/**
 * Painel do cliente (/:banco/cliente) pelo link exclusivo: a leiloeira gera o link de um vendedor,
 * o vendedor abre o link, confirma os 4 primeiros dígitos do CNPJ, vê os recebimentos e renegocia
 * o vencimento de uma parcela em cobrança (fica no histórico "pelo vendedor").
 * Confere também a segurança: dígitos errados recusados, token do cliente não abre rota do sistema,
 * token do sistema não abre o painel, e revogar o link derruba a sessão aberta por ele.
 * Não mexe na senha do cliente (a senha é a mesma do app/site).
 *
 * Pré-requisito: COBR_ATIVA = 'S' na empresa de teste e usuário de teste com acesso à Cobrança.
 * Vendedor de teste: E2E_VENDEDOR_COBRANCA (padrão 302272) e o CNPJ dele em E2E_VENDEDOR_DOC.
 */

const VENDEDOR = Number(process.env.E2E_VENDEDOR_COBRANCA || 302272);
const DOC = (process.env.E2E_VENDEDOR_DOC || '39.942.158/0001-16').replace(/\D/g, '');

test.beforeAll(() => {
  exigirCredenciais();
});

test('Painel do cliente: link exclusivo, recebimentos, renegociação e segurança', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await login(request);
  const h = { Authorization: `Bearer ${token}` };
  const cob = (r: string) => `${API_URL}/api/${BANCO}/cobranca${r}`;
  const por = (r: string) => `${API_URL}/api/${BANCO}/portal${r}`;
  const st = await (await request.get(cob('/status'), { headers: h })).json();
  test.skip(!st.ativa || !st.acesso, 'Plano de cobrança desligado ou usuário sem acesso');

  const lotes = await (await request.get(cob(`/vendedores/${VENDEDOR}/lotes?soVendidos=S`), { headers: h })).json();
  const livre = lotes.find((l: any) => !l.cobranca && l.qtdParcelas >= 12);
  test.skip(!livre, 'Vendedor de teste sem lote vendido fora da cobrança');
  const acessoAntes = await (await request.get(cob(`/vendedores/${VENDEDOR}/acesso`), { headers: h })).json();
  test.skip(!!acessoAntes.link, 'Vendedor de teste já tem link ativo (gerar outro derrubaria o dele)');

  expect((await request.put(cob('/lotes'), { headers: h, data: { idLotes: [livre.idLote], ativa: true, destino: 'VENDEDOR' } })).ok()).toBeTruthy();
  const gerado = await request.post(cob(`/vendedores/${VENDEDOR}/link`), { headers: h });
  expect(gerado.ok()).toBeTruthy();
  const link = (await gerado.json()).token as string;

  let renegociada: { id: number; vencimento: string } | null = null;
  try {
    // segurança pela API
    expect((await request.get(por('/recebimentos'), { headers: h })).status()).toBe(401);
    expect((await (await request.get(por(`/link/${link}`))).json()).tipo).toBe(DOC.length === 14 ? 'CNPJ' : 'CPF');
    const errado = await request.post(por('/link/confirmar'), { data: { token: link, digitos: DOC.startsWith('0000') ? '1111' : '0000' } });
    expect(errado.status()).toBe(401);
    expect((await errado.json()).error).toMatch(/Restam 4 tentativas/);
    expect((await request.post(por('/link/confirmar'), { data: { token: `${link}x`, digitos: DOC.slice(0, 4) } })).status()).toBe(404);
    const certo = await request.post(por('/link/confirmar'), { data: { token: link, digitos: DOC.slice(0, 4) } });
    expect(certo.ok()).toBeTruthy();
    const hp = { Authorization: `Bearer ${(await certo.json()).token}` };
    expect((await request.get(cob('/resumo'), { headers: hp })).status()).toBe(401);
    expect((await request.get(`${API_URL}/api/${BANCO}/clientes/${VENDEDOR}`, { headers: hp })).status()).toBe(401);

    const recebimentos = await (await request.get(por('/recebimentos'), { headers: hp })).json();
    const alvo = recebimentos.find((p: any) => p.podeRenegociar);
    expect(alvo, 'alguma parcela em cobrança para renegociar').toBeTruthy();

    // tela: abre o link, digita os 4 dígitos e entra direto
    await page.goto(`/${BANCO}/cliente/acesso/${link}`);
    await expect(page.getByText('Confirme que é você')).toBeVisible({ timeout: 20_000 });
    await page.locator('.pc-digitos-campo').fill(DOC.slice(0, 4));
    await page.waitForURL(`**/${BANCO}/cliente/recebimentos`);
    await expect(page.getByText('Ainda vai receber')).toBeVisible({ timeout: 20_000 });

    // cartões por venda: busca o animal, abre o cartão do comprador e altera a parcela
    const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
    if (alvo.animal) await page.locator('.pc-busca').fill(alvo.animal.slice(0, 20));
    const cartao = page.locator('.pc-venda').filter({ hasText: titulo(alvo.comprador) }).first();
    await expect(cartao).toBeVisible({ timeout: 20_000 });
    await cartao.click();
    const parcela = page.locator('.pc-venda.aberta .pc-parcela').filter({ hasText: `Parcela ${alvo.ordxxx}` }).first();
    await parcela.getByRole('button', { name: 'Alterar' }).click();
    const modal = page.locator('.ant-modal', { hasText: 'Renegociar parcela' });
    await expect(modal).toBeVisible();
    const novo = new Date(`${alvo.vencimento}T12:00:00Z`);
    novo.setUTCDate(novo.getUTCDate() + 10);
    const novoBr = novo.toISOString().slice(0, 10).split('-').reverse().join('/');
    const campoData = modal.locator('.ant-picker input');
    await campoData.click();
    await campoData.fill(novoBr);
    await campoData.press('Enter');
    await modal.locator('textarea').fill('Teste e2e: comprador pediu mais prazo');
    const [resp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/renegociar')),
      modal.getByRole('button', { name: 'Salvar' }).click(),
    ]);
    expect(resp.status()).toBe(200);
    renegociada = { id: alvo.id, vencimento: alvo.vencimento };

    const hist = await (await request.get(por(`/parcelas/${alvo.id}/historico`), { headers: hp })).json();
    expect(hist[0]).toMatchObject({ acao: 'RENEGOCIACAO', autor: 'VENDEDOR' });

    await page.getByRole('button', { name: 'O que pago' }).click();
    await expect(page.locator('.pc-aba.ativa')).toHaveText('O que pago');
    await page.getByRole('button', { name: 'Taxas' }).click();
    await expect(page.getByText('Recebido pela cobrança da leiloeira')).toBeVisible();

    // revogar o link derruba a sessão aberta por ele
    expect((await request.delete(cob(`/vendedores/${VENDEDOR}/link`), { headers: h })).ok()).toBeTruthy();
    expect((await request.get(por('/me'), { headers: hp })).status()).toBe(401);
    expect((await request.get(por(`/link/${link}`))).status()).toBe(404);
  } finally {
    if (renegociada) {
      await request.put(cob(`/parcelas/${renegociada.id}/renegociar`), { headers: h,
        data: { vencimento: renegociada.vencimento, motivo: 'Teste e2e: volta ao vencimento original' } });
    }
    await request.put(cob('/lotes'), { headers: h, data: { idLotes: [livre.idLote], ativa: false } });
    await request.delete(cob(`/vendedores/${VENDEDOR}/link`), { headers: h });
    await request.put(cob(`/vendedores/${VENDEDOR}/acesso`), { headers: h, data: { liberado: acessoAntes.liberado } });
  }
});
