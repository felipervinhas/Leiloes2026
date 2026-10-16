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

  // conciliação manual: o débito sem cliente vira "não é venda" e depois é desfeito
  await page.getByText(`VENDEDOR TESTE ${execucao} LTDA`).click();
  const drawer = page.locator('.ant-drawer');
  await expect(drawer.getByText('Conciliar lançamento')).toBeVisible();
  await expect(drawer.getByText('Escolha o cliente para ver o que está em aberto')).toBeVisible();
  await drawer.getByRole('button', { name: /Não é venda/ }).click();
  const modalNv = page.locator('.ant-modal').filter({ hasText: 'Nas próximas importações' });
  await modalNv.getByText('Só este lançamento').click();
  await modalNv.getByRole('button', { name: 'Marcar' }).click();
  await expect(drawer.getByText('Marcado como não é venda')).toBeVisible();
  await drawer.getByRole('button', { name: 'Desfazer' }).click();
  await expect(drawer.getByText('Escolha o cliente para ver o que está em aberto')).toBeVisible();

  // o mesmo débito como despesa da empresa, e ele aparece no relatório de despesas
  await drawer.getByRole('button', { name: /Despesa da empresa/ }).click();
  const modalDe = page.locator('.ant-modal').filter({ hasText: 'Fornecedor' });
  await modalDe.locator('.ant-select').first().click();
  await page.keyboard.type('Outras', { delay: 20 });
  await page.keyboard.press('Enter');
  await modalDe.getByText(/Da próxima vez/).click(); // sem regra aprendida para o teste
  await modalDe.getByRole('button', { name: 'Registrar' }).click();
  await expect(drawer.getByText('Despesa da empresa: Outras despesas')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('menuitem', { name: /Despesas da empresa/ }).click();
  await expect(page.locator('.ant-table-row').filter({ hasText: `VENDEDOR TESTE ${execucao} LTDA` }).first()).toBeVisible({ timeout: 15_000 });

  // relatórios abrem (sem depender de vendas do banco de teste)
  await page.getByRole('menuitem', { name: /Pendências/ }).click();
  await expect(page.getByText('Vencido e não recebido')).toBeVisible();
  await expect(page.getByText('Sem cliente identificado')).toBeVisible();
  await page.getByRole('menuitem', { name: /Repasses/ }).click();
  await expect(page.getByText(/Saldo a repassar = recebido/)).toBeVisible();
  await page.getByRole('menuitem', { name: /Recebimentos/ }).click();
  await expect(page.getByText('Escolha o leilão')).toBeVisible();

  // configurações: a prévia mostra quais parcelas passam pela leiloeira em cada condição
  await page.getByRole('menuitem', { name: /Configurações/ }).click();
  await expect(page.getByRole('tab', { name: 'Parcelas por condição' })).toBeVisible();
  // uma linha da tabela (o texto de ajuda do topo também cita "parcelas até a 04")
  await expect(page.locator('.ant-table-row').filter({ hasText: /parcelas até a \d{2}|Só a 1ª parcela/ }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'Não é venda' }).click();
  await page.getByRole('tab', { name: 'Pagadores conhecidos' }).click();
});
