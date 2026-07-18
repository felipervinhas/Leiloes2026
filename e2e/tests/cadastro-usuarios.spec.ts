import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPrimeiraOpcao } from '../helpers';

/**
 * Cobre o cadastro de Usuários do Sistema de ponta a ponta: cria na aba
 * Dados (nome, CPF, e-mail, senha, tipo, ativo) e marca duas permissões na
 * aba Permissões (Leilões e Vendas). Confirma persistência ao reabrir para
 * edição — tanto os dados quanto as permissões marcadas — edita o nome e
 * por fim revoga (exclui) o próprio usuário criado via API.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

async function abrirAba(page: import('@playwright/test').Page, nome: string) {
  await page.locator('.ant-modal').getByRole('tab', { name: nome }).click({ force: true });
  await page.waitForTimeout(300);
}

test('cadastro de usuários: criar com permissões, confirmar persistência, editar e revogar', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const nomeUnico = `E2E USUARIO ${sufixo}`;
  const nomeEditado = `${nomeUnico} EDITADO`;
  const emailTeste = `e2e.usuario.${sufixo}@teste.invalido`;

  await loginUI(page);
  await page.goto(`/${BANCO}/usuarios`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Novo Usuário")', { force: true });
  await page.waitForTimeout(600);
  await expect(page.locator('text=Novo Usuário do Sistema').first()).toBeVisible();

  await modal(page).locator('#nomexx').fill(nomeUnico);
  await modal(page).locator('#cpfxxx').fill('999.888.777-00');
  await modal(page).locator('#emailx').fill(emailTeste);
  await modal(page).locator('#senhax').fill('SenhaTesteE2E123');
  await selecionarPrimeiraOpcao(page, '#tipoUsuario');

  await abrirAba(page, 'Permissões');
  const checkboxLeiloes = modal(page).locator('label.ant-checkbox-wrapper').filter({ hasText: /^Leilões$/ });
  const checkboxVendas = modal(page).locator('label.ant-checkbox-wrapper').filter({ hasText: /^Vendas$/ });
  await checkboxLeiloes.click({ force: true });
  await checkboxVendas.click({ force: true });
  await expect(page.locator('text=2 de')).toBeVisible();

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  await page.fill('input[placeholder="Buscar por nome ou e-mail..."]', nomeUnico);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  const linhaCriada = page.locator('table tbody tr', { hasText: nomeUnico });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar persistência (dados + permissões) ──────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(800);

  await expect(modal(page).locator('#nomexx')).toHaveValue(nomeUnico);
  await expect(modal(page).locator('#emailx')).toHaveValue(emailTeste);

  await abrirAba(page, 'Permissões');
  await expect(page.locator('text=2 de')).toBeVisible();
  await expect(checkboxLeiloes.locator('input[type="checkbox"]')).toBeChecked();
  await expect(checkboxVendas.locator('input[type="checkbox"]')).toBeChecked();

  // ── Editar o nome e confirmar a alteração ───────────────────────────
  await abrirAba(page, 'Dados');
  await modal(page).locator('#nomexx').fill(nomeEditado);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar por nome ou e-mail..."]', nomeEditado);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await expect(page.locator('table tbody tr', { hasText: nomeEditado })).toHaveCount(1);

  // ── Limpeza: revoga (exclui) via API o usuário criado neste teste ───
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: nomeEditado },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar o usuário de teste para limpar').toBeGreaterThan(0);
  for (const u of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/usuarios/${u.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
