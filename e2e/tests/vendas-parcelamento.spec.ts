import { test, expect, APIRequestContext } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPorDigitacao, selecionarPrimeiraOpcao } from '../helpers';

const COMPRADOR_1 = process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA';

/**
 * Cobertura do step "Parcelamento" do wizard de Vendas: gerar parcelas pra
 * um comprador, editar vencimento/valor de uma parcela inline, e confirmar
 * que a edição persiste após recarregar (não é só estado local do React).
 * Mesma ressalva das outras specs de Vendas: cria uma venda real, sempre
 * limpa via DELETE /vendas/:id no final.
 */

test.beforeAll(() => { exigirCredenciais(); });

async function encontrarLeilaoComLoteDisponivel(request: APIRequestContext, token: string) {
  const leiloesRes = await request.get(`${API_URL}/api/${BANCO}/leiloes`, { headers: { Authorization: `Bearer ${token}` } });
  const leiloes = await leiloesRes.json();
  for (const l of leiloes) {
    const lotesRes = await request.get(`${API_URL}/api/${BANCO}/vendas/lotes-disponiveis/${l.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const lotes = await lotesRes.json();
    if (Array.isArray(lotes) && lotes.length > 0) return { idLeilao: l.id, leilao: l.leilao as string };
  }
  throw new Error('Nenhum leilão com lote disponível encontrado em ' + BANCO);
}

test('step Parcelamento: gerar parcelas e editar valor/vencimento inline', async ({ page, request }) => {
  test.setTimeout(120_000);
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('response', async r => {
    if (r.url().includes('/api/') && !r.ok()) {
      let body = '';
      try { body = JSON.stringify(await r.json()); } catch { body = await r.text().catch(() => '?'); }
      console.log('RESP ERRO', r.request().method(), r.status(), r.url(), body);
    }
  });

  const token = await login(request);
  const { leilao } = await encontrarLeilaoComLoteDisponivel(request, token);

  await loginUI(page);
  await page.goto(`/${BANCO}/vendas`);
  await page.click('button:has-text("Nova Venda")', { force: true });
  await page.waitForTimeout(1500);

  await selecionarPorDigitacao(page, '#idLeilao', leilao);
  await page.fill('input[placeholder="Ex: 123456"]', '0');
  await page.click('button:has-text("Próximo")', { force: true });
  await page.waitForTimeout(1500);

  const tituloTexto = await page.locator('text=/Editando Venda #\\d+/').innerText();
  const movId = Number(tituloTexto.match(/#(\d+)/)?.[1]);
  console.log('Venda de teste criada:', movId);
  expect(movId).toBeGreaterThan(0);

  await page.locator('#idLote').click({ force: true });
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const valorInput = page.locator('.ant-form-item input').nth(2);
  await valorInput.click({ force: true });
  await valorInput.fill('6000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Próximo")', { force: true });
  await page.waitForTimeout(1500);

  try {
    // comprador único a 100%
    await selecionarPorDigitacao(page, '#idCli', COMPRADOR_1);
    await selecionarPrimeiraOpcao(page, '#idCondPagto');
    const [respPost] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/compradores')),
      page.click('button:has-text("Adicionar")', { force: true }),
    ]);
    expect(respPost.ok()).toBe(true);
    await page.waitForTimeout(800);

    await page.click('button:has-text("Próximo")', { force: true }); // -> Parcelamento
    await page.waitForTimeout(1200);

    // seleciona o comprador em "Gerar para" e gera o parcelamento
    await page.locator('.ant-select').filter({ hasText: 'Escolha o comprador...' }).click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('.ant-select-item-option:visible').first().click({ force: true });
    await page.waitForTimeout(300);
    const [respGerar] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/parcelas')),
      page.click('button:has-text("Gerar Parcelamento")', { force: true }),
    ]);
    expect(respGerar.ok()).toBe(true);
    await page.waitForTimeout(1000);

    const linhasParcelas = page.locator('table tbody tr:visible');
    const qtdParcelas = await linhasParcelas.count();
    console.log('Parcelas geradas:', qtdParcelas);
    expect(qtdParcelas).toBeGreaterThan(0);

    // edita o valor da 1ª parcela
    const valorCell = linhasParcelas.first().locator('span[style*="cursor: pointer"]').last();
    const valorAntes = await valorCell.innerText();
    console.log('Valor da 1ª parcela antes:', valorAntes);
    await valorCell.click({ force: true });
    await page.waitForTimeout(400);
    // Valor inteiro (sem vírgula/centavos) pra não depender de como o
    // formatter/parser pt-BR do InputNumber trata o separador decimal digitado.
    const inputValor = page.locator('.ant-input-number-input').first();
    await inputValor.click({ force: true });
    await page.keyboard.press('Control+A');
    await inputValor.pressSequentially('7777', { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);

    // confirma via "Atualizar" (recarrega do servidor, não é só estado local)
    const [respReload] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'GET' && r.url().includes('/parcelas')),
      page.click('button:has-text("Atualizar")', { force: true }),
    ]);
    expect(respReload.ok()).toBe(true);
    await page.waitForTimeout(800);
    const linhaAposReload = await linhasParcelas.first().innerText();
    console.log('1ª linha após editar valor + recarregar:', linhaAposReload.replace(/\n/g, ' | '));
    expect(linhaAposReload).toContain('7.777,00');
    expect(linhaAposReload).not.toContain(valorAntes.trim());
  } finally {
    const del = await request.delete(`${API_URL}/api/${BANCO}/vendas/${movId}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Cleanup DELETE venda de teste ->', del.status());
  }
});
