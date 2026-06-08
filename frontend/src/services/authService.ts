import api from './api';
import { LoginResponse } from '../types/auth';

export async function loginApi(email: string, senha: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, senha });
  return data;
}
