import { test, expect } from '@playwright/test';
import {
  API_URL,
  BANCO,
  exigirCredenciais,
  login,
  loginUI,
  selecionarPorDigitacao,
  selecionarPrimeiraOpcao,
} from '../helpers';

/**
 * Cadastro de Lotes de ponta a ponta: cria um leilão auxiliar via API (um
 * lote sempre pertence a um leilão), depois cria o lote pela UI preenchendo
 * os principais campos (nº do lote, categoria, ordem, data nasc., descrição,
 * leilão, raça, vendedor, condição de pagamento, TAT, peso, pelagem,
 * filiação, valor de inscrição, lance máximo, múltiplo, público/vendido,
 * vídeo e observações). Confirma que persistem ao reabrir para edição,
 * edita a descrição, confirma na listagem e por fim exclui o próprio lote e
 * o leilão auxiliar via API — pode rodar quantas vezes quiser sem acumular
 * lixo no banco.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const modal = (page: import('@playwright/test').Page) => page.locator('.ant-modal-body');

test('cadastro de lotes: criar com dados completos, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  // A tabela de Lotes deste banco tem ~17 mil registros: o GET inicial (sem
  // filtro) sozinho já leva ~12s pela rede até o SQL Server na AWS, então o
  // timeout padrão de 60s é apertado demais somando todos os passos.
  test.setTimeout(120_000);
  const sufixo = Date.now();
  const nomeLeilaoAux = `E2E LEILAO AUX LOTE ${sufixo}`;
  const lotexx = `9${String(sufixo).slice(-4)}`;
  const descricaoUnica = `E2E TESTE LOTE ${sufixo}`;
  const descricaoEditada = `${descricaoUnica} EDITADO`;

  const token = await login(request);
  const criarLeilaoRes = await request.post(`${API_URL}/api/${BANCO}/leiloes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { leilao: nomeLeilaoAux },
  });
  expect(criarLeilaoRes.ok()).toBeTruthy();
  const { id: idLeilaoAux } = await criarLeilaoRes.json();

  await loginUI(page);
  await page.goto(`/${BANCO}/lotes`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Novo Lote")', { force: true });
  await page.waitForTimeout(600);
  await expect(page.locator('text=Novo Lote').first()).toBeVisible();

  await modal(page).locator('#lotexx').fill(lotexx);
  await modal(page).locator('#ordem').fill('1');
  await modal(page).locator('#datnas').fill('01/01/2023');
  await page.keyboard.press('Escape');
  await modal(page).locator('#deslot').fill(descricaoUnica);
  await selecionarPorDigitacao(page, '#idleilao', nomeLeilaoAux);
  await selecionarPrimeiraOpcao(page, '#racaxx');
  await selecionarPrimeiraOpcao(page, '#codven');
  await selecionarPrimeiraOpcao(page, '#condic');
  await modal(page).locator('#tatxxx').fill('TAT-E2E');
  await modal(page).locator('#pesoxx').fill('450');
  await modal(page).locator('#pelage').fill('Castanha');
  await modal(page).locator('#filiacao').fill('Pai Teste x Mãe Teste');
  await modal(page).locator('#vlrins').fill('100');
  await modal(page).locator('#lanmax').fill('50000');
  await modal(page).locator('#multiplo').fill('1');
  await modal(page).locator('#publica').click({ force: true });
  await modal(page).locator('#urlvideo').fill('https://exemplo.invalido/video');
  await modal(page).locator('#obslot').fill('Observações de teste E2E.');
  await modal(page).locator('#comentario').fill('Comentário de teste E2E.');

  // A lista de Lotes deste banco tem ~17 mil registros: o toast "Salvo com
  // sucesso" pode expirar antes do fim do re-render pesado da tabela, então
  // confirmamos pela resposta HTTP do POST em vez do toast (mais confiável).
  await page.waitForTimeout(300);
  const [criarResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/lotes') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'OK', exact: true }).click({ force: true }),
  ]);
  expect(criarResp.ok(), 'POST /lotes deveria retornar sucesso').toBeTruthy();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  // Salvar já dispara sozinho um GET /lotes (recarrega a lista); esperamos
  // especificamente a resposta da NOSSA busca para não confundir com esse
  // request automático, que pode chegar antes ou depois do nosso.
  await page.fill('input[placeholder="Buscar lote..."]', descricaoUnica);
  const [buscaCriarResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/lotes') && new URL(r.url()).searchParams.get('busca') === descricaoUnica),
    page.keyboard.press('Enter'),
  ]);
  expect(buscaCriarResp.ok()).toBeTruthy();
  await page.waitForTimeout(500);

  const linhaCriada = page.locator('table tbody tr', { hasText: descricaoUnica });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar persistência ────────────────────────────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(800);

  await expect(modal(page).locator('#lotexx')).toHaveValue(lotexx);
  await expect(modal(page).locator('#deslot')).toHaveValue(descricaoUnica);
  await expect(modal(page).locator('#tatxxx')).toHaveValue('TAT-E2E');
  await expect(modal(page).locator('#pesoxx')).toHaveValue('450');
  await expect(modal(page).locator('#pelage')).toHaveValue('Castanha');

  // ── Editar a descrição e confirmar a alteração ──────────────────────
  await modal(page).locator('#deslot').fill(descricaoEditada);
  await page.waitForTimeout(300);
  const [editarResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/lotes') && r.request().method() === 'PUT'),
    page.getByRole('button', { name: 'OK', exact: true }).click({ force: true }),
  ]);
  expect(editarResp.ok(), 'PUT /lotes/:id deveria retornar sucesso').toBeTruthy();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar lote..."]', descricaoEditada);
  const [buscaEditarResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/lotes') && new URL(r.url()).searchParams.get('busca') === descricaoEditada),
    page.keyboard.press('Enter'),
  ]);
  expect(buscaEditarResp.ok()).toBeTruthy();
  await page.waitForTimeout(500);
  await expect(page.locator('table tbody tr', { hasText: descricaoEditada })).toHaveCount(1);

  // ── Limpeza: exclui via API o lote e o leilão auxiliar ──────────────
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/lotes`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: descricaoEditada },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar o lote de teste para limpar').toBeGreaterThan(0);
  for (const l of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/lotes/${l.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  await request.delete(`${API_URL}/api/${BANCO}/leiloes/${idLeilaoAux}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
});
