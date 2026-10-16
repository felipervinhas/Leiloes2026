import { test, expect } from '@playwright/test';
import { exigirCredenciais, loginUI } from '../helpers';

/**
 * Na análise de cadastros do Dashboard ("Cadastros em Análise" / "Bloqueados recentes"),
 * "Ver cadastro" abre o cadastro completo do cliente — o mesmo da tela de Clientes, com as
 * abas e o Salvar — por cima da lista, e ao fechar volta para a análise. Só lê: não salva
 * nem aprova nada.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

test('Ver cadastro abre o cadastro completo sem sair da análise', async ({ page }) => {
  await loginUI(page);

  // o grupo que tiver alguém: em análise ou bloqueados recentes
  const cards = page.locator('text=/cadastros (em análise|bloqueados recentes)/i');
  await expect(cards.first()).toBeVisible({ timeout: 20000 });
  const analise = page.locator('.ant-drawer').filter({ hasText: /Cadastros (em Análise|Bloqueados Recentes)/ });
  let achou = false;
  for (let i = 0; i < await cards.count() && !achou; i++) {
    await cards.nth(i).click();
    await expect(analise).toBeVisible();
    await page.waitForSelector('.ant-drawer .ant-list-item, .ant-drawer .ant-empty', { timeout: 20000 });
    achou = await analise.locator('.ant-list-item').count() > 0;
    if (!achou) await analise.locator('.ant-drawer-close').click();
  }
  test.skip(!achou, 'Nenhum cadastro em análise ou bloqueado no banco de teste');

  const primeiro = analise.locator('.ant-list-item').first();
  const nome = (await primeiro.locator('.ant-list-item-meta-title a').innerText()).trim();
  await primeiro.getByRole('button', { name: 'Ver cadastro' }).click();

  // o cadastro do cliente abre por cima, já preenchido
  const cadastro = page.locator('.ant-drawer').filter({ hasText: `Editar — ${nome}` });
  await expect(cadastro).toBeVisible({ timeout: 20000 });
  await expect(cadastro.locator('input#nomexx')).toHaveValue(new RegExp(nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 20)));
  for (const aba of ['Pessoal', 'Endereço', 'Contatos', 'Documentos']) await expect(cadastro.getByRole('tab', { name: aba })).toBeVisible();

  // fechar volta para a análise, que continua aberta
  await cadastro.getByRole('button', { name: 'Cancelar' }).click();
  await expect(cadastro).toBeHidden();
  await expect(analise).toBeVisible();
  await expect(analise.locator('.ant-list-item').first()).toBeVisible();
});
