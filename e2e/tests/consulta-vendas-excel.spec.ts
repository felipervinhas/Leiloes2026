import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { BANCO, exigirCredenciais, loginUI, selecionarPorDigitacao } from '../helpers';

// a biblioteca de planilhas é do frontend; o e2e só a usa para ler o arquivo baixado
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'xlsx'));

/**
 * Mapa de Compradores e Relação de Compradores exportam Excel com o conteúdo do próprio
 * relatório (antes o botão só exportava a grade da consulta em CSV e o usuário não
 * conseguia a planilha desses dois). Só lê.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

async function escolherRelatorio(page: Page, nome: string) {
  await page.locator('.ant-select', { hasText: /Consulta de Vendas|Mapa de|Relação de|Vendedores \/|Médias|Fatura/ }).last().click();
  await page.locator('.ant-select-item-option', { hasText: nome }).first().click();
}

async function baixarPlanilha(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90000 }),
    page.getByRole('button', { name: 'Exportar Excel' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const wb = XLSX.readFile(await download.path());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, any>[];
}

test('Mapa e Relação de Compradores exportam Excel', async ({ page }) => {
  test.setTimeout(240000);
  await loginUI(page);
  await page.goto(`/${BANCO}/consulta-vendas`);
  await selecionarPorDigitacao(page, 'input[placeholder="Digite para buscar o leilão..."], .ant-select:has-text("Digite para buscar o leilão...") input', 'VENDA PARTICULAR');
  await page.getByRole('button', { name: /Consultar/ }).click();
  await expect(page.getByRole('button', { name: /Imprimir PDF/ })).toBeEnabled({ timeout: 60000 });
  const lotesNaGrade = await page.locator('.ant-table-tbody tr.ant-table-row').count();
  expect(lotesNaGrade).toBeGreaterThan(0);

  await escolherRelatorio(page, 'Mapa de Compradores');
  const mapa = await baixarPlanilha(page);
  expect(mapa.length).toBeGreaterThan(0);
  expect(Object.keys(mapa[0])).toEqual(expect.arrayContaining(['Comprador', 'CPF/CNPJ', 'Lote', 'Descrição', 'Localidade', 'Propriedade', 'Inscrição']));
  expect(mapa.every(l => String(l['Comprador'] || '').length > 0)).toBeTruthy();

  await escolherRelatorio(page, 'Relação de Compradores');
  const relacao = await baixarPlanilha(page);
  expect(relacao.length).toBeGreaterThan(0);
  expect(Object.keys(relacao[0])).toEqual(expect.arrayContaining(['Comprador', 'CPF/CNPJ', 'Cidade', 'Celular', 'E-mail', 'Propriedade']));
  // todo comprador do mapa aparece na relação
  const naRelacao = new Set(relacao.map(l => l['Comprador']));
  expect([...new Set(mapa.map(l => l['Comprador']))].every(c => naRelacao.has(c))).toBeTruthy();
  console.log(`mapa: ${mapa.length} linhas · relação: ${relacao.length} linhas (${naRelacao.size} compradores)`);
});
