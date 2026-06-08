import { AsyncLocalStorage } from 'async_hooks';

export const bancoStorage = new AsyncLocalStorage<string>();

export const getBanco = (): string => bancoStorage.getStore() ?? process.env.DB_DATABASE ?? 'MacedoLeiloes';
