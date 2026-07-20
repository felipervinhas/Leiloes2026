import { test, expect, APIRequestContext } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPorDigitacao, selecionarPrimeiraOpcao } from '../helpers';

/**
 * Cobre a "quantidade de animais do lote" (Lotes.QTDANIMAIS): cria um lote
 * novo com 10 animais, vende 5 numa venda, confirma que o lote continua
 * disponível com o restante sugerido, vende os outros 5 numa segunda venda
 * e confirma que o lote sai da lista de disponíveis por ter esgotado a
 * quantidade. Roda inteiramente no banco de teste MacedoBkp — cria e
 * limpa (via API) o leilão/lote/vendas de teste no final.
 */

test.beforeAll(() => { exigirCredenciais(); });

test('venda parcial e integral de um lote com quantidade de animais definida', async ({ page, request }) => {
  test.setTimeout(150_000);
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));

  const token = await login(request);
  const sufixo = Date.now();
  const nomeLeilao = `E2E LEILAO QTD ANIMAIS ${sufixo}`;
  const nomeLote = `E2E${String(sufixo).slice(-6)}`;

  // ── Setup: cria o leilão de teste via API (mais rápido que preencher o form inteiro) ──
  const leilaoRes = await request.post(`${API_URL}/api/${BANCO}/leiloes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { leilao: nomeLeilao, ativox: 'S' },
  });
  const idLeilao = (await leilaoRes.json()).id;
  console.log('Leilão de teste criado:', idLeilao, nomeLeilao);

  let idLote: number | undefined;
  let idMov1: number | undefined;
  let idMov2: number | undefined;

  try {
    await loginUI(page);

    // ── Cria o lote via UI, com Qtd. Animais do Lote = 10 ──────────────────
    await page.goto(`/${BANCO}/lotes`);
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Novo Lote")', { force: true });
    await page.waitForTimeout(800);

    await page.locator('.ant-modal-body input#lotexx').fill(nomeLote);
    await selecionarPorDigitacao(page, '#idleilao', nomeLeilao);
    await page.locator('#qtdAnimais').fill('10');

    const [respCriarLote] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/lotes')),
      page.click('button:has-text("Salvar"), .ant-modal-footer button:has-text("OK")', { force: true }),
    ]);
    idLote = (await respCriarLote.json()).id;
    console.log('Lote de teste criado:', idLote, nomeLote, '(qtdAnimais=10)');
    expect(idLote).toBeGreaterThan(0);

    // ── Venda 1: vende 5 dos 10 animais ────────────────────────────────────
    await page.goto(`/${BANCO}/vendas`);
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Nova Venda")', { force: true });
    await page.waitForTimeout(1200);

    await selecionarPorDigitacao(page, '#idLeilao', nomeLeilao);
    await page.fill('input[placeholder="Ex: 123456"]', '1');
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1500);

    const tituloV1 = await page.locator('text=/Editando Venda #\\d+/').innerText();
    idMov1 = Number(tituloV1.match(/#(\d+)/)?.[1]);
    console.log('Venda 1 criada:', idMov1);

    await page.locator('#idLote').click({ force: true });
    await page.waitForTimeout(600);
    // só deve ter uma opção: o lote recém-criado
    const opcoesLote = await page.locator('.ant-select-item-option:visible').allInnerTexts();
    console.log('Opções de lote disponível:', JSON.stringify(opcoesLote));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    // confirma que a Qtd Animais veio sugerida com o total (10), já que nunca foi vendido
    const qtdSugerida1 = await page.locator('#qtdxxx').inputValue();
    console.log('Qtd Animais sugerida na venda 1 (esperado 10):', qtdSugerida1);
    expect(Number(qtdSugerida1)).toBe(10);

    // reduz pra 5 (venda parcial)
    await page.locator('#qtdxxx').fill('5');
    const valorInput1 = page.locator('.ant-form-item input').nth(2);
    await valorInput1.click({ force: true });
    await valorInput1.fill('1000');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1500);

    await selecionarPorDigitacao(page, '#idCli', process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA');
    await selecionarPrimeiraOpcao(page, '#idCondPagto');
    const [respComp1] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/compradores')),
      page.click('button:has-text("Adicionar")', { force: true }),
    ]);
    expect(respComp1.ok()).toBe(true);
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Próximo")', { force: true }); // -> Parcelamento
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Concluir")', { force: true });
    await page.waitForURL(`**/${BANCO}/vendas`);
    console.log('Venda 1 concluída (5 de 10 animais)');

    // ── Venda 2: vende os outros 5, fechando o lote ────────────────────────
    await page.click('button:has-text("Nova Venda")', { force: true });
    await page.waitForTimeout(1200);
    await selecionarPorDigitacao(page, '#idLeilao', nomeLeilao);
    await page.fill('input[placeholder="Ex: 123456"]', '2');
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1500);

    const tituloV2 = await page.locator('text=/Editando Venda #\\d+/').innerText();
    idMov2 = Number(tituloV2.match(/#(\d+)/)?.[1]);
    console.log('Venda 2 criada:', idMov2);

    // o lote ainda deve aparecer disponível (só 5 de 10 vendidos)
    await page.locator('#idLote').click({ force: true });
    await page.waitForTimeout(600);
    const opcoesLote2 = await page.locator('.ant-select-item-option:visible').allInnerTexts();
    console.log('Lote ainda disponível pra venda 2?', opcoesLote2.length > 0, JSON.stringify(opcoesLote2));
    expect(opcoesLote2.length).toBeGreaterThan(0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    // confirma que a Qtd Animais sugerida agora é o restante (5)
    const qtdSugerida2 = await page.locator('#qtdxxx').inputValue();
    console.log('Qtd Animais sugerida na venda 2 (esperado 5, o restante):', qtdSugerida2);
    expect(Number(qtdSugerida2)).toBe(5);

    const valorInput2 = page.locator('.ant-form-item input').nth(2);
    await valorInput2.click({ force: true });
    await valorInput2.fill('1000');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1500);

    await selecionarPorDigitacao(page, '#idCli', process.env.E2E_COMPRADOR_2 || 'AUGUSTO DA SILVA HEHN');
    await selecionarPrimeiraOpcao(page, '#idCondPagto');
    const [respComp2] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/compradores')),
      page.click('button:has-text("Adicionar")', { force: true }),
    ]);
    expect(respComp2.ok()).toBe(true);
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Concluir")', { force: true });
    await page.waitForURL(`**/${BANCO}/vendas`);
    console.log('Venda 2 concluída (5 de 10 animais — lote esgotado)');

    // ── Confirma que o lote NÃO aparece mais como disponível (10 de 10 vendidos) ──
    await page.click('button:has-text("Nova Venda")', { force: true });
    await page.waitForTimeout(1200);
    await selecionarPorDigitacao(page, '#idLeilao', nomeLeilao);
    await page.fill('input[placeholder="Ex: 123456"]', '3');
    await page.click('button:has-text("Próximo")', { force: true });
    await page.waitForTimeout(1500);

    const tituloV3 = await page.locator('text=/Editando Venda #\\d+/').innerText();
    const idMov3 = Number(tituloV3.match(/#(\d+)/)?.[1]);

    await page.locator('#idLote').click({ force: true });
    await page.waitForTimeout(600);
    const opcoesLote3 = await page.locator('.ant-select-item-option:visible').allInnerTexts();
    console.log('Lote ainda disponível após esgotar (esperado: lista vazia)?', JSON.stringify(opcoesLote3));
    expect(opcoesLote3.length).toBe(0);

    // limpa essa 3ª venda de teste (não completou o wizard, mas o cabeçalho já foi criado)
    await request.delete(`${API_URL}/api/${BANCO}/vendas/${idMov3}`, { headers: { Authorization: `Bearer ${token}` } });
  } finally {
    console.log('--- limpando dados de teste ---');
    if (idMov1) await request.delete(`${API_URL}/api/${BANCO}/vendas/${idMov1}`, { headers: { Authorization: `Bearer ${token}` } });
    if (idMov2) await request.delete(`${API_URL}/api/${BANCO}/vendas/${idMov2}`, { headers: { Authorization: `Bearer ${token}` } });
    if (idLote) await request.delete(`${API_URL}/api/${BANCO}/lotes/${idLote}`, { headers: { Authorization: `Bearer ${token}` } });
    await request.delete(`${API_URL}/api/${BANCO}/leiloes/${idLeilao}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Limpeza concluída');
  }
});
