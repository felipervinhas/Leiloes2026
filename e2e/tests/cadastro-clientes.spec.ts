import { test, expect } from '@playwright/test';
import {
  API_URL,
  BANCO,
  exigirCredenciais,
  login,
  loginUI,
  selecionarPrimeiraOpcao,
} from '../helpers';

/**
 * Cobre o cadastro de pessoas (Clientes) de ponta a ponta, preenchendo
 * campos das quatro abas principais do formulário (Pessoal, Endereço,
 * Contatos, Bancário) — não só nome/e-mail. Cria, confirma que os valores
 * persistem ao reabrir para edição, edita o nome e por fim exclui o próprio
 * registro criado via API, então pode rodar quantas vezes quiser sem
 * acumular lixo no banco de teste.
 *
 * Fora do escopo: CEP (dispara busca real no ViaCEP) e as abas
 * Propriedades/Ocorrências/Sistema/Documentos/Permissões/Histórico, que só
 * existem editando um cliente já salvo ou são administrativas, não dados
 * de cadastro da pessoa em si.
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const drawer = (page: import('@playwright/test').Page) => page.locator('.ant-drawer-body');

async function abrirAba(page: import('@playwright/test').Page, nome: string) {
  await drawer(page).getByRole('tab', { name: nome }).click({ force: true });
  await page.waitForTimeout(300);
}

test('cadastro de clientes: criar com dados completos, confirmar persistência, editar e excluir', async ({
  page,
  request,
}) => {
  const sufixo = Date.now();
  const nomeUnico = `E2E TESTE ${sufixo}`;
  const nomeEditado = `${nomeUnico} EDITADO`;
  const cpfTeste = `999.${String(sufixo).slice(-3)}.${String(sufixo).slice(0, 3)}-00`;
  const emailTeste = `e2e.${sufixo}@teste.invalido`;

  await loginUI(page);
  await page.goto(`/${BANCO}/clientes`);

  // ── Criar ────────────────────────────────────────────────────────────
  await page.click('button:has-text("Novo Cliente")', { force: true });
  await page.waitForTimeout(800);
  await expect(page.locator('text=Novo Cliente').first()).toBeVisible();

  // Aba Pessoal
  await drawer(page).locator('#nomexx').fill(nomeUnico);
  await drawer(page).locator('#cpfxxx').fill(cpfTeste);
  await drawer(page).locator('#rgxxxx').fill('1234567890');
  await drawer(page).locator('#datnas').fill('01/01/1990');
  await page.keyboard.press('Escape'); // fecha o calendário do DatePicker
  await selecionarPrimeiraOpcao(page, '#estciv');
  await drawer(page).locator('#emailx').fill(emailTeste);
  await drawer(page).locator('#profiss').fill('Testador(a) QA');
  await drawer(page).locator('#empres').fill('Empresa Teste E2E');

  // Aba Endereço (sem usar a busca de CEP, que chama o ViaCEP de verdade)
  await abrirAba(page, 'Endereço');
  await drawer(page).locator('#endere').fill('Rua Teste E2E, 123');
  await drawer(page).locator('#comple').fill('Apto 1');
  await drawer(page).locator('#bairro').fill('Bairro Teste');
  await selecionarPrimeiraOpcao(page, '#cidade');

  // Aba Contatos
  await abrirAba(page, 'Contatos');
  await drawer(page).locator('#telres').fill('(11) 1111-1111');
  await drawer(page).locator('#celu1').fill('(11) 91111-1111');
  await drawer(page).locator('#refer1').fill('Referência Teste');
  await drawer(page).locator('#telrefere1').fill('(11) 2222-2222');

  // Aba Bancário
  await abrirAba(page, 'Bancário');
  await drawer(page).locator('#bancox').fill('Banco Teste');
  await drawer(page).locator('#agenci').fill('0001');
  await drawer(page).locator('#contax').fill('123456-7');
  await drawer(page).locator('#pix').fill('teste@pix.invalido');

  await page.click('button:has-text("Salvar")', { force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  // ── Confirmar na listagem ────────────────────────────────────────────
  await page.fill('input[placeholder="Buscar..."]', nomeUnico);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  const linhaCriada = page.locator('table tbody tr', { hasText: nomeUnico });
  await expect(linhaCriada).toHaveCount(1);

  // ── Reabrir e confirmar que os campos das 4 abas persistiram ────────
  await linhaCriada.locator('button:has(.anticon-edit)').click({ force: true });
  await page.waitForTimeout(800);

  await expect(drawer(page).locator('#nomexx')).toHaveValue(nomeUnico);
  await expect(drawer(page).locator('#cpfxxx')).toHaveValue(cpfTeste);
  await expect(drawer(page).locator('#emailx')).toHaveValue(emailTeste);

  await abrirAba(page, 'Endereço');
  await expect(drawer(page).locator('#endere')).toHaveValue('Rua Teste E2E, 123');
  await expect(drawer(page).locator('#bairro')).toHaveValue('Bairro Teste');

  await abrirAba(page, 'Contatos');
  await expect(drawer(page).locator('#telres')).toHaveValue('(11) 1111-1111');
  await expect(drawer(page).locator('#celu1')).toHaveValue('(11) 91111-1111');

  await abrirAba(page, 'Bancário');
  await expect(drawer(page).locator('#bancox')).toHaveValue('Banco Teste');
  await expect(drawer(page).locator('#pix')).toHaveValue('teste@pix.invalido');

  // ── Editar o nome e confirmar a alteração ───────────────────────────
  await abrirAba(page, 'Pessoal');
  await drawer(page).locator('#nomexx').fill(nomeEditado);
  await page.click('button:has-text("Salvar")', { force: true });
  await expect(page.locator('text=Salvo com sucesso')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="Buscar..."]', nomeEditado);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await expect(page.locator('table tbody tr', { hasText: nomeEditado })).toHaveCount(1);

  // ── Limpeza: exclui via API o cliente criado neste teste ────────────
  const token = await login(request);
  const buscaRes = await request.get(`${API_URL}/api/${BANCO}/clientes`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { busca: nomeEditado, filtro: 'nome' },
  });
  const encontrados = await buscaRes.json();
  expect(encontrados.length, 'deveria achar o cliente de teste para limpar').toBeGreaterThan(0);
  for (const c of encontrados) {
    await request.delete(`${API_URL}/api/${BANCO}/clientes/${c.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
