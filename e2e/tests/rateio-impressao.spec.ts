import { test, expect, APIRequestContext } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPorDigitacao } from '../helpers';

const COMPRADOR_1 = process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA';
const COMPRADOR_2 = process.env.E2E_COMPRADOR_2 || 'AUGUSTO DA SILVA HEHN';

/**
 * Regressão do bug: em Consulta de Vendas, um lote rateado entre dois
 * compradores gera duas linhas com o mesmo MOVIMENTO.ID. Antes da correção,
 * a tabela usava `id` como rowKey/seleção, então marcar uma linha marcava as
 * duas (mesma key) e a impressão selecionada saía duplicada. Este teste:
 *  1. Lança uma venda nova com um lote rateado 50/50 entre dois compradores.
 *  2. Em Consulta de Vendas, marca a linha de UM comprador e confirma que a
 *     linha do outro comprador não é afetada.
 *  3. Baixa o PDF impresso e confirma que só o comprador marcado aparece.
 *
 * Cada execução consome 1 lote disponível do leilão escolhido no banco de
 * teste MacedoBkp (backup, não é produção) — não rode isso em loop automático.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

async function encontrarLeilaoComLoteDisponivel(request: APIRequestContext, token: string) {
  const leiloesRes = await request.get(`${API_URL}/api/${BANCO}/leiloes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leiloes = await leiloesRes.json();

  for (const l of leiloes) {
    const lotesRes = await request.get(
      `${API_URL}/api/${BANCO}/vendas/lotes-disponiveis/${l.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const lotes = await lotesRes.json();
    if (Array.isArray(lotes) && lotes.length > 0) {
      return { idLeilao: l.id, leilao: l.leilao as string };
    }
  }
  throw new Error('Nenhum leilão com lote disponível encontrado em ' + BANCO);
}

test('lote rateado entre 2 compradores: marcar 1 não afeta o outro, e impressão sai sem duplicar', async ({
  page,
  request,
}) => {
  const token = await login(request);
  const { leilao } = await encontrarLeilaoComLoteDisponivel(request, token);

  await loginUI(page);

  // ── Lançamento da venda (Vendas > Nova Venda) ──────────────────────────
  await page.goto(`/${BANCO}/vendas`);
  await page.click('button:has-text("Nova Venda")', { force: true });
  await page.waitForTimeout(1500);

  await selecionarPorDigitacao(page, '#idLeilao', leilao);
  await page.fill('input[placeholder="Ex: 123456"]', '0');
  await page.click('button:has-text("Próximo")', { force: true });
  await page.waitForTimeout(1500);

  // primeiro lote disponível do leilão escolhido
  await page.locator('#idLote').click({ force: true });
  await page.waitForTimeout(600);
  const loteLabel = (await page.locator('.ant-select-item-option-content').first().textContent()) || '';
  const lotexx = loteLabel.split('—')[0].trim(); // ex.: "07" ou "01.2"
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  const valorInput = page.locator('.ant-form-item input').nth(2);
  await valorInput.click({ force: true });
  await valorInput.fill('5000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Próximo")', { force: true });
  await page.waitForTimeout(1500);

  // comprador 1: 50%
  await selecionarPorDigitacao(page, '#idCli', COMPRADOR_1);
  await page.locator('#idCondPagto').click({ force: true });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.locator('#percen').fill('50');
  await page.click('button:has-text("Adicionar")', { force: true });
  await page.waitForTimeout(1200);

  // comprador 2: 50%
  await selecionarPorDigitacao(page, '#idCli', COMPRADOR_2);
  await page.locator('#idCondPagto').click({ force: true });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.locator('#percen').fill('50');
  await page.click('button:has-text("Adicionar")', { force: true });
  await page.waitForTimeout(1200);

  // Ant Design renderiza uma "measure row" oculta em tbody para calcular
  // largura de colunas; filtramos para contar só as linhas visíveis.
  await expect(page.locator('table tbody tr:visible')).toHaveCount(2);

  await page.click('button:has-text("Próximo")', { force: true }); // -> Parcelamento
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Concluir")', { force: true });
  await page.waitForURL(`**/${BANCO}/vendas`);

  // ── Consulta de Vendas: valida seleção e impressão ─────────────────────
  // Filtra por leilão + lote específico: o mesmo leilão de teste pode ter
  // sido reaproveitado em execuções anteriores, então filtrar só por leilão
  // e nome de comprador não é suficiente para isolar esta venda.
  await page.goto(`/${BANCO}/consulta-vendas`);
  await page.locator('text=Todos os leilões').click({ force: true });
  await page.keyboard.type(leilao, { delay: 20 });
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.locator('text=Todos os lotes').click({ force: true });
  await page.keyboard.type(lotexx, { delay: 20 });
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.click('button:has-text("Consultar")', { force: true });
  await page.waitForTimeout(1500);

  const rowComprador1 = page.locator('table tbody tr', { hasText: COMPRADOR_1 });
  const rowComprador2 = page.locator('table tbody tr', { hasText: COMPRADOR_2 });
  await expect(rowComprador1).toHaveCount(1);
  await expect(rowComprador2).toHaveCount(1);

  await rowComprador1.locator('input[type="checkbox"]').click({ force: true });

  await expect(rowComprador1.locator('input[type="checkbox"]')).toBeChecked();
  await expect(rowComprador2.locator('input[type="checkbox"]')).not.toBeChecked();
  await expect(page.locator('button:has-text("Imprimir PDF")')).toContainText('1 selecionado');

  const downloadPromise = page.waitForEvent('download');
  await page.click('a:has-text("Imprimir PDF")', { force: true });
  const download = await downloadPromise;
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();

  const buffer = await require('fs').promises.readFile(pdfPath);
  const { text } = await pdfParse(buffer);

  expect(text).toContain(COMPRADOR_1);
  expect(text).not.toContain(COMPRADOR_2);
});
