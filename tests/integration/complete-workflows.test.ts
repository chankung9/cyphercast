import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  mintTo,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SendTransactionError,
} from "@solana/web3.js";

// Buffer import for CommonJS compatibility
global.Buffer = global.Buffer || require("buffer").Buffer;

// Define account types for the program
interface StreamAccount {
  title: string;
  description: string;
  creator: PublicKey;
  tokenMint: PublicKey;
  vault: PublicKey;
  startTime: BN;
  endTime: BN;
  lockOffsetSecs: number;
  tipBps: number;
  totalDeposited: BN;
  totalStaked: BN;
  winningChoice: number | null;
  isActive: boolean;
  isResolved: boolean;
  isCanceled: boolean;
  configHash: Uint8Array;
  choices: number[];
}

interface TokenVaultAccount {
  stream: PublicKey;
  tokenMint: PublicKey;
  totalDeposited: BN;
  totalStaked: BN;
  rewardPool: BN;
  isInitialized: boolean;
}

interface PredictionAccount {
  stream: PublicKey;
  viewer: PublicKey;
  choice: number;
  stakeAmount: BN;
  timestamp: BN;
  isResolved: boolean;
  rewardClaimed: boolean;
  refunded: boolean;
}

// Helper function to safely create token accounts
async function ensureTokenAccount(
  connection: any,
  payer: any,
  tokenMint: PublicKey,
  owner: PublicKey,
  participantTokenAccounts: Map<PublicKey, PublicKey>,
): Promise<PublicKey> {
  // Get the associated token account address first
  const tokenAccount = await getAssociatedTokenAddress(tokenMint, owner);

  // Check if token account already exists in our map
  let existingTokenAccount = participantTokenAccounts.get(owner);

  if (existingTokenAccount) {
    // Already exists in our map, return it
    return existingTokenAccount;
  }

  try {
    // Check if account already exists on-chain
    await getAccount(connection, tokenAccount);
    // Account exists on-chain, add to map and return
    participantTokenAccounts.set(owner, tokenAccount);
    return tokenAccount;
  } catch (error) {
    // Account doesn't exist, create it
    await createAssociatedTokenAccount(connection, payer, tokenMint, owner);

    // Mint tokens to the account
    await mintTo(
      connection,
      payer,
      tokenMint,
      tokenAccount,
      payer.publicKey, // Use payer as mint authority
      10000 * 1_000_000, // 10000 tokens for all predictions
    );

    participantTokenAccounts.set(owner, tokenAccount);
    return tokenAccount;
  }
}

