import { test, expect, APIRequestContext } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import {
  API_URL, BANCO, exigirCredenciais, login, loginUI,
  selecionarPorDigitacao, selecionarPrimeiraOpcao,
} from '../helpers';

const COMPRADOR_1 = process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA';

/**
 * Cobertura do relatório "Mapa de Seguro" em Consulta de Vendas — feature
 * portada do Delphi (ReportSeguro em unConsultaVendas.dfm), que não existia
 * ainda no sistema novo. Cria uma venda de teste, consulta pelo leilão,
 * troca o tipo de relatório para "Mapa de Seguro" e confirma que o PDF
 * gerado contém as duas páginas ("Mapa de Seguradoras" e "Mapa da
 * Compradores") com os dados da venda.
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

test('Mapa de Seguro: gera PDF com as 2 páginas (Seguradoras e Compradores)', async ({ page, request }) => {
  test.setTimeout(90_000);
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
  const loteLabel = (await page.locator('.ant-select-item-option-content').first().textContent()) || '';
  const lotexx = loteLabel.split('—')[0].trim();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const valorInput = page.locator('.ant-form-item input').nth(2);
  await valorInput.click({ force: true });
  await valorInput.fill('8000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Próximo")', { force: true });
  await page.waitForTimeout(1500);

  try {
    await selecionarPorDigitacao(page, '#idCli', COMPRADOR_1);
    await selecionarPrimeiraOpcao(page, '#idCondPagto');
    const [respPost] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/compradores')),
      page.click('button:has-text("Adicionar")', { force: true }),
    ]);
    expect(respPost.ok()).toBe(true);
    await page.waitForTimeout(800);

    await page.click('button:has-text("Próximo")', { force: true }); // -> Parcelamento
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Concluir")', { force: true });
    await page.waitForURL(`**/${BANCO}/vendas`);

    // ── Consulta de Vendas: filtra pelo leilão e troca pra Mapa de Seguro ──
    await page.goto(`/${BANCO}/consulta-vendas`);
    await selecionarPorDigitacao(page, '.ant-select:has-text("Digite para buscar o leilão")', leilao);
    await page.locator('text=Todos os lotes').click({ force: true });
    await page.keyboard.type(lotexx, { delay: 20 });
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.click('button:has-text("Consultar")', { force: true });
    await page.waitForTimeout(1500);

    await expect(page.locator('table tbody tr', { hasText: COMPRADOR_1 })).toHaveCount(1);

    await page.locator('.ant-select').filter({ hasText: 'Consulta de Vendas' }).click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('.ant-select-item-option:visible', { hasText: 'Mapa de Seguro' }).click({ force: true });
    await page.waitForTimeout(500);

    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.click('a:has-text("Imprimir PDF")', { force: true });
    const download = await downloadPromise;
    const pdfPath = await download.path();
    expect(pdfPath).toBeTruthy();

    const buffer = await require('fs').promises.readFile(pdfPath);
    const { text } = await pdfParse(buffer);

    expect(text).toContain('Mapa de Seguradoras');
    expect(text).toContain('Mapa da Compradores');
    expect(text).toContain(COMPRADOR_1);
    expect(text).toContain('Quantidade');
    expect(text).toContain('Total das Vendas');
  } finally {
    const del = await request.delete(`${API_URL}/api/${BANCO}/vendas/${movId}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Cleanup DELETE venda de teste ->', del.status());
  }
});
