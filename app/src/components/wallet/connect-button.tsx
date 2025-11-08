'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function ConnectWalletButton() {
  return (
    <WalletMultiButton className="rounded-full border border-border px-4 py-2 text-sm font-medium shadow-sm" />
  );
}
