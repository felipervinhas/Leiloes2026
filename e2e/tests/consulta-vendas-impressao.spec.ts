import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { BANCO, exigirCredenciais, loginUI, selecionarPorDigitacao } from '../helpers';

/**
 * A Consulta de Vendas impressa várias vezes seguidas sai sempre igual. Antes o PDF era
 * gerado em segundo plano pelo PDFDownloadLink e regerado a cada mudança da tela; as
 * gerações sobrepostas saíam com lotes repetidos ou faltando (Knorr, 16/10/2026 — três vias
 * do mesmo mapa, cada uma diferente). Agora é gerado no clique. Só lê.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

test('três impressões seguidas da consulta de vendas saem idênticas', async ({ page }) => {
  test.setTimeout(180000);
  await loginUI(page);
  await page.goto(`/${BANCO}/consulta-vendas`);

  await selecionarPorDigitacao(page, 'input[placeholder="Digite para buscar o leilão..."], .ant-select:has-text("Digite para buscar o leilão...") input', 'VENDA PARTICULAR');
  await page.getByRole('button', { name: /Consultar/ }).click();
  const imprimir = page.getByRole('button', { name: /Imprimir PDF/ });
  await expect(imprimir).toBeEnabled({ timeout: 60000 });

  const tamanhos: number[] = [];
  const paginas: number[] = [];
  for (let i = 0; i < 3; i++) {
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), imprimir.click()]);
    const caminho = await download.path();
    const bytes = fs.readFileSync(caminho!);
    tamanhos.push(bytes.length);
    paginas.push((bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length);
    await expect(imprimir).toBeEnabled();
  }
  console.log('páginas por impressão:', paginas, '| bytes:', tamanhos);
  expect(paginas[0]).toBeGreaterThan(0);
  expect(new Set(paginas).size, 'as três impressões devem ter o mesmo número de páginas').toBe(1);
});
