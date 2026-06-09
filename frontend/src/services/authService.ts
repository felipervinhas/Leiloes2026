import api from './api';
import { LoginResponse } from '../types/auth';

export async function loginApi(cpf: string, senha: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { cpf, senha });
  return data;
}
