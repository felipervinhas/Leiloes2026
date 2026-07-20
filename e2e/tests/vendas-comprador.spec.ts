import { test, expect, APIRequestContext } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPorDigitacao, selecionarPrimeiraOpcao } from '../helpers';

const COMPRADOR_1 = process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA';
const COMPRADOR_2 = process.env.E2E_COMPRADOR_2 || 'AUGUSTO DA SILVA HEHN';

/**
 * Cobertura do step "Compradores" do wizard de Vendas: adicionar, editar %,
 * remover, e o gate de "Próximo" (canAvancar) exigindo ao menos 1 comprador.
 * Cada execução cria uma venda real (consome 1 lote disponível do leilão de
 * teste) — sempre limpa via DELETE /vendas/:id no final, o que já devolve o
 * lote para a lista de disponíveis (confirmado: excluirVenda apaga
 * MOVIMENTO/MOVIMENTO_LOTE/MOVIMENTO_COMPRADOR/MOVIMENTO_PARCELAMENTO).
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

test('step Compradores: adicionar, editar %, remover e gate do Próximo', async ({ page, request }) => {
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

  // captura o movId pelo título "Editando Venda #NNNN" pra limpar no final
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
    // Próximo deve estar desabilitado sem nenhum comprador
    const proximoStep2 = page.locator('button:has-text("Próximo")');
    await expect(proximoStep2).toBeDisabled();
    console.log('OK: Próximo desabilitado sem compradores');

    // adiciona comprador 1 a 100%
    await selecionarPorDigitacao(page, '#idCli', COMPRADOR_1);
    await selecionarPrimeiraOpcao(page, '#idCondPagto');
    const [respPost1] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/compradores')),
      page.click('button:has-text("Adicionar")', { force: true }),
    ]);
    expect(respPost1.ok()).toBe(true);
    await page.waitForTimeout(1000);

    await expect(page.locator('table tbody tr:visible')).toHaveCount(1);
    const linha1 = await page.locator('table tbody tr:visible').first().innerText();
    console.log('Linha após adicionar comprador 1:', linha1.replace(/\n/g, ' | '));
    expect(linha1).toContain('100%');

    // edita comprador 1: muda % pra 60 — a linha tem 2 ícones de lápis
    // (Selecionar propriedade e Editar comprador); o de "Editar comprador"
    // é sempre o último, na coluna de ações fixada à direita.
    await page.locator('table tbody tr:visible').first().locator('button:has(.anticon-edit)').last().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('#percen').fill('60');
    const [respPut] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('/compradores/')),
      page.click('button:has-text("Salvar")', { force: true }),
    ]);
    expect(respPut.ok()).toBe(true);
    await page.waitForTimeout(1000);
    const linha1Editada = await page.locator('table tbody tr:visible').first().innerText();
    console.log('Linha após editar % pra 60:', linha1Editada.replace(/\n/g, ' | '));
    expect(linha1Editada).toContain('60%');

    // adiciona comprador 2 a 40% — aguarda o form assentar após a edição anterior
    await page.waitForTimeout(3000);
    await selecionarPorDigitacao(page, '#idCli', COMPRADOR_2);
    await selecionarPrimeiraOpcao(page, '#idCondPagto');
    await page.locator('#percen').fill('40');
    const [respPost2] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/compradores')),
      page.click('button:has-text("Adicionar")', { force: true }),
    ]);
    expect(respPost2.ok()).toBe(true);
    await page.waitForTimeout(1000);

    await expect(page.locator('table tbody tr:visible')).toHaveCount(2);
    console.log('OK: 2 compradores após adicionar o 2º');

    // remove o 2º comprador
    const linha2 = page.locator('table tbody tr:visible', { hasText: '40%' });
    await linha2.locator('button.ant-btn-dangerous, button:has(.anticon-delete)').click({ force: true });
    await page.waitForTimeout(300);
    const [respDel] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'DELETE' && r.url().includes('/compradores/')),
      page.locator('.ant-popconfirm button:has-text("Remover")').click({ force: true }),
    ]);
    expect(respDel.ok()).toBe(true);
    await page.waitForTimeout(1000);
    await expect(page.locator('table tbody tr:visible')).toHaveCount(1);
    console.log('OK: comprador removido, volta a 1 linha');

    // avança pro Parcelamento
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1000);
    await expect(page.locator('.ant-card-head-title', { hasText: 'Parcelamento' })).toBeVisible();
    console.log('OK: avançou para Parcelamento');
  } finally {
    const del = await request.delete(`${API_URL}/api/${BANCO}/vendas/${movId}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Cleanup DELETE venda de teste ->', del.status());
  }
});
