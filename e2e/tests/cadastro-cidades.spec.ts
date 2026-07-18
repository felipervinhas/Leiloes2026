import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI } from '../helpers';

/**
 * Cobre o cadastro de Cidades de ponta a ponta: cria, confirma persistência
 * ao reabrir para edição, edita e por fim exclui o próprio registro criado
 * via API, então pode rodar quantas vezes quiser sem acumular lixo no banco.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

test('cadastro de cidades: criar, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const nomeUnico = `E2E CIDADE ${sufixo}`;
  const nomeEditado = `${nomeUnico} EDITADA`;

  await loginUI(page);
  await page.goto(`/${BANCO}/cidades`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Nova Cidade")', { force: true });
  await page.waitForTimeout(500);
  await expect(page.locator('text=Nova Cidade').first()).toBeVisible();

  await modal(page).locator('#cidade').fill(nomeUnico);
  await modal(page).locator('#estado').fill('SP');
  await modal(page).locator('#pais').fill('Brasil');

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  await page.fill('input[placeholder="Buscar por cidade ou estado..."]', nomeUnico);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  const linhaCriada = page.locator('table tbody tr', { hasText: nomeUnico });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar persistência ────────────────────────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(600);

  await expect(modal(page).locator('#cidade')).toHaveValue(nomeUnico);
  await expect(modal(page).locator('#estado')).toHaveValue('SP');
  await expect(modal(page).locator('#pais')).toHaveValue('Brasil');

  // ── Editar e confirmar a alteração ───────────────────────────────────
  await modal(page).locator('#cidade').fill(nomeEditado);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar por cidade ou estado..."]', nomeEditado);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await expect(page.locator('table tbody tr', { hasText: nomeEditado })).toHaveCount(1);

  // ── Limpeza: exclui via API a cidade criada neste teste ─────────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/cidades`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: nomeEditado },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar a cidade de teste para limpar').toBeGreaterThan(0);
  for (const c of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/cidades/${c.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
