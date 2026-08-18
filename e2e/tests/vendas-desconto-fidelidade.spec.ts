import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPorDigitacao, selecionarPrimeiraOpcao } from '../helpers';

const COMPRADOR_1 = process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA';

/**
 * Cobertura do desconto por fidelidade do cliente (percentual ou valor fixo)
 * no step "Compradores" do wizard de Vendas: aplicar, trocar de tipo, e
 * confirmar que o valor a pagar reflete o desconto tanto na grid quanto nas
 * parcelas geradas. Mesma ressalva das outras specs de Vendas: cria uma
 * venda real, sempre limpa via DELETE /vendas/:id no final.
 */

test.beforeAll(() => { exigirCredenciais(); });

/**
 * selecionarPrimeiraOpcao (helper compartilhado) na prática seleciona a 2ª
 * opção do dropdown (o Select já abre com a 1ª item ativa/destacada, e o
 * ArrowDown do helper move o destaque pra frente) — não serve aqui porque a
 * ordem P/V importa. Seleciona a opção certa clicando pelo texto visível.
 */
async function selecionarPorTexto(page: Page, seletor: string, texto: string) {
  await page.locator(seletor).click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('.ant-select-item-option:visible', { hasText: texto }).click({ force: true });
  await page.waitForTimeout(200);
}

function parseValor(texto: string): number {
  const m = texto.match(/-?\s*R\$\s*([\d.,]+)/);
  if (!m) return NaN;
  return Number(m[1].replace(/\./g, '').replace(',', '.'));
}

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

test('step Compradores: desconto de fidelidade percentual e valor fixo', async ({ page, request }) => {
  test.setTimeout(120_000);
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));

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
  await valorInput.fill('5000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Próximo")', { force: true });
  await page.waitForTimeout(1500);

  try {
    // comprador único a 100%, com fidelidade percentual (10%). Checagem
    // autoconsistente (sem depender do valor absoluto do lote): "Vlr. a
    // Pagar" já é líquido da fidelidade, então a base antes do desconto é
    // (vlrPagar + descFidelidade), e descFidelidade deve ser ~10% dela.
    await selecionarPorDigitacao(page, '#idCli', COMPRADOR_1);
    await selecionarPrimeiraOpcao(page, '#idCondPagto');
    await selecionarPorTexto(page, '#tipoDescontoFidelidade', '% Percentual');
    await page.locator('#descontoFidelidade').fill('10');
    const [respPost] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/compradores')),
      page.click('button:has-text("Adicionar")', { force: true }),
    ]);
    expect(respPost.ok()).toBe(true);
    await page.waitForTimeout(1000);

    await expect(page.locator('table tbody tr:visible')).toHaveCount(1);
    const linha1 = page.locator('table tbody tr:visible').first();
    const vlrPagarTxt1 = await linha1.locator('td').nth(4).innerText();
    const descFidTxt1  = await linha1.locator('td').nth(5).innerText();
    console.log('Vlr. a Pagar (10% fidelidade):', vlrPagarTxt1, '| Desc. Fidelidade:', descFidTxt1);
    const vlrPagar1 = parseValor(vlrPagarTxt1);
    const descFid1  = parseValor(descFidTxt1);
    expect(descFid1).toBeGreaterThan(0);
    const baseAntes1 = vlrPagar1 + descFid1;
    expect(descFid1).toBeCloseTo(baseAntes1 * 0.10, 1); // 10% da base antes do desconto

    // edita: troca pra fidelidade em valor fixo (R$ 200) — valor exato,
    // independe do total do lote.
    await linha1.locator('button:has(.anticon-edit)').last().click({ force: true });
    await page.waitForTimeout(500);
    await selecionarPorTexto(page, '#tipoDescontoFidelidade', 'R$ Valor');
    await page.locator('#descontoFidelidade').fill('200');
    const [respPut] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('/compradores/')),
      page.click('button:has-text("Salvar")', { force: true }),
    ]);
    expect(respPut.ok()).toBe(true);
    await page.waitForTimeout(1000);

    const linha1Editada = page.locator('table tbody tr:visible').first();
    const vlrPagarTxt2 = await linha1Editada.locator('td').nth(4).innerText();
    const descFidTxt2  = await linha1Editada.locator('td').nth(5).innerText();
    console.log('Vlr. a Pagar (fidelidade R$200):', vlrPagarTxt2, '| Desc. Fidelidade:', descFidTxt2);
    expect(parseValor(descFidTxt2)).toBeCloseTo(200, 1);
    expect(parseValor(vlrPagarTxt2)).toBeCloseTo(baseAntes1 - 200, 1); // mesma base do lote, agora com desconto fixo

    // avança pro Parcelamento e gera as parcelas para o comprador.
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1200);

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
    console.log('Parcelas geradas com fidelidade aplicada:', qtdParcelas);
    expect(qtdParcelas).toBeGreaterThan(0);
  } finally {
    const del = await request.delete(`${API_URL}/api/${BANCO}/vendas/${movId}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Cleanup DELETE venda de teste ->', del.status());
  }
});
