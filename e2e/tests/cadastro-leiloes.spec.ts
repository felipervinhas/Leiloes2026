import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPorDigitacao, selecionarPrimeiraOpcao } from '../helpers';

/**
 * Cadastro de Leilões de ponta a ponta: cria um leilão preenchendo os
 * principais campos (data, horários, leiloeiro, endereço, cidade, condição
 * de pagamento, comissões, múltiplo, data saldo, tipo, transmissão, links,
 * regulamento/observações), confirma que persistem ao reabrir para edição,
 * edita o nome, confirma na listagem e por fim exclui o próprio registro
 * criado via API — pode rodar quantas vezes quiser sem acumular lixo.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

test('cadastro de leilões: criar com dados completos, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const nomeUnico = `E2E LEILAO ${sufixo}`;
  const nomeEditado = `${nomeUnico} EDITADO`;

  await loginUI(page);
  await page.goto(`/${BANCO}/leiloes`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Novo Leilão")', { force: true });
  await page.waitForTimeout(600);
  await expect(page.locator('text=Novo Leilão').first()).toBeVisible();

  await modal(page).locator('#leilao').fill(nomeUnico);
  await modal(page).locator('#datlei').fill('01/12/2026');
  await page.keyboard.press('Escape');
  await modal(page).locator('#horaInicio').fill('09:00');
  await modal(page).locator('#horaFechamentoPre').fill('08:30');
  await modal(page).locator('#leiloe').fill('Leiloeiro Teste E2E');
  await modal(page).locator('#endere').fill('Parque de Exposições, s/n');
  await selecionarPrimeiraOpcao(page, '#codcid');
  await selecionarPrimeiraOpcao(page, '#condic');
  await modal(page).locator('#comven').fill('5');
  await modal(page).locator('#comcom').fill('7');
  await modal(page).locator('#multiplo').fill('1');
  await modal(page).locator('#tipoLeilao').fill('Leilão de Elite');
  await modal(page).locator('#transmissao').fill('Online');
  await modal(page).locator('#urlcatalogo').fill('https://exemplo.invalido/catalogo');
  await modal(page).locator('#regulamento').fill('Regulamento de teste E2E.');
  await modal(page).locator('#observacoes').fill('Observações de teste E2E.');

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  await page.fill('input[placeholder="Buscar leilão..."]', nomeUnico);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  const linhaCriada = page.locator('table tbody tr', { hasText: nomeUnico });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar persistência ────────────────────────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(800);

  await expect(modal(page).locator('#leilao')).toHaveValue(nomeUnico);
  await expect(modal(page).locator('#leiloe')).toHaveValue('Leiloeiro Teste E2E');
  await expect(modal(page).locator('#endere')).toHaveValue('Parque de Exposições, s/n');
  await expect(modal(page).locator('#tipoLeilao')).toHaveValue('Leilão de Elite');

  // ── Editar o nome e confirmar a alteração ───────────────────────────
  await modal(page).locator('#leilao').fill(nomeEditado);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar leilão..."]', nomeEditado);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await expect(page.locator('table tbody tr', { hasText: nomeEditado })).toHaveCount(1);

  // ── Limpeza: exclui via API o leilão criado neste teste ─────────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/leiloes`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: nomeEditado },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar o leilão de teste para limpar').toBeGreaterThan(0);
  for (const l of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/leiloes/${l.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
