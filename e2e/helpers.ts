import { APIRequestContext, Page, expect } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: __dirname + '/.env' });

export const API_URL = process.env.E2E_API_URL || 'http://localhost:8500';
export const BANCO = process.env.E2E_BANCO || 'MacedoBkp';
export const CPF = process.env.E2E_CPF;
export const SENHA = process.env.E2E_SENHA;

export function exigirCredenciais() {
  if (!CPF || !SENHA) {
    throw new Error(
      'E2E_CPF / E2E_SENHA não configurados. Copie e2e/.env.example para e2e/.env e preencha um usuário de teste.'
    );
  }
}

export async function login(request: APIRequestContext) {
  const res = await request.post(`${API_URL}/api/${BANCO}/auth/login`, {
    data: { cpf: CPF, senha: SENHA },
  });
  expect(res.ok(), 'login via API deveria retornar 200').toBeTruthy();
  const { token } = await res.json();
  return token as string;
}

export async function loginUI(page: Page) {
  await page.goto(`/${BANCO}/login`);
  await page.fill('input[placeholder="CPF"]', CPF!);
  await page.fill('input[placeholder="Senha"]', SENHA!);
  await page.click('button:has-text("Entrar")', { force: true });
  await page.waitForURL(`**/${BANCO}/dashboard`);
}

/**
 * Abre um Select do AntD (showSearch), digita um texto e confirma com Enter
 * — mais robusto que clicar na opção da lista, que às vezes fica coberta
 * pelo overlay de erro do webpack-dev-server em modo headless. Espera a
 * opção realmente aparecer (busca costuma ser debounced/assíncrona) em vez
 * de um tempo fixo, que sob carga (várias abas Select em sequência) às
 * vezes não é suficiente e faz o Enter cair no vazio.
 */
export async function selecionarPorDigitacao(page: Page, seletor: string, texto: string) {
  const el = page.locator(seletor);
  await el.click({ force: true });
  await el.pressSequentially(texto, { delay: 30 });
  // Dropdowns já fechados deixam suas opções ocultas no DOM (portal no fim do
  // <body>, não desmontado) — filtramos só as visíveis, senão .first() pode
  // pegar a opção de um Select anterior que já fechou.
  await page.locator('.ant-select-item-option-content:visible').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

/**
 * Abre um Select do AntD (com ou sem showSearch) e confirma a primeira
 * opção da lista via teclado — útil quando não importa qual valor exato é
 * escolhido (ex.: Estado Civil, Cidade), só que o campo fique preenchido.
 */
export async function selecionarPrimeiraOpcao(page: Page, seletor: string) {
  await page.locator(seletor).click({ force: true });
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}
