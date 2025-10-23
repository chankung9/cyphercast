import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import type { Cyphercast } from "./idl/cyphercast";
import idl from "./idl/cyphercast.json";

// Program ID from lib.rs
const PROGRAM_ID = new PublicKey(
  "5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF",
);

export class CypherCastClient {
  connection: Connection;
  provider: AnchorProvider;
  program: Program<Cyphercast>;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    // Note: You'll need to load the IDL from the deployed program or use the generated types
    this.program = new Program(
      idl as Cyphercast,
      PROGRAM_ID,
      this.provider,
    ) as Program<Cyphercast>;
  }

  // Helper function to derive stream PDA
  getStreamPDA(creator: PublicKey, streamId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.toBuffer(),
        new anchor.BN(streamId).toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId,
    );
  }

  // Helper function to derive participant PDA
  getParticipantPDA(stream: PublicKey, viewer: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("participant"), stream.toBuffer(), viewer.toBuffer()],
      this.program.programId,
    );
  }

  // Helper function to derive prediction PDA
  getPredictionPDA(stream: PublicKey, viewer: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("prediction"), stream.toBuffer(), viewer.toBuffer()],
      this.program.programId,
    );
  }

  async createStream(
    streamId: number,
    title: string,
    startTime: number,
    lockOffsetSecs = 3600,
    tipBps = 300,
    precision = 6,
    gracePeriodSecs = 600,
  ): Promise<PublicKey> {
    const creator = this.provider.wallet.publicKey;
    const [streamPDA] = this.getStreamPDA(creator, streamId);

    await this.program.methods
      .createStream(
        new anchor.BN(streamId),
        title,
        new anchor.BN(startTime),
        new anchor.BN(lockOffsetSecs),
        tipBps,
        precision,
        new anchor.BN(gracePeriodSecs),
      )
      .accounts({
        stream: streamPDA,
        creator: creator,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Stream created:", streamPDA.toBase58());
    return streamPDA;
  }

  async joinStream(
    streamPDA: PublicKey,
    stakeAmount: number,
  ): Promise<PublicKey> {
    const viewer = this.provider.wallet.publicKey;
    const [participantPDA] = this.getParticipantPDA(streamPDA, viewer);

    await this.program.methods
      .joinStream(new anchor.BN(stakeAmount))
      .accounts({
        stream: streamPDA,
        participant: participantPDA,
        viewer: viewer,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Joined stream:", streamPDA.toBase58());
    return participantPDA;
  }

  async submitPrediction(
    streamPDA: PublicKey,
    choice: number,
    stakeAmount: number,
  ): Promise<PublicKey> {
    const viewer = this.provider.wallet.publicKey;
    const [predictionPDA] = this.getPredictionPDA(streamPDA, viewer);

    await this.program.methods
      .submitPrediction(choice, new anchor.BN(stakeAmount))
      .accounts({
        stream: streamPDA,
        prediction: predictionPDA,
        viewer: viewer,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Prediction submitted:", predictionPDA.toBase58());
    return predictionPDA;
  }

  async endStream(streamPDA: PublicKey): Promise<void> {
    const creator = this.provider.wallet.publicKey;

    await this.program.methods
      .endStream()
      .accounts({
        stream: streamPDA,
        creator: creator,
      })
      .rpc();

    console.log("Stream ended:", streamPDA.toBase58());
  }

  async claimReward(predictionPDA: PublicKey): Promise<void> {
    const viewer = this.provider.wallet.publicKey;

    await this.program.methods
      .claimReward()
      .accounts({
        prediction: predictionPDA,
        viewer: viewer,
      })
      .rpc();

    console.log("Reward claimed for prediction:", predictionPDA.toBase58());
  }

  // Fetch account data
  async getStream(streamPDA: PublicKey) {
    return await this.program.account.stream.fetch(streamPDA);
  }

  async getParticipant(participantPDA: PublicKey) {
    return await this.program.account.participant.fetch(participantPDA);
  }

  async getPrediction(predictionPDA: PublicKey) {
    return await this.program.account.prediction.fetch(predictionPDA);
  }

  // Get all streams (you might want to add indexing for production)
  async getAllStreams() {
    return await this.program.account.stream.all();
  }
}

// Example usage
export async function initializeClient(
  connection: Connection,
  wallet: any,
): Promise<CypherCastClient> {
  return new CypherCastClient(connection, wallet);
}

// Demo functions for testing
export async function createStreamExample(client: CypherCastClient) {
  const streamId = Math.floor(Math.random() * 1000000);
  const title = "My Demo Stream";
  const startTime = Math.floor(Date.now() / 1000);

  return await client.createStream(streamId, title, startTime);
}

export async function joinStreamExample(
  client: CypherCastClient,
  streamPDA: PublicKey,
) {
  const stakeAmount = 1000000; // 0.001 SOL in lamports
  return await client.joinStream(streamPDA, stakeAmount);
}
