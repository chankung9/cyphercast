import { Connection, clusterApiUrl } from '@solana/web3.js';
import { env } from '@/lib/env';

export function createConnection() {
  const endpoint = env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(endpoint, 'confirmed');
}
