import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPrimeiraOpcao } from '../helpers';

/**
 * Cobre o cadastro de Condições de Pagamento de ponta a ponta, preenchendo
 * descrição, qtd. de parcelas, prazo médio, desconto, os três Selects
 * Sim/Não (à vista, entrada, inverter) e os 6 campos de vencimento de
 * parcelas. Confirma persistência ao reabrir para edição, edita a
 * descrição e por fim exclui o próprio registro criado via API.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

test('cadastro de condições de pagamento: criar, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const descricaoUnica = `E2E CONDICAO ${sufixo}`;
  const descricaoEditada = `${descricaoUnica} EDITADA`;

  await loginUI(page);
  await page.goto(`/${BANCO}/condicoes-pagamento`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Nova Condição")', { force: true });
  await page.waitForTimeout(500);
  await expect(page.locator('text=Nova Condição').first()).toBeVisible();

  await modal(page).locator('#desfin').fill(descricaoUnica);
  await modal(page).locator('#qtdpar').fill('6');
  await modal(page).locator('#przmed').fill('30');
  await modal(page).locator('#descon').fill('5');
  await selecionarPrimeiraOpcao(page, '#avista');
  await selecionarPrimeiraOpcao(page, '#entrad');
  await selecionarPrimeiraOpcao(page, '#invert');
  for (let i = 1; i <= 6; i++) {
    await modal(page).locator(`#parc0${i}`).fill(String(i * 30));
  }

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  await page.fill('input[placeholder="Buscar condição..."]', descricaoUnica);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  const linhaCriada = page.locator('table tbody tr', { hasText: descricaoUnica });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar persistência ────────────────────────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(700);

  await expect(modal(page).locator('#desfin')).toHaveValue(descricaoUnica);
  await expect(modal(page).locator('#qtdpar')).toHaveValue('6');
  await expect(modal(page).locator('#descon')).toHaveValue('5');
  await expect(modal(page).locator('#parc01')).toHaveValue('30');
  await expect(modal(page).locator('#parc06')).toHaveValue('180');

  // ── Editar e confirmar a alteração ───────────────────────────────────
  await modal(page).locator('#desfin').fill(descricaoEditada);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar condição..."]', descricaoEditada);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await expect(page.locator('table tbody tr', { hasText: descricaoEditada })).toHaveCount(1);

  // ── Limpeza: exclui via API a condição criada neste teste ──────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/condicoes-pagamento`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: descricaoEditada },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar a condição de teste para limpar').toBeGreaterThan(0);
  for (const c of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/condicoes-pagamento/${c.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
