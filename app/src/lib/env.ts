import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url().default('http://localhost:8899'),
  NEXT_PUBLIC_CYPHERCAST_PROGRAM_ID: z
    .string()
    .min(1, 'NEXT_PUBLIC_CYPHERCAST_PROGRAM_ID is required')
    .default('5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF'),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  NEXT_PUBLIC_CYPHERCAST_PROGRAM_ID: process.env.NEXT_PUBLIC_CYPHERCAST_PROGRAM_ID,
});

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
