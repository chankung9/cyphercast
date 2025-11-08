import { PublicKey } from '@solana/web3.js';
import { env } from '@/lib/env';

export const CYPHERCAST_PROGRAM_ID = new PublicKey(env.NEXT_PUBLIC_CYPHERCAST_PROGRAM_ID);
