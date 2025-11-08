import { Commitment, Connection, clusterApiUrl } from '@solana/web3.js';
import { env } from '@/lib/env';

export const SOLANA_RPC_ENDPOINT = env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');
export const DEFAULT_COMMITMENT: Commitment = 'confirmed';

export function createConnection() {
  return new Connection(SOLANA_RPC_ENDPOINT, DEFAULT_COMMITMENT);
}
