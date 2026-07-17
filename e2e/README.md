# E2E — Leilões 2026

Testes end-to-end rodados com Playwright contra o banco de teste `MacedoBkp`
(backup, não é produção). **Não rode em CI/loop automático**: cada execução
lança uma venda de verdade e consome 1 lote disponível do leilão escolhido no
banco de teste.

## Pré-requisitos

1. Backend rodando em `http://localhost:8500` (`cd backend && npm run dev`).
2. Frontend rodando em `http://localhost:3000` (`cd frontend && npm start`).
3. O tenant `MacedoBkp` precisa estar liberado em:
   - `backend/src/config/database.ts` → `BANCOS_PERMITIDOS`
   - `frontend/src/config/bancos.ts` → `BANCOS_PERMITIDOS`
4. Um usuário de teste válido no banco `MacedoBkp`.

## Configuração

```bash
cd e2e
npm install
npm run install-browsers   # baixa o Chromium do Playwright (uma vez)
cp .env.example .env       # preencha E2E_CPF e E2E_SENHA
```

## Rodar

```bash
npm test            # headless
npm run test:headed # com navegador visível, útil para debugar
```

Relatório HTML fica em `e2e/playwright-report/` após a execução.

## O que os testes cobrem

- `tests/rateio-impressao.spec.ts` — reproduz o bug de duplicação/triplicação
  na impressão selecionada da Consulta de Vendas: quando um lote é rateado
  entre vários compradores, a consulta retorna uma linha por comprador com o
  mesmo `MOVIMENTO.ID`. O teste lança uma venda com um lote rateado 50/50
  entre dois compradores de teste, depois confirma que marcar a linha de um
  comprador na Consulta de Vendas não marca a do outro, e que o PDF impresso
  traz só o comprador selecionado. **Consome 1 lote por execução** — rode só
  manualmente.
- `tests/cadastro-clientes.spec.ts` — Cadastro de Clientes (pessoas) de ponta
  a ponta: cria uma pessoa preenchendo campos das abas Pessoal (nome, CPF,
  RG, data nasc., estado civil, e-mail, profissão, empresa), Endereço
  (endereço, complemento, bairro, cidade — sem usar a busca de CEP, que
  chama o ViaCEP de verdade), Contatos (telefones e referência) e Bancário
  (banco, agência, conta, PIX). Confirma que todos esses valores persistem
  ao reabrir para edição, edita o nome, confirma a alteração na listagem e
  por fim **exclui o próprio registro criado** via API — pode rodar quantas
  vezes quiser sem acumular lixo no banco.

## Helpers compartilhados

`helpers.ts` centraliza login (via API e via UI) e um utilitário para
selecionar opções em campos AntD `Select` digitando + Enter (mais estável em
modo headless do que clicar na opção da lista, que às vezes fica coberta pelo
overlay de erro do webpack-dev-server).
