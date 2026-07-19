import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI } from '../helpers';

const VENDEDOR = process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA';

/**
 * Cobre a tela de Acerto de Vendedor de ponta a ponta: cria um leilão
 * auxiliar via API (sem entradas/promissórias, para não depender de dados
 * de venda pré-existentes), consulta o acerto desse leilão com um vendedor
 * já cadastrado, lança um Crédito na tela, confirma que aparece na tabela e
 * nos totais, edita o valor, confirma a atualização e por fim exclui o
 * lançamento e o leilão auxiliar via API.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

/**
 * Os Selects de leilão/vendedor desta tela não usam Form.Item (não têm id),
 * então localizamos pelo texto do placeholder mostrado antes da seleção.
 */
async function selecionarSelectPorPlaceholder(
  page: import('@playwright/test').Page,
  placeholder: string,
  texto: string
) {
  await page.locator('.ant-select').filter({ hasText: placeholder }).click({ force: true });
  await page.waitForTimeout(400);
  await page.keyboard.type(texto, { delay: 30 });
  // Dropdowns já fechados deixam suas opções ocultas (mas ainda no DOM), então
  // filtramos só as visíveis — senão .first() pode pegar a opção errada de um
  // Select anterior que já fechou.
  await page.locator('.ant-select-item-option-content:visible').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

test('acerto de vendedor: consultar, lançar crédito, confirmar totais, editar e excluir', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const sufixo = Date.now();
  const nomeLeilaoAux = `E2E LEILAO ACERTO ${sufixo}`;
  const obsUnica = `E2E CREDITO ${sufixo}`;
  const obsEditada = `${obsUnica} EDITADA`;

  const token = await login(request);
  const criarLeilaoRes = await request.post(`${API_URL}/api/${BANCO}/leiloes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { leilao: nomeLeilaoAux },
  });
  expect(criarLeilaoRes.ok()).toBeTruthy();
  const { id: idLeilaoAux } = await criarLeilaoRes.json();

  await loginUI(page);
  await page.goto(`/${BANCO}/acerto-vendedor`);

  // ── Consultar o acerto do leilão auxiliar + vendedor conhecido ──────
  await selecionarSelectPorPlaceholder(page, 'Digite para buscar o leilão...', nomeLeilaoAux);
  await selecionarSelectPorPlaceholder(page, 'Digite para buscar vendedor...', VENDEDOR);
  await page.click('button:has-text("Consultar")', { force: true });
  await page.waitForTimeout(1200);

  // Selects renderizam o dropdown num portal no fim do <body>, então
  // escopamos a busca a <main> para não pegar a opção (oculta) do Select.
  await expect(page.locator('main').getByText(VENDEDOR).last()).toBeVisible();
  await expect(page.locator('text=Entradas (0)')).toBeVisible();

  // ── Lançar um crédito ────────────────────────────────────────────────
  await page.click('button:has-text("Novo Lançamento")', { force: true });
  await page.waitForTimeout(500);
  await expect(page.locator('text=Novo Lançamento').first()).toBeVisible();

  // Select de Tipo não tem showSearch — digitação usaria type-ahead nativo,
  // que pode ambiguar entre as opções; clicamos direto na opção certa.
  await modal(page).locator('#dc').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('.ant-select-item-option-content:visible', { hasText: 'Crédito' }).first().click({ force: true });
  await page.waitForTimeout(200);
  await modal(page).locator('#valor').fill('300,00');
  await modal(page).locator('#observacoes').fill(obsUnica);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1200);

  const linhaCriada = page.locator('table tbody tr', { hasText: obsUnica });
  await expect(linhaCriada).toHaveCount(1);
  await expect(page.locator('text=Total Créditos').locator('..')).toContainText('300,00');

  // ── Reabrir, confirmar persistência, editar e confirmar ─────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(600);
  await expect(modal(page).locator('#observacoes')).toHaveValue(obsUnica);
  await expect(modal(page).locator('#valor')).toHaveValue('R$ 300');

  await modal(page).locator('#observacoes').fill(obsEditada);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1200);

  await expect(page.locator('table tbody tr', { hasText: obsEditada })).toHaveCount(1);

  // ── Limpeza: exclui via API o lançamento e o leilão auxiliar ────────
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/despesas`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: obsEditada },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar o lançamento de teste para limpar').toBeGreaterThan(0);
  for (const d of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/despesas/${d.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  await request.delete(`${API_URL}/api/${BANCO}/leiloes/${idLeilaoAux}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
});
