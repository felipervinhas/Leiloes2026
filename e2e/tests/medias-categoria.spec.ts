import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { exigirCredenciais, loginUI } from '../helpers';

/**
 * Consultas → Médias por Categoria: consulta um período, desmarca uma categoria (ela sai da
 * tabela e o total cai, sem nova consulta) e gera o PDF. Só lê.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const reais = (t: string) => Number(t.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

test('médias por categoria: período, desmarcar categoria e PDF', async ({ page }) => {
  test.setTimeout(180000);
  await loginUI(page);

  await page.locator('.ant-menu').getByText('Consultas', { exact: true }).click();
  await page.locator('.ant-menu').getByText('Médias por Categoria', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Médias por categoria' })).toBeVisible();

  // período largo para ter vendas no banco de teste
  const datas = page.locator('.ant-picker-range input');
  await datas.nth(0).click();
  await datas.nth(0).fill('01/01/2024');
  await datas.nth(1).fill('31/12/2026');
  await page.keyboard.press('Enter');
  const consultar = page.getByRole('button', { name: /Consultar/ });
  await consultar.click();
  // espera esta consulta terminar (o botão sai do carregando)
  await expect(consultar).not.toHaveClass(/ant-btn-loading/, { timeout: 90000 });

  const linhas = page.locator('.ant-table-tbody > tr.ant-table-row-level-0');
  await expect(linhas.first()).toBeVisible({ timeout: 90000 });
  const qtdAntes = await linhas.count();
  const totalAntes = reais(await page.locator('.ant-statistic').filter({ hasText: 'Total' }).locator('.ant-statistic-content').innerText());
  expect(qtdAntes).toBeGreaterThan(0);

  // desmarca a primeira categoria da tabela: sai da tabela e o total cai
  const primeira = (await linhas.first().locator('td').nth(1).locator('strong').innerText()).trim();
  const semEspecie = primeira.replace(/ \/ [^/]+$/, '');
  await page.locator('.ant-card').filter({ hasText: /^Categorias/ }).getByRole('checkbox', { name: semEspecie, exact: true }).first().uncheck();
  await expect(linhas).toHaveCount(qtdAntes - 1);
  const totalDepois = reais(await page.locator('.ant-statistic').filter({ hasText: 'Total' }).locator('.ant-statistic-content').innerText());
  expect(totalDepois).toBeLessThan(totalAntes);

  // abre os leilões de uma categoria
  await linhas.first().locator('.ant-table-row-expand-icon').click();
  await expect(page.locator('.ant-table-expanded-row').first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90000 }),
    page.getByRole('button', { name: /^file-pdf PDF$/ }).click(),
  ]);
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.slice(0, 4).toString()).toBe('%PDF');
});
