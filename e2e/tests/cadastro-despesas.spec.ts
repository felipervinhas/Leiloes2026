import { test, expect } from '@playwright/test';
import { API_URL, BANCO, exigirCredenciais, login, loginUI, selecionarPorDigitacao } from '../helpers';

const COMPRADOR_1 = process.env.E2E_COMPRADOR_1 || 'ALEX JUNIOR SILVA LUNA';

async function buscarNomeDeUmLeilao(request: import('@playwright/test').APIRequestContext, token: string) {
  const r = await request.get(`${API_URL}/api/${BANCO}/leiloes`, { headers: { Authorization: `Bearer ${token}` } });
  const leiloes = await r.json();
  if (!leiloes.length) throw new Error('Nenhum leilão cadastrado em ' + BANCO);
  return leiloes[0].leilao as string;
}

/**
 * Cobre o cadastro de Despesas (lançamentos de Despesa/Crédito/Fechamento)
 * de ponta a ponta: cria um lançamento vinculando um cliente existente,
 * confirma persistência ao reabrir para edição, edita o valor e as
 * observações e por fim exclui o próprio registro criado via API.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

test('cadastro de despesas: criar, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const obsUnica = `E2E DESPESA ${sufixo}`;
  const obsEditada = `${obsUnica} EDITADA`;

  const tokenSetup = await login(request);
  const nomeLeilao = await buscarNomeDeUmLeilao(request, tokenSetup);

  await loginUI(page);
  await page.goto(`/${BANCO}/despesas`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Nova Despesa")', { force: true });
  await page.waitForTimeout(600);
  await expect(page.locator('text=Novo Lançamento').first()).toBeVisible();

  // Leilão é obrigatório pra salvar
  await selecionarPorDigitacao(page, '#codLei', nomeLeilao);
  await modal(page).locator('#valor').fill('1500,00');
  await selecionarPorDigitacao(page, '#codigoCliente', COMPRADOR_1);
  await modal(page).locator('#observacoes').fill(obsUnica);

  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  await page.fill('input[placeholder="Buscar por observação ou cliente..."]', obsUnica);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  const linhaCriada = page.locator('table tbody tr', { hasText: obsUnica });
  await expect(linhaCriada).toHaveCount(1);
  await expect(linhaCriada).toContainText('1.500,00');

  // ── Reabrir e confirmar persistência ────────────────────────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(600);

  await expect(modal(page).locator('#observacoes')).toHaveValue(obsUnica);
  await expect(modal(page).locator('#valor')).toHaveValue('R$ 1.500');

  // ── Editar valor e observações, confirmar a alteração ───────────────
  await modal(page).locator('#valor').fill('2000,00');
  await modal(page).locator('#observacoes').fill(obsEditada);
  await page.locator('.ant-modal-footer .ant-btn-primary').click({ force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar por observação ou cliente..."]', obsEditada);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  const linhaEditada = page.locator('table tbody tr', { hasText: obsEditada });
  await expect(linhaEditada).toHaveCount(1);
  await expect(linhaEditada).toContainText('2.000,00');

  // ── Limpeza: exclui via API a despesa criada neste teste ────────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/despesas`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: obsEditada },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar a despesa de teste para limpar').toBeGreaterThan(0);
  for (const d of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/despesas/${d.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
