'use client';

import { PropsWithChildren, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  UnsafeBurnerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { DEFAULT_COMMITMENT, SOLANA_RPC_ENDPOINT } from '@/lib/solana/connection';

export function AppWalletProvider({ children }: PropsWithChildren) {
  const endpoint = SOLANA_RPC_ENDPOINT;

  const wallets = useMemo(() => {
    const adapters: (
      PhantomWalletAdapter | 
      SolflareWalletAdapter | 
      UnsafeBurnerWalletAdapter
    )[] = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
    if (process.env.NODE_ENV !== 'production') {
      adapters.push(new UnsafeBurnerWalletAdapter());
    }
    return adapters;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: DEFAULT_COMMITMENT }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
