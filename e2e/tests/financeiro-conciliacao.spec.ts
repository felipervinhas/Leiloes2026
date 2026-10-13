import { test, expect } from '@playwright/test';
import { API_URL, BANCO, CPF, SENHA, exigirCredenciais, login } from '../helpers';

/**
 * Área Financeiro (/:banco/financeiro): login próprio, cadastro de conta pela
 * importação de um extrato de conta nova, importação do OFX, lista de
 * lançamentos e recusa do mesmo arquivo enviado de novo.
 *
 * O extrato é fictício e gerado a cada execução (FITID e conta únicos), com
 * CPFs/CNPJ de teste — nada de extrato real de cliente no repositório.
 * Pré-requisito: a empresa de teste com o plano ligado
 * (UPDATE Configuracoes SET CONC_ATIVA = 'S') e o usuário de teste
 * administrador ou com o controle "Conciliação Bancária".
 */

test.beforeAll(() => {
  exigirCredenciais();
});

const execucao = Date.now().toString();
const ACCTID = `E2E${execucao}`;

function extratoFicticio(): Buffer {
  const lanc = (fitid: string, valor: string, memo: string) =>
    `<STMTTRN>\n<TRNTYPE>${valor.startsWith('-') ? 'DEBIT' : 'CREDIT'}</TRNTYPE>\n<DTPOSTED>20260923000000[-3:GMT]</DTPOSTED>\n` +
    `<TRNAMT>${valor}</TRNAMT>\n<FITID>${fitid}</FITID>\n<MEMO>${memo}</MEMO>\n</STMTTRN>\n`;
  const ofx =
    'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\n\n' +
    '<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>BRL</CURDEF>\n' +
    `<BANKACCTFROM>\n<BANKID>748</BANKID>\n<ACCTID>${ACCTID}</ACCTID>\n<ACCTTYPE>CHECKING</ACCTTYPE>\n</BANKACCTFROM>\n` +
    '<BANKTRANLIST>\n<DTSTART>20260923000000[-3:GMT]</DTSTART>\n<DTEND>20260923000000[-3:GMT]</DTEND>\n' +
    lanc(`${execucao}1`, '2450.00', `RECEBIMENTO PIX-PIX_CRED  52998224725 COMPRADOR TESTE ${execucao}`) +
    lanc(`${execucao}2`, '-750.00', `PAGAMENTO PIX-PIX_DEB   11222333000181 VENDEDOR TESTE ${execucao} LTDA`) +
    lanc(`${execucao}3`, '-5.15', 'TARIFA COM R LIQUIDACAO-COB000001 COB000001') +
    '</BANKTRANLIST>\n<LEDGERBAL>\n<BALAMT>1694.85</BALAMT>\n<DTASOF>20260923000000[-3:GMT]</DTASOF>\n</LEDGERBAL>\n' +
    '</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n';
  return Buffer.from(ofx, 'latin1');
}

test('Financeiro: importa extrato de conta nova e lista os lançamentos', async ({ page, request }) => {
  const token = await login(request);
  const status = await request.get(`${API_URL}/api/${BANCO}/conciliacao/status`, { headers: { Authorization: `Bearer ${token}` } });
  const st = await status.json();
  test.skip(!st.ativa, 'Plano de conciliação desligado na empresa de teste');
  test.skip(!st.acesso, 'Usuário de teste sem o controle "Conciliação Bancária"');

  await page.goto(`/${BANCO}/financeiro/login`);
  await expect(page.getByText('Financeiro · Conciliação bancária')).toBeVisible();
  await page.fill('input[placeholder="CPF"]', CPF!);
  await page.fill('input[placeholder="Senha"]', SENHA!);
  await page.click('button:has-text("Entrar")', { force: true });
  await page.waitForURL(`**/${BANCO}/financeiro/painel`);

  await page.getByRole('menuitem', { name: /Importar extrato/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: `extrato-${execucao}.ofx`, mimeType: 'application/x-ofx', buffer: extratoFicticio() });

  // conta ainda não cadastrada: o cadastro abre preenchido e, ao salvar, a importação segue
  const modal = page.locator('.ant-modal');
  await expect(modal.getByText('Nova conta bancária')).toBeVisible();
  await expect(modal.locator('#acctid')).toHaveValue(ACCTID);
  await modal.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByText('3 lançamentos novos importados')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('2 de 3')).toBeVisible(); // com CPF/CNPJ

  // o mesmo arquivo de novo é recusado
  await page.locator('input[type="file"]').setInputFiles({ name: `extrato-${execucao}.ofx`, mimeType: 'application/x-ofx', buffer: extratoFicticio() });
  await expect(page.getByText(/Este arquivo já foi importado/)).toBeVisible();

  await page.getByRole('button', { name: 'Ver lançamentos' }).click();
  await page.waitForURL(`**/${BANCO}/financeiro/lancamentos`);
  await page.locator('input[placeholder="Nome, CPF/CNPJ ou histórico"]').fill(`TESTE ${execucao}`);
  await page.keyboard.press('Enter');
  // cada execução tem nomes próprios — lançamentos de execuções anteriores não atrapalham
  await expect(page.getByText(`COMPRADOR TESTE ${execucao}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`VENDEDOR TESTE ${execucao} LTDA`)).toBeVisible();
  await expect(page.locator('.ant-table-row')).toHaveCount(2);
  await expect(page.getByText('529.982.247-25')).toBeVisible();
});
