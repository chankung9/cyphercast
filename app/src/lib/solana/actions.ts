import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import { createConnection, DEFAULT_COMMITMENT } from './connection';
import { CYPHERCAST_PROGRAM_ID } from './constants';

export type JoinStreamParams = {
  stream: string;
  viewer: PublicKey;
};

/**
 * Builds a placeholder transaction that mimics calling the Anchor `join_stream` instruction.
 * Replace the instruction layout with the actual IDL encoder once migrations begin.
 */
export async function buildJoinStreamTransaction(
  { stream, viewer }: JoinStreamParams,
  connection?: Connection,
) {
  const conn = connection ?? createConnection();
  let streamKey: PublicKey;
  try {
    streamKey = new PublicKey(stream);
  } catch (err) {
    throw new Error(
      `Invalid stream public key string provided: "${stream}". Error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const instruction = new TransactionInstruction({
    programId: CYPHERCAST_PROGRAM_ID,
    keys: [
      { pubkey: streamKey, isSigner: false, isWritable: true },
      { pubkey: viewer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  });

  const tx = new Transaction().add(instruction);
  tx.feePayer = viewer;
  const { blockhash } = await conn.getLatestBlockhash(DEFAULT_COMMITMENT);
  tx.recentBlockhash = blockhash;
  return tx;
}
