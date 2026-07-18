import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI } from '../helpers';

/**
 * Cobre o cadastro de Perfis de Acesso de ponta a ponta: cria com os três
 * Selects Sim/Não (inserir, alterar, deletar), confirma persistência ao
 * reabrir para edição, edita o nome e por fim exclui o próprio registro
 * criado via API. A tela não tem busca — a listagem inteira é carregada de
 * uma vez, então a confirmação é feita filtrando as linhas pelo nome único.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

test('cadastro de perfis: criar, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const nomeUnico = `E2E PERFIL ${sufixo}`;
  const nomeEditado = `${nomeUnico} EDITADO`;

  await loginUI(page);
  await page.goto(`/${BANCO}/perfis`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Novo Perfil")', { force: true });
  await page.waitForTimeout(500);
  await expect(page.locator('text=Novo Perfil').first()).toBeVisible();

  await modal(page).locator('#perfil').fill(nomeUnico);
  // inserir/alterar/deletar já vêm com valor padrão "Não" — troca só "inserir".
  await modal(page).locator('#inserir').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('.ant-select-item-option', { hasText: 'Sim' }).click({ force: true });

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  const linhaCriada = page.locator('table tbody tr', { hasText: nomeUnico });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar persistência ────────────────────────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(600);

  await expect(modal(page).locator('#perfil')).toHaveValue(nomeUnico);
  const valorInserir = await modal(page)
    .locator('#inserir')
    .evaluate(el => el.closest('.ant-select')?.querySelector('.ant-select-content')?.getAttribute('title'));
  expect(valorInserir).toBe('Sim');

  // ── Editar e confirmar a alteração ───────────────────────────────────
  await modal(page).locator('#perfil').fill(nomeEditado);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await expect(page.locator('table tbody tr', { hasText: nomeEditado })).toHaveCount(1);

  // ── Limpeza: exclui via API o perfil criado neste teste ─────────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/perfis`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const todos = await buscaRes.json();
  const encontrados = todos.filter((p: any) => p.perfil === nomeEditado);
  expect(encontrados.length, 'deveria achar o perfil de teste para limpar').toBeGreaterThan(0);
  for (const p of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/perfis/${p.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
