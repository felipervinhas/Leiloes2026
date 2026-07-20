import { test, expect } from '@playwright/test';
import path from 'path';
import { API_URL, BANCO, exigirCredenciais, login, loginUI } from '../helpers';

/**
 * Cobre a feature de Chamados (abertura de tickets de erro/melhoria) de
 * ponta a ponta: abre um chamado com print anexado, confirma que aparece
 * na listagem com status Pendente, abre o modal de gerenciamento, confirma
 * o print e muda o status para Em Andamento com uma resposta — depois
 * exclui o próprio registro criado via API.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body:visible');

test('chamados: abrir com print, confirmar na listagem e mudar status', async ({ page, request }) => {
  const sufixo = Date.now();
  const titulo = `E2E CHAMADO ${sufixo}`;

  await loginUI(page);
  await page.goto(`/${BANCO}/chamados`);

  // ── Abrir chamado com print anexado ─────────────────────────────────
  await page.click('button:has-text("Abrir Chamado")', { force: true });
  await page.waitForTimeout(500);

  await modal(page).locator('input[placeholder="Resumo do problema ou sugestão"]').fill(titulo);
  await modal(page).locator('textarea').fill('Descrição de teste E2E do fluxo completo de Chamados.');
  await modal(page).locator('input[type="file"]').setInputFiles(path.join(__dirname, '../fixtures/print-teste.png'));
  await page.waitForTimeout(500);

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Chamado aberto com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  const linha = page.locator('table tbody tr', { hasText: titulo });
  await expect(linha).toHaveCount(1);
  await expect(linha).toContainText('Pendente');
  await expect(linha).toContainText('Erro');

  // ── Abrir Ver/Gerenciar, confirmar print, mudar status ──────────────
  await linha.locator('button:has-text("Ver / Gerenciar")').click({ force: true });
  await page.waitForTimeout(600);
  const detalheModal = modal(page);
  await expect(detalheModal.locator('img[alt="Print do chamado"]')).toBeVisible();

  await detalheModal.locator('.ant-select').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('.ant-select-item-option-content:visible', { hasText: 'Em Andamento' }).click({ force: true });
  await detalheModal.locator('textarea').fill('Analisando o chamado de teste.');
  await page.locator('.ant-modal-footer .ant-btn-primary:visible').click({ force: true });
  await expect(page.locator('text=Chamado atualizado')).toBeVisible();
  await page.waitForTimeout(1000);

  const linhaAtualizada = page.locator('table tbody tr', { hasText: titulo });
  await expect(linhaAtualizada).toContainText('Em Andamento');

  // ── Limpeza: exclui via API o chamado criado neste teste ────────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/chamados`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: titulo },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar o chamado de teste para limpar').toBeGreaterThan(0);
  for (const c of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/chamados/${c.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
