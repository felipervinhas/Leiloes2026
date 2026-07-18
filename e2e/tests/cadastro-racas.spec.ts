import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPrimeiraOpcao } from '../helpers';

/**
 * Cobre o cadastro de Raças de ponta a ponta: cria preenchendo descrição,
 * espécie (Select) e raça, confirma persistência ao reabrir para edição,
 * edita e por fim exclui o próprio registro criado via API.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

test('cadastro de raças: criar, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const descricaoUnica = `E2E RACA ${sufixo}`;
  const descricaoEditada = `${descricaoUnica} EDITADA`;

  await loginUI(page);
  await page.goto(`/${BANCO}/racas`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Nova Raça")', { force: true });
  await page.waitForTimeout(500);
  await expect(page.locator('text=Nova Raça').first()).toBeVisible();

  await modal(page).locator('#descricao').fill(descricaoUnica);
  await selecionarPrimeiraOpcao(page, '#especies');
  await modal(page).locator('#raca').fill('Raça Teste E2E');

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  await page.fill('input[placeholder="Buscar por descrição ou espécie..."]', descricaoUnica);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  const linhaCriada = page.locator('table tbody tr', { hasText: descricaoUnica });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar persistência ────────────────────────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(600);

  await expect(modal(page).locator('#descricao')).toHaveValue(descricaoUnica);
  await expect(modal(page).locator('#raca')).toHaveValue('Raça Teste E2E');

  // ── Editar e confirmar a alteração ───────────────────────────────────
  await modal(page).locator('#descricao').fill(descricaoEditada);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar por descrição ou espécie..."]', descricaoEditada);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await expect(page.locator('table tbody tr', { hasText: descricaoEditada })).toHaveCount(1);

  // ── Limpeza: exclui via API a raça criada neste teste ───────────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/racas`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: descricaoEditada },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar a raça de teste para limpar').toBeGreaterThan(0);
  for (const r of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/racas/${r.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