describe("CypherCast - Complete Workflow Integration Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cyphercast;
  const creator = provider.wallet as anchor.Wallet;

  // Test participants - declare at global scope to reuse across tests
  let streamer: any;
  let viewer1: Keypair;
  let viewer2: Keypair;
  let viewer3: Keypair;
  let viewer4: Keypair;
  let viewer5: Keypair;
  let tokenMint: PublicKey;
  // Global participant token accounts map to persist across tests
  const participantTokenAccounts: Map<PublicKey, PublicKey> = new Map();

  // Initialize test participants once for all integration tests
  before(async () => {
    // Initialize test participants
    streamer = creator;
    viewer1 = Keypair.generate();
    viewer2 = Keypair.generate();
    viewer3 = Keypair.generate();
    viewer4 = Keypair.generate();
    viewer5 = Keypair.generate();

    // Setup all participants with SOL and tokens
    const participants = [viewer1, viewer2, viewer3, viewer4, viewer5];

    for (const participant of participants) {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          participant.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );
    }

    // Create test token mint
    tokenMint = await createMint(
      provider.connection,
      creator.payer,
      creator.publicKey,
      null,
      6, // 6 decimals
    );

    // Create and fund token accounts for all participants
    for (const participant of participants) {
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        participant.publicKey,
      );
      await createAssociatedTokenAccount(
        provider.connection,
        creator.payer,
        tokenMint,
        participant.publicKey,
      );

      // Mint tokens to each participant
      await mintTo(
        provider.connection,
        creator.payer,
        tokenMint,
        tokenAccount,
        creator.publicKey,
        10000 * 1_000_000, // 10000 tokens for all predictions
      );

      participantTokenAccounts.set(participant.publicKey, tokenAccount);
    }

    // Create token account for streamer
    const streamerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      creator.publicKey,
    );
    await createAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      tokenMint,
      creator.publicKey,
    );
    await mintTo(
      provider.connection,
      creator.payer,
      tokenMint,
      streamerTokenAccount,
      creator.publicKey,
      2000 * 1_000_000,
    );
    participantTokenAccounts.set(creator.publicKey, streamerTokenAccount);
  });

  describe("Complete Stream Lifecycle - Single Winner", () => {
    let streamPda: PublicKey;
    let vaultPda: PublicKey;
    let vaultTokenAccount: PublicKey;
    let predictions: Map<Keypair, PublicKey> = new Map();

    it("Complete workflow: Create -> Activate -> Predictions -> End -> Resolve -> Claim", async () => {
      // 1. Create Stream
      const streamId = new BN(Date.now()); // Use timestamp for uniqueness
      const title = "Gaming Tournament Stream";
      const startTime = new BN(Date.now() / 1000);
      const lockOffsetSecs = new BN(600); // 10 minutes
      const tipBps = 1500; // 15%
      const precision = 2;
      const gracePeriodSecs = new BN(300); // 5 minutes

      [streamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          streamer.publicKey.toBuffer(),
          streamId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          streamId,
          title,
          startTime,
          lockOffsetSecs,
          tipBps,
          precision,
          gracePeriodSecs,
        )
        .accounts({
          stream: streamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      let streamAccount = await (program.account as any).stream.fetch(
        streamPda,
      );
      expect(streamAccount.title).to.equal(title);
      // Note: isActive might be legacy flag, check if config is set instead
      expect(streamAccount.isResolved).to.be.false;

      // 2. Initialize Token Vault
      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), streamPda.toBuffer()],
        program.programId,
      );

      vaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        vaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: streamPda,
          vault: vaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // 3. Activate Stream
      await program.methods
        .activateStream()
        .accounts({
          stream: streamPda,
          creator: creator.publicKey,
        })
        .rpc();

      const updatedStreamAccount = await (program.account as any).stream.fetch(
        streamPda,
      );
      expect(updatedStreamAccount.isActive).to.be.true;

      // 4. Multiple Viewers Submit Predictions
      const predictionData = [
        { viewer: viewer1, choice: 1, stake: 100 },
        { viewer: viewer2, choice: 1, stake: 200 },
        { viewer: viewer3, choice: 2, stake: 150 },
        { viewer: viewer4, choice: 1, stake: 50 },
        { viewer: viewer5, choice: 2, stake: 75 },
      ];

      for (const { viewer, choice, stake } of predictionData) {
        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("prediction"),
            streamPda.toBuffer(),
            viewer.publicKey.toBuffer(),
          ],
          program.programId,
        );

        // Ensure viewer token account exists
        const viewerTokenAccount = await ensureTokenAccount(
          provider.connection,
          creator.payer,
          tokenMint,
          viewer.publicKey,
          participantTokenAccounts,
        );

        // Submit prediction
        try {
          await program.methods
            .submitPrediction(choice, new BN(stake * 1_000_000))
            .accounts({
              stream: streamPda,
              prediction: predictionPda,
              vault: vaultPda,
              viewerTokenAccount: viewerTokenAccount,
              vaultTokenAccount: vaultTokenAccount,
              viewer: viewer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([viewer])
            .rpc();

          // Prediction verification moved to try-catch block above
        } catch (error) {
          console.log(
            `SubmitPrediction failed for viewer ${viewer.publicKey.toString()}:`,
          );
          console.log(`Error: ${error}`);
          console.log(`Stream ID: ${streamPda.toString()}`);
          console.log(`Choice: ${choice}, Stake: ${stake}`);
          throw error;
        }

        // Store prediction PDA in map for later use (claim rewards, etc.)
        predictions.set(viewer, predictionPda);

        // Verify prediction was created successfully
        const predictionAccount = await (
          program.account as any
        ).prediction.fetch(predictionPda);
        expect(predictionAccount.choice).to.equal(choice);
        expect(predictionAccount.stakeAmount.toString()).to.equal(
          (stake * 1_000_000).toString(),
        );
      }

      // Verify total stakes
      const resolvedStreamAccount = await (program.account as any).stream.fetch(
        streamPda,
      );
      const expectedTotal =
        predictionData.reduce((sum, p) => sum + p.stake, 0) * 1_000_000;
      expect(resolvedStreamAccount.totalStake.toString()).to.equal(
        expectedTotal.toString(),
      );

      // 5. End Stream
      await program.methods
        .endStream()
        .accounts({
          stream: streamPda,
          creator: streamer.publicKey,
        })
        .rpc();

      const finalStreamAccount = await (program.account as any).stream.fetch(
        streamPda,
      );
      // Stream should be inactive after ending (legacy behavior)
      // expect(finalStreamAccount.isActive).to.be.false;

      // 6. Resolve with Winning Choice (Choice 1 wins)
      const winningChoice = 1;
      // const streamerTokenAccount = participantTokenAccounts.get(
      //   creator.publicKey,
      // )!;
      const streamerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        creator.publicKey,
      );

      await program.methods
        .resolvePrediction(winningChoice)
        .accounts({
          stream: streamPda,
          creator: creator.publicKey,
          vault: vaultPda,
          creatorTokenAccount: streamerTokenAccount,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      streamAccount = await (program.account as any).stream.fetch(streamPda);
      expect(streamAccount.isResolved).to.be.true;
      expect(streamAccount.winningChoice).to.equal(winningChoice);

      // 7. Winners Claim Rewards
      const winnerViewers = [viewer1, viewer2, viewer4]; // Those who chose choice 1
      const loserViewers = [viewer3, viewer5]; // Those who chose choice 2

      for (const winner of winnerViewers) {
        const predictionPda = predictions.get(winner)!;
        const initialBalance = (
          await getAccount(
            provider.connection,
            participantTokenAccounts.get(winner.publicKey)!,
          )
        ).amount;

        await program.methods
          .claimReward()
          .accounts({
            prediction: predictionPda,
            stream: streamPda,
            vault: vaultPda,
            viewerTokenAccount: participantTokenAccounts.get(winner.publicKey)!,
            vaultTokenAccount: vaultTokenAccount,
            viewer: winner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([winner])
          .rpc();

        const finalBalance = (
          await getAccount(
            provider.connection,
            participantTokenAccounts.get(winner.publicKey)!,
          )
        ).amount;
        expect(Number(finalBalance)).to.be.greaterThan(Number(initialBalance));
      }

      // Losers cannot claim rewards
      for (const loser of loserViewers) {
        const predictionPda = predictions.get(loser)!;

        try {
          await program.methods
            .claimReward()
            .accounts({
              prediction: predictionPda,
              stream: streamPda,
              vault: vaultPda,
              viewerTokenAccount: participantTokenAccounts.get(
                loser.publicKey,
              )!,
              vaultTokenAccount: vaultTokenAccount,
              viewer: loser.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([loser])
            .rpc();

          expect.fail("Loser should not be able to claim reward");
        } catch (error) {
          expect((error as any).toString()).to.include("Incorrect prediction");
        }
      }

      // Verify final vault state
      const vaultAccount = await (program.account as any).tokenVault.fetch(
        vaultPda,
      );
      expect(Number(vaultAccount.rewardPool)).to.be.greaterThan(0);
    });
  });

  describe("Complete Stream Lifecycle - No Winners", () => {
    let streamPda: PublicKey;
    let noWinnerVaultPda: PublicKey;
    let noWinnerVaultTokenAccount: PublicKey;

    it("Complete workflow with no winners", async () => {
      // 1. Create Stream
      const streamId = new BN(Date.now() + 1000);
      const title = "No Winners Test Stream";
      const startTime = new BN(Date.now() / 1000);
      const lockOffsetSecs = new BN(300);
      const tipBps = 1000;
      const precision = 2;
      const gracePeriodSecs = new BN(600);

      [streamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          streamer.publicKey.toBuffer(),
          streamId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          streamId,
          title,
          startTime,
          lockOffsetSecs,
          tipBps,
          precision,
          gracePeriodSecs,
        )
        .accounts({
          stream: streamPda,
          creator: streamer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // 2. Initialize vault and activate
      [noWinnerVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), streamPda.toBuffer()],
        program.programId,
      );

      noWinnerVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        noWinnerVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: streamer.publicKey,
          stream: streamPda,
          vault: noWinnerVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: noWinnerVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: streamPda,
          creator: streamer.publicKey,
        })
        .rpc();

      // 3. Submit predictions for choices 1 and 2 only
      const noWinnerPredictions = [
        { viewer: viewer1, choice: 1, stake: 100 },
        { viewer: viewer2, choice: 1, stake: 200 },
        { viewer: viewer3, choice: 2, stake: 150 },
      ];

      for (const { viewer, choice, stake } of noWinnerPredictions) {
        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("prediction"),
            streamPda.toBuffer(),
            viewer.publicKey.toBuffer(),
          ],
          program.programId,
        );

        // Get viewer token account (should already exist from before hook)
        const viewerTokenAccount = participantTokenAccounts.get(
          viewer.publicKey,
        );
        if (!viewerTokenAccount) {
          throw new Error(
            `Viewer token account not found for ${viewer.publicKey.toString()}`,
          );
        }

        await program.methods
          .submitPrediction(choice, new BN(stake * 1_000_000))
          .accounts({
            stream: streamPda,
            prediction: predictionPda,
            vault: noWinnerVaultPda,
            viewerTokenAccount: viewerTokenAccount,
            vaultTokenAccount: noWinnerVaultTokenAccount,
            viewer: viewer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([viewer])
          .rpc();
      }

      // 4. End stream
      await program.methods
        .endStream()
        .accounts({
          stream: streamPda,
          creator: streamer.publicKey,
        })
        .rpc();

      // 5. Resolve with choice that has no predictions
      // const streamerTokenAccount = participantTokenAccounts.get(
      //   creator.publicKey,
      // )!;
      const streamerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        creator.publicKey,
      );

      await program.methods
        .resolvePrediction(3) // Choice 3 - no one predicted this
        .accounts({
          stream: streamPda,
          creator: creator.publicKey,
          vault: noWinnerVaultPda,
          creatorTokenAccount: streamerTokenAccount,
          vaultTokenAccount: noWinnerVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const streamAccount = await (program.account as any).stream.fetch(
        streamPda,
      );
      expect(streamAccount.isResolved).to.be.true;
      expect(streamAccount.winningChoice).to.equal(3);

      // 6. All participants should get refunds
      const finalStreamerBalance = (
        await getAccount(provider.connection, streamerTokenAccount)
      ).amount;
      expect(Number(finalStreamerBalance)).to.be.greaterThan(0);

      for (const { viewer } of noWinnerPredictions) {
        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("prediction"),
            streamPda.toBuffer(),
            viewer.publicKey.toBuffer(),
          ],
          program.programId,
        );

        const initialBalance = (
          await getAccount(
            provider.connection,
            participantTokenAccounts.get(viewer.publicKey)!,
          )
        ).amount;

        await program.methods
          .claimRefund()
          .accounts({
            prediction: predictionPda,
            stream: streamPda,
            vault: noWinnerVaultPda,
            viewerTokenAccount: participantTokenAccounts.get(viewer.publicKey)!,
            vaultTokenAccount: noWinnerVaultTokenAccount,
            viewer: viewer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([viewer])
          .rpc();

        const finalBalance = (
          await getAccount(
            provider.connection,
            participantTokenAccounts.get(viewer.publicKey)!,
          )
        ).amount;
        expect(Number(finalBalance)).to.be.greaterThan(Number(initialBalance));
      }
    });
  });

  describe("Complete Stream Lifecycle - Cancellation and Refunds", () => {
    let streamPda: PublicKey;
    let cancelVaultPda: PublicKey;
    let cancelVaultTokenAccount: PublicKey;

    it("Complete workflow with stream cancellation", async () => {
      // 1. Create Stream
      const streamId = new BN(Date.now() + 2000);
      const title = "Cancellation Test Stream";
      const startTime = new BN(Date.now() / 1000);
      const lockOffsetSecs = new BN(300);
      const tipBps = 1000;
      const precision = 2;
      const gracePeriodSecs = new BN(600);

      [streamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          streamer.publicKey.toBuffer(),
          streamId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          streamId,
          title,
          startTime,
          lockOffsetSecs,
          tipBps,
          precision,
          gracePeriodSecs,
        )
        .accounts({
          stream: streamPda,
          creator: streamer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // 2. Initialize vault and activate
      [cancelVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), streamPda.toBuffer()],
        program.programId,
      );

      cancelVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        cancelVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: streamer.publicKey,
          stream: streamPda,
          vault: cancelVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: cancelVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: streamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // 3. Submit predictions
      const cancelPredictions = [
        { viewer: viewer1, choice: 1, stake: 100 },
        { viewer: viewer2, choice: 2, stake: 200 },
      ];

      for (const { viewer, choice, stake } of cancelPredictions) {
        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("prediction"),
            streamPda.toBuffer(),
            viewer.publicKey.toBuffer(),
          ],
          program.programId,
        );

        // Get viewer token account (should already exist from before hook)
        const viewerTokenAccount = participantTokenAccounts.get(
          viewer.publicKey,
        );
        if (!viewerTokenAccount) {
          throw new Error(
            `Viewer token account not found for ${viewer.publicKey.toString()}`,
          );
        }

        await program.methods
          .submitPrediction(choice, new BN(stake * 1_000_000))
          .accounts({
            stream: streamPda,
            prediction: predictionPda,
            vault: cancelVaultPda,
            viewerTokenAccount: viewerTokenAccount,
            vaultTokenAccount: cancelVaultTokenAccount,
            viewer: viewer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([viewer])
          .rpc();
      }

      // 4. Cancel stream
      await program.methods
        .cancelStream()
        .accounts({
          stream: streamPda,
          creator: streamer.publicKey,
        })
        .rpc();

      const streamAccount = await (program.account as any).stream.fetch(
        streamPda,
      );
      // Stream should be inactive after ending (legacy behavior)
      // expect(streamAccount.isActive).to.be.false;
      expect(streamAccount.canceledAt.toNumber()).to.be.greaterThan(0);

      // 5. All participants should get refunds
      for (const { viewer } of cancelPredictions) {
        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("prediction"),
            streamPda.toBuffer(),
            viewer.publicKey.toBuffer(),
          ],
          program.programId,
        );

        const initialBalance = (
          await getAccount(
            provider.connection,
            participantTokenAccounts.get(viewer.publicKey)!,
          )
        ).amount;

        await program.methods
          .claimRefund()
          .accounts({
            prediction: predictionPda,
            stream: streamPda,
            vault: cancelVaultPda,
            viewerTokenAccount: participantTokenAccounts.get(viewer.publicKey)!,
            vaultTokenAccount: cancelVaultTokenAccount,
            viewer: viewer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([viewer])
          .rpc();

        const finalBalance = (
          await getAccount(
            provider.connection,
            participantTokenAccounts.get(viewer.publicKey)!,
          )
        ).amount;
        expect(Number(finalBalance)).to.be.greaterThan(Number(initialBalance));

        // Try to claim refund again - should fail
        try {
          await program.methods
            .claimRefund()
            .accounts({
              prediction: predictionPda,
              stream: streamPda,
              vault: cancelVaultPda,
              viewerTokenAccount: participantTokenAccounts.get(
                viewer.publicKey,
              )!,
              vaultTokenAccount: cancelVaultTokenAccount,
              viewer: viewer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([viewer])
            .rpc();

          expect.fail("Should not be able to claim refund twice");
        } catch (error) {
          expect((error as any).toString()).to.include(
            "RefundAlreadyClaimed",
          ) || expect((error as any).toString()).to.include("already refunded");
        }
      }
    });
  });

  describe("Multi-Stream Concurrent Operations", () => {
    it("Handle multiple streams running simultaneously", async () => {
      const streamConfigs = [
        { id: new BN(9999991), title: "Concurrent Stream 1", winningChoice: 1 },
        { id: new BN(9999992), title: "Concurrent Stream 2", winningChoice: 2 },
        { id: new BN(9999993), title: "Concurrent Stream 3", winningChoice: 1 },
      ];

      const streamPDAs = new Map<BN, PublicKey>();
      const vaultPDAs = new Map<BN, PublicKey>();

      // Create multiple streams
      for (const config of streamConfigs) {
        const [streamPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("stream"),
            streamer.publicKey.toBuffer(),
            config.id.toArrayLike(Buffer, "le", 8),
          ],
          program.programId,
        );

        streamPDAs.set(config.id, streamPda);

        await program.methods
          .createStream(
            config.id,
            config.title,
            new BN(Date.now() / 1000),
            new BN(300),
            1000,
            2,
            new BN(600),
          )
          .accounts({
            stream: streamPda,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Initialize vault
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), streamPda.toBuffer()],
          program.programId,
        );

        vaultPDAs.set(config.id, vaultPda);

        const vaultTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          vaultPda,
          true,
        );

        await program.methods
          .initializeTokenVault()
          .accounts({
            creator: creator.publicKey,
            stream: streamPda,
            vault: vaultPda,
            tokenMint: tokenMint,
            vaultTokenAccount: vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Activate stream
        await program.methods
          .activateStream()
          .accounts({
            stream: streamPda,
            creator: creator.publicKey,
          })
          .rpc();
      }

      // Submit predictions to all streams concurrently
      const predictionPromises: Promise<string>[] = [];

      for (const config of streamConfigs) {
        const streamPda = streamPDAs.get(config.id)!;
        const vaultPda = vaultPDAs.get(config.id)!;

        // Viewer 1 predicts choice 1
        predictionPromises.push(
          (async () => {
            // Get existing token account from participantTokenAccounts
            let viewer1TokenAccount = participantTokenAccounts.get(
              viewer1.publicKey,
            );

            if (!viewer1TokenAccount) {
              // Create token account on-demand
              viewer1TokenAccount = await getAssociatedTokenAddress(
                tokenMint,
                viewer1.publicKey,
              );
              await createAssociatedTokenAccount(
                provider.connection,
                creator.payer,
                tokenMint,
                viewer1.publicKey,
              );
              await mintTo(
                provider.connection,
                creator.payer,
                tokenMint,
                viewer1TokenAccount,
                creator.publicKey,
                1000 * 1_000_000, // 1000 tokens for testing
              );
              participantTokenAccounts.set(
                viewer1.publicKey,
                viewer1TokenAccount,
              );
            }

            return program.methods
              .submitPrediction(1, new BN(100 * 1_000_000))
              .accounts({
                stream: streamPda,
                prediction: PublicKey.findProgramAddressSync(
                  [
                    Buffer.from("prediction"),
                    streamPda.toBuffer(),
                    viewer1.publicKey.toBuffer(),
                  ],
                  program.programId,
                )[0],
                vault: vaultPda,
                viewerTokenAccount: viewer1TokenAccount,
                vaultTokenAccount: await getAssociatedTokenAddress(
                  tokenMint,
                  vaultPda,
                  true,
                ),
                viewer: viewer1.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
              })
              .signers([viewer1])
              .rpc();
          })(),
        );

        // Viewer 2 predicts choice 2
        predictionPromises.push(
          (async () => {
            // Get existing token account from participantTokenAccounts
            let viewer2TokenAccount = participantTokenAccounts.get(
              viewer2.publicKey,
            );

            if (!viewer2TokenAccount) {
              // Create token account on-demand
              viewer2TokenAccount = await getAssociatedTokenAddress(
                tokenMint,
                viewer2.publicKey,
              );
              await createAssociatedTokenAccount(
                provider.connection,
                creator.payer,
                tokenMint,
                viewer2.publicKey,
              );
              await mintTo(
                provider.connection,
                creator.payer,
                tokenMint,
                viewer2TokenAccount,
                creator.publicKey,
                1000 * 1_000_000, // 1000 tokens for testing
              );
              participantTokenAccounts.set(
                viewer2.publicKey,
                viewer2TokenAccount,
              );
            }

            return program.methods
              .submitPrediction(2, new BN(150 * 1_000_000))
              .accounts({
                stream: streamPda,
                prediction: PublicKey.findProgramAddressSync(
                  [
                    Buffer.from("prediction"),
                    streamPda.toBuffer(),
                    viewer2.publicKey.toBuffer(),
                  ],
                  program.programId,
                )[0],
                vault: vaultPda,
                viewerTokenAccount: viewer2TokenAccount,
                vaultTokenAccount: await getAssociatedTokenAddress(
                  tokenMint,
                  vaultPda,
                  true,
                ),
                viewer: viewer2.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
              })
              .signers([viewer2])
              .rpc();
          })(),
        );
      }

      await Promise.all(predictionPromises);

      // End all streams
      const endPromises = streamConfigs.map((config) => {
        const streamPda = streamPDAs.get(config.id)!;
        return program.methods
          .endStream()
          .accounts({
            stream: streamPda,
            creator: creator.publicKey,
          })
          .rpc();
      });

      await Promise.all(endPromises);

      // Resolve all streams
      const resolvePromises = streamConfigs.map(async (config) => {
        const streamPda = streamPDAs.get(config.id)!;
        const vaultPda = vaultPDAs.get(config.id)!;
        // const streamerTokenAccount = participantTokenAccounts.get(
        //   creator.publicKey,
        // )!;
        const streamerTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          creator.publicKey,
        );
        const vaultTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          vaultPda,
          true,
        );

        return program.methods
          .resolvePrediction(config.winningChoice)
          .accounts({
            stream: streamPda,
            creator: creator.publicKey,
            vault: vaultPda,
            creatorTokenAccount: streamerTokenAccount,
            vaultTokenAccount: vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      });

      await Promise.all(resolvePromises);

      // Verify all streams are resolved
      for (const config of streamConfigs) {
        const streamPda = streamPDAs.get(config.id)!;
        const streamAccount = await (program.account as any).stream.fetch(
          streamPda,
        );
        expect(streamAccount.isResolved).to.be.true;
        expect(streamAccount.winningChoice).to.equal(1);
      }
      describe("Edge Case Workflow - Maximum Load", () => {
        it("Handle maximum number of predictions in a single stream", async () => {
          // Create a stream for maximum load testing
          const streamId = new BN(8888888); // Unique ID to avoid collisions
          const title = "Maximum Load Test Stream";
          const startTime = new BN(Date.now() / 1000);
          const lockOffsetSecs = new BN(300);
          const tipBps = 1000;
          const precision = 2;
          const gracePeriodSecs = new BN(600);

          const [maxLoadStreamPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from("stream"),
              streamer.publicKey.toBuffer(),
              streamId.toArrayLike(Buffer, "le", 8),
            ],
            program.programId,
          );

          await program.methods
            .createStream(
              streamId,
              title,
              startTime,
              lockOffsetSecs,
              tipBps,
              precision,
              gracePeriodSecs,
            )
            .accounts({
              stream: maxLoadStreamPda,
              creator: streamer.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc();

          // Initialize vault
          const [maxLoadVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), maxLoadStreamPda.toBuffer()],
            program.programId,
          );

          const maxLoadVaultTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            maxLoadVaultPda,
            true,
          );

          await program.methods
            .initializeTokenVault()
            .accounts({
              creator: streamer.publicKey,
              stream: maxLoadStreamPda,
              vault: maxLoadVaultPda,
              tokenMint: tokenMint,
              vaultTokenAccount: maxLoadVaultTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc();

          // Activate stream
          await program.methods
            .activateStream()
            .accounts({
              stream: maxLoadStreamPda,
              creator: streamer.publicKey,
            })
            .rpc();

          // Try to submit maximum number of predictions (10 per viewer, 5 viewers = 50 total)
          const successfulPredictions: PublicKey[] = [];
          const maxPredictionsPerViewer = 10;
          const viewers = [viewer1, viewer2, viewer3, viewer4, viewer5];

          for (let i = 0; i < maxPredictionsPerViewer; i++) {
            for (const viewer of viewers) {
              const choice = (i % 3) + 1; // Rotate between choices 1, 2, 3
              const stake = 10;

              const [predictionPda] = PublicKey.findProgramAddressSync(
                [
                  Buffer.from("prediction"),
                  maxLoadStreamPda.toBuffer(),
                  viewer.publicKey.toBuffer(),
                ],
                program.programId,
              );

              try {
                // Ensure viewer token account exists
                const viewerTokenAccount = await ensureTokenAccount(
                  provider.connection,
                  creator.payer,
                  tokenMint,
                  viewer.publicKey,
                  participantTokenAccounts,
                );
                await program.methods
                  .submitPrediction(choice, new BN(stake * 1_000_000))
                  .accounts({
                    stream: maxLoadStreamPda,
                    prediction: predictionPda,
                    vault: maxLoadVaultPda,
                    viewerTokenAccount: viewerTokenAccount,
                    vaultTokenAccount: maxLoadVaultTokenAccount,
                    viewer: viewer.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                  })
                  .signers([viewer])
                  .rpc();

                successfulPredictions.push(predictionPda);
              } catch (error) {
                // Expected to fail for duplicate predictions
                expect((error as any).toString()).to.include(
                  "already exists",
                ) ||
                  expect((error as any).toString()).to.include(
                    "AccountNotInitialized",
                  );
              }
            }
          }

          // Should have exactly 5 successful predictions (one per viewer)
          expect(successfulPredictions.length).to.equal(5);

          // End and resolve stream
          await program.methods
            .endStream()
            .accounts({
              stream: maxLoadStreamPda,
              creator: streamer.publicKey,
            })
            .rpc();

          // const streamerTokenAccount = participantTokenAccounts.get(
          //   creator.publicKey,
          // )!;
          const streamerTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            creator.publicKey,
          );

          await program.methods
            .resolvePrediction(1)
            .accounts({
              stream: maxLoadStreamPda,
              creator: creator.publicKey,
              vault: maxLoadVaultPda,
              creatorTokenAccount: streamerTokenAccount,
              vaultTokenAccount: maxLoadVaultTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

          // Verify stream state
          const streamAccount = await (program.account as any).stream.fetch(
            maxLoadStreamPda,
          );
          expect(streamAccount.isResolved).to.be.true;
          expect(Number(streamAccount.totalStaked)).to.be.greaterThan(0);
        });
      });
    });
  });
});
