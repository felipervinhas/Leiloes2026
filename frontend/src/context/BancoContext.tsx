import React, { createContext, useContext, useEffect, ReactNode } from 'react';

interface BancoContextData {
  banco: string;
}

const BancoContext = createContext<BancoContextData>({ banco: '' });

export function BancoProvider({ banco, children }: { banco: string; children: ReactNode }) {
  useEffect(() => {
    localStorage.setItem('@leiloes:banco', banco);
  }, [banco]);

  return (
    <BancoContext.Provider value={{ banco }}>
      {children}
    </BancoContext.Provider>
  );
}

export function useBanco() {
  return useContext(BancoContext);
}
