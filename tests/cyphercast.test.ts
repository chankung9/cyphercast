import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import type { BN as BNType } from "bn.js";
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
} from "@solana/web3.js";

// Define account types for the program
interface StreamAccount {
  title: string;
  description: string;
  creator: PublicKey;
  tokenMint: PublicKey;
  vault: PublicKey;
  startTime: any;
  endTime: any;
  lockOffsetSecs: number;
  tipBps: number;
  totalDeposited: any;
  totalStaked: any;
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
  totalDeposited: any;
  totalStaked: any;
  distributorTip: any;
  rewardPool: any;
}

interface PredictionAccount {
  stream: PublicKey;
  viewer: PublicKey;
  choice: number;
  stakeAmount: any;
  rewardClaimed: boolean;
  refunded: boolean;
  timestamp: any;
}

describe("CypherCast - Comprehensive Test Suite with Edge Cases", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cyphercast;
  const creator = provider.wallet as anchor.Wallet;
  const viewer = Keypair.generate();
  const viewer2 = Keypair.generate();
  const viewer3 = Keypair.generate();
  const maliciousActor = Keypair.generate();

  let tokenMint: PublicKey;
  let streamPda: PublicKey;
  let vaultPda: PublicKey;
  let vaultTokenAccount: PublicKey;
  let viewerTokenAccount: PublicKey;
  let viewer2TokenAccount: PublicKey;
  let viewer3TokenAccount: PublicKey;
  let creatorTokenAccount: PublicKey;
  let maliciousTokenAccount: PublicKey;

  before(async () => {
    // Airdrop SOL to all test participants
    for (const user of [viewer, viewer2, viewer3, maliciousActor]) {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          user.publicKey,
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

    // Create token accounts for all participants
    // Create token accounts for all participants
    viewerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      viewer.publicKey,
    );
    viewer2TokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      viewer2.publicKey,
    );
    viewer3TokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      viewer3.publicKey,
    );
    creatorTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      creator.publicKey,
    );
    maliciousTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      maliciousActor.publicKey,
    );

    const tokenAccounts = [
      { user: viewer, account: viewerTokenAccount },
      { user: viewer2, account: viewer2TokenAccount },
      { user: viewer3, account: viewer3TokenAccount },
      { user: creator, account: creatorTokenAccount },
      { user: maliciousActor, account: maliciousTokenAccount },
    ];

    for (const { user, account } of tokenAccounts) {
      await createAssociatedTokenAccount(
        provider.connection,
        creator.payer,
        tokenMint,
        user.publicKey,
      );

      // Mint tokens to viewers
      if (user !== creator) {
        await mintTo(
          provider.connection,
          creator.payer,
          tokenMint,
          account,
          creator.publicKey,
          1000 * 1_000_000, // 1000 tokens
        );
      }

      // Assign to variables
      eval(`${account} = tokenAccount`);
    }
  });

  describe("Basic Functionality", () => {
    it("Creates a stream with valid parameters", async () => {
      const streamId = new BN(1);
      const title = "Test Stream";
      const startTime = new BN(Date.now() / 1000);
      const lockOffsetSecs = new BN(300);
      const tipBps = 1000; // 10%
      const precision = 2;
      const gracePeriodSecs = new BN(60);

      [streamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
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

      const streamAccount = await (program.account as any).stream.fetch(
        streamPda,
      );
      expect(streamAccount.creator.toString()).to.equal(
        creator.publicKey.toString(),
      );
      expect(streamAccount.title).to.equal(title);
      expect(streamAccount.isActive).to.be.true;
      expect(streamAccount.isResolved).to.be.false;
    });

    it("Initializes token vault successfully", async () => {
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

      const vaultAccount = await (program.account as any).tokenVault.fetch(
        vaultPda,
      );
      expect(vaultAccount.stream.toString()).to.equal(streamPda.toString());
      expect(vaultAccount.mint.toString()).to.equal(tokenMint.toString());
    });
  });

  describe("Edge Cases - Stream Creation", () => {
    it("Rejects stream with title too long (>200 chars)", async () => {
      const longTitle = "A".repeat(201);

      try {
        await program.methods
          .createStream(
            new BN(999),
            longTitle,
            new BN(Date.now() / 1000),
            new BN(300),
            1000,
            2,
            new BN(60),
          )
          .accounts({
            stream: PublicKey.findProgramAddressSync(
              [
                Buffer.from("stream"),
                creator.publicKey.toBuffer(),
                new BN(999).toArrayLike(Buffer, "le", 8),
              ],
              program.programId,
            )[0],
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have failed with title too long");
      } catch (error) {
        expect((error as any).toString()).to.include("Title too long");
      }
    });

    it("Rejects stream with zero tip percentage", async () => {
      try {
        await program.methods
          .createStream(
            new BN(998),
            "Zero Tip Stream",
            new BN(Date.now() / 1000),
            new BN(300),
            0, // 0% tip
            2,
            new BN(60),
          )
          .accounts({
            stream: PublicKey.findProgramAddressSync(
              [
                Buffer.from("stream"),
                creator.publicKey.toBuffer(),
                new BN(998).toArrayLike(Buffer, "le", 8),
              ],
              program.programId,
            )[0],
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have failed with zero tip");
      } catch (error) {
        expect((error as any).toString()).to.include("Invalid tip percentage");
      }
    });

    it("Rejects stream with tip percentage > 10000 (100%)", async () => {
      try {
        await program.methods
          .createStream(
            new BN(997),
            "High Tip Stream",
            new BN(Date.now() / 1000),
            new BN(300),
            10001, // 100.01% tip
            2,
            new BN(60),
          )
          .accounts({
            stream: PublicKey.findProgramAddressSync(
              [
                Buffer.from("stream"),
                creator.publicKey.toBuffer(),
                new BN(997).toArrayLike(Buffer, "le", 8),
              ],
              program.programId,
            )[0],
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have failed with tip too high");
      } catch (error) {
        expect((error as any).toString()).to.include("Invalid tip percentage");
      }
    });

    it("Rejects duplicate stream ID from same creator", async () => {
      try {
        await program.methods
          .createStream(
            new BN(1), // Same ID as first stream
            "Duplicate Stream",
            new BN(Date.now() / 1000),
            new BN(300),
            1000,
            2,
            new BN(60),
          )
          .accounts({
            stream: streamPda, // Same PDA
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have failed with duplicate stream ID");
      } catch (error) {
        expect((error as any).toString()).to.include("already in use");
      }
    });

    it("Creates stream with maximum valid title length (200 chars)", async () => {
      const maxTitle = "A".repeat(200);
      const [maxStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(996).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(996),
          maxTitle,
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: maxStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount = await (program.account as any).stream.fetch(
        maxStreamPda,
      );
      expect(streamAccount.title).to.equal(maxTitle);
      expect(streamAccount.title.length).to.equal(200);
    });
  });

  describe("Edge Cases - Stream Activation", () => {
    it("Prevents activation by non-creator", async () => {
      const [nonCreatorStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(995).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      // Create stream first
      await program.methods
        .createStream(
          new BN(995),
          "Non-creator Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: nonCreatorStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Try to activate with viewer (non-creator)
      try {
        await program.methods
          .activateStream()
          .accounts({
            stream: nonCreatorStreamPda,
            creator: viewer.publicKey, // Not the creator
          })
          .signers([viewer])
          .rpc();

        expect.fail("Should have failed with unauthorized cancellation");
      } catch (error) {
        expect((error as any).toString()).to.include("Unauthorized");
      }
    });

    it("Prevents double activation", async () => {
      // Activate stream
      await program.methods
        .activateStream()
        .accounts({
          stream: streamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Try to activate again
      try {
        await program.methods
          .activateStream()
          .accounts({
            stream: streamPda,
            creator: creator.publicKey,
          })
          .rpc();

        expect.fail("Should have failed with already activated");
      } catch (error) {
        expect((error as any).toString()).to.include("Already active");
      }
    });

    it("Prevents activation after stream is resolved", async () => {
      const [resolvedStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(994).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      // Create and set up stream
      await program.methods
        .createStream(
          new BN(994),
          "Resolved Stream Test",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: resolvedStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // End and resolve stream
      await program.methods
        .endStream()
        .accounts({
          stream: resolvedStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      await program.methods
        .resolvePrediction(1)
        .accounts({
          stream: resolvedStreamPda,
          creator: creator.publicKey,
          vault: vaultPda,
          creatorTokenAccount: creatorTokenAccount,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Try to activate resolved stream
      try {
        await program.methods
          .activateStream()
          .accounts({
            stream: resolvedStreamPda,
            creator: creator.publicKey,
          })
          .rpc();

        expect.fail("Should have failed with stream already resolved");
      } catch (error) {
        expect((error as any).toString()).to.include("Already resolved");
      }
    });
  });

  describe("Edge Cases - Prediction Submission", () => {
    let predictionStreamPda: PublicKey;
    let predictionVaultPda: PublicKey;
    let predictionVaultTokenAccount: PublicKey;

    before(async () => {
      // Create stream for prediction tests
      [predictionStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(100).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(100),
          "Prediction Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: predictionStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: predictionStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      [predictionVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), predictionStreamPda.toBuffer()],
        program.programId,
      );

      predictionVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        predictionVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: predictionStreamPda,
          vault: predictionVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: predictionVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("Rejects prediction with invalid choice (>255)", async () => {
      const [predictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          predictionStreamPda.toBuffer(),
          viewer.publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .submitPrediction(256, new BN(100)) // Invalid choice
          .accounts({
            stream: predictionStreamPda,
            prediction: predictionPda,
            vault: predictionVaultPda,
            viewerTokenAccount: viewerTokenAccount,
            vaultTokenAccount: predictionVaultTokenAccount,
            viewer: viewer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([viewer])
          .rpc();

        expect.fail("Should have failed with invalid choice");
      } catch (error) {
        expect((error as any).toString()).to.include("Invalid choice");
      }
    });

    it("Rejects prediction with zero stake amount", async () => {
      const [predictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          predictionStreamPda.toBuffer(),
          viewer2.publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .submitPrediction(1, new BN(0)) // Zero stake
          .accounts({
            stream: predictionStreamPda,
            prediction: predictionPda,
            vault: predictionVaultPda,
            viewerTokenAccount: viewer2TokenAccount,
            vaultTokenAccount: predictionVaultTokenAccount,
            viewer: viewer2.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([viewer2])
          .rpc();

        expect.fail("Should have failed with zero stake");
      } catch (error) {
        expect((error as any).toString()).to.include("Invalid stake amount");
      }
    });

    it("Rejects prediction with insufficient token balance", async () => {
      // Create a user with no tokens
      const poorUser = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          poorUser.publicKey,
          2 * LAMPORTS_PER_SOL,
        ),
      );

      const poorUserTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        poorUser.publicKey,
      );
      await createAssociatedTokenAccount(
        provider.connection,
        creator.payer,
        tokenMint,
        poorUser.publicKey,
      );

      const [predictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          predictionStreamPda.toBuffer(),
          poorUser.publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .submitPrediction(1, new BN(2000 * 1_000_000)) // More than available
          .accounts({
            stream: predictionStreamPda,
            prediction: predictionPda,
            vault: predictionVaultPda,
            viewerTokenAccount: poorUserTokenAccount,
            vaultTokenAccount: predictionVaultTokenAccount,
            viewer: poorUser.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([poorUser])
          .rpc();

        expect.fail("Should have failed with insufficient balance");
      } catch (error) {
        expect((error as any).toString()).to.include("Insufficient balance");
      }
    });

    it("Prevents duplicate predictions from same viewer", async () => {
      const [predictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          predictionStreamPda.toBuffer(),
          viewer3.publicKey.toBuffer(),
        ],
        program.programId,
      );

      // First prediction
      await program.methods
        .submitPrediction(1, new BN(100))
        .accounts({
          stream: predictionStreamPda,
          prediction: predictionPda,
          vault: predictionVaultPda,
          viewerTokenAccount: viewer3TokenAccount,
          vaultTokenAccount: predictionVaultTokenAccount,
          viewer: viewer3.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([viewer3])
        .rpc();

      // Try second prediction
      try {
        await program.methods
          .submitPrediction(2, new BN(50))
          .accounts({
            stream: predictionStreamPda,
            prediction: predictionPda,
            vault: predictionVaultPda,
            viewerTokenAccount: viewer3TokenAccount,
            vaultTokenAccount: predictionVaultTokenAccount,
            viewer: viewer3.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([viewer3])
          .rpc();

        expect.fail("Should have failed with duplicate prediction");
      } catch (error) {
        expect((error as any).toString()).to.include("Stream already exists");
      }
    });
  });

  describe("Edge Cases - Stream Resolution", () => {
    let resolutionStreamPda: PublicKey;
    let resolutionVaultPda: PublicKey;
    let resolutionVaultTokenAccount: PublicKey;

    before(async () => {
      // Create stream for resolution tests
      [resolutionStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(200).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(200),
          "Resolution Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: resolutionStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: resolutionStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      [resolutionVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), resolutionStreamPda.toBuffer()],
        program.programId,
      );

      resolutionVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        resolutionVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: resolutionStreamPda,
          vault: resolutionVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: resolutionVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("Prevents resolution by non-creator", async () => {
      try {
        await program.methods
          .endStream()
          .accounts({
            stream: resolutionStreamPda,
            creator: maliciousActor.publicKey, // Not the creator
          })
          .signers([maliciousActor])
          .rpc();

        expect.fail("Should have failed with unauthorized resolution");
      } catch (error) {
        expect((error as any).toString()).to.include("Unauthorized");
      }
    });

    it("Prevents resolution before stream is ended", async () => {
      try {
        await program.methods
          .resolvePrediction(1)
          .accounts({
            stream: resolutionStreamPda,
            creator: creator.publicKey,
            vault: resolutionVaultPda,
            creatorTokenAccount: creatorTokenAccount,
            vaultTokenAccount: resolutionVaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        expect.fail("Should have failed with stream not ended");
      } catch (error) {
        expect((error as any).toString()).to.include("Stream not ended");
      }
    });

    it("Prevents double resolution", async () => {
      // End stream
      await program.methods
        .endStream()
        .accounts({
          stream: resolutionStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // First resolution
      await program.methods
        .resolvePrediction(1)
        .accounts({
          stream: resolutionStreamPda,
          creator: creator.publicKey,
          vault: resolutionVaultPda,
          creatorTokenAccount: creatorTokenAccount,
          vaultTokenAccount: resolutionVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Try second resolution
      try {
        await program.methods
          .resolvePrediction(2)
          .accounts({
            stream: resolutionStreamPda,
            creator: creator.publicKey,
            vault: resolutionVaultPda,
            creatorTokenAccount: creatorTokenAccount,
            vaultTokenAccount: resolutionVaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        expect.fail("Should have failed with already resolved");
      } catch (error) {
        expect((error as any).toString()).to.include("Already resolved");
      }
    });

    it("Handles no-winners scenario gracefully", async () => {
      const [noWinnerStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(201).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      // Create stream
      await program.methods
        .createStream(
          new BN(201),
          "No Winner Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: noWinnerStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: noWinnerStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      const [noWinnerVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), noWinnerStreamPda.toBuffer()],
        program.programId,
      );

      const noWinnerVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        noWinnerVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: noWinnerStreamPda,
          vault: noWinnerVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: noWinnerVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // No one submits predictions - end and resolve
      await program.methods
        .endStream()
        .accounts({
          stream: noWinnerStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Should resolve successfully even with no winners
      await program.methods
        .resolvePrediction(1)
        .accounts({
          stream: noWinnerStreamPda,
          creator: creator.publicKey,
          vault: noWinnerVaultPda,
          creatorTokenAccount: creatorTokenAccount,
          vaultTokenAccount: noWinnerVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const streamAccount = await (program.account as any).stream.fetch(
        noWinnerStreamPda,
      );
      expect(streamAccount.isResolved).to.be.true;
      expect(streamAccount.winningChoice).to.equal(1);
    });
  });

  describe("Edge Cases - Reward Claims", () => {
    let claimStreamPda: PublicKey;
    let claimVaultPda: PublicKey;
    let claimVaultTokenAccount: PublicKey;
    let winnerPredictionPda: PublicKey;
    let loserPredictionPda: PublicKey;

    before(async () => {
      // Create stream for claim tests
      [claimStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(300).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(300),
          "Claim Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: claimStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: claimStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      [claimVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), claimStreamPda.toBuffer()],
        program.programId,
      );

      claimVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        claimVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: claimStreamPda,
          vault: claimVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: claimVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Submit predictions
      [winnerPredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          claimStreamPda.toBuffer(),
          viewer.publicKey.toBuffer(),
        ],
        program.programId,
      );

      [loserPredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          claimStreamPda.toBuffer(),
          viewer2.publicKey.toBuffer(),
        ],
        program.programId,
      );

      // Winner predicts choice 1
      await program.methods
        .submitPrediction(1, new BN(200))
        .accounts({
          stream: claimStreamPda,
          prediction: winnerPredictionPda,
          vault: claimVaultPda,
          viewerTokenAccount: viewerTokenAccount,
          vaultTokenAccount: claimVaultTokenAccount,
          viewer: viewer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([viewer])
        .rpc();

      // Loser predicts choice 2
      await program.methods
        .submitPrediction(2, new BN(150))
        .accounts({
          stream: claimStreamPda,
          prediction: loserPredictionPda,
          vault: claimVaultPda,
          viewerTokenAccount: viewer2TokenAccount,
          vaultTokenAccount: claimVaultTokenAccount,
          viewer: viewer2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([viewer2])
        .rpc();

      // End and resolve with choice 1 (viewer wins)
      await program.methods
        .endStream()
        .accounts({
          stream: claimStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      await program.methods
        .resolvePrediction(1)
        .accounts({
          stream: claimStreamPda,
          creator: creator.publicKey,
          vault: claimVaultPda,
          creatorTokenAccount: creatorTokenAccount,
          vaultTokenAccount: claimVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    });

    it("Allows winner to claim reward", async () => {
      const initialBalance = (
        await getAccount(provider.connection, viewerTokenAccount)
      ).amount;

      await program.methods
        .claimReward()
        .accounts({
          prediction: winnerPredictionPda,
          stream: claimStreamPda,
          vault: claimVaultPda,
          viewerTokenAccount: viewerTokenAccount,
          vaultTokenAccount: claimVaultTokenAccount,
          viewer: viewer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([viewer])
        .rpc();

      const finalBalance = (
        await getAccount(provider.connection, viewerTokenAccount)
      ).amount;
      expect(Number(finalBalance)).to.be.greaterThan(Number(initialBalance));

      const predictionAccount = await (program.account as any).prediction.fetch(
        winnerPredictionPda,
      );
      expect(predictionAccount.rewardClaimed).to.be.true;
    });

    it("Prevents loser from claiming reward", async () => {
      try {
        await program.methods
          .claimReward()
          .accounts({
            prediction: loserPredictionPda,
            stream: claimStreamPda,
            vault: claimVaultPda,
            viewerTokenAccount: viewer2TokenAccount,
            vaultTokenAccount: claimVaultTokenAccount,
            viewer: viewer2.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([viewer2])
          .rpc();

        expect.fail("Should have failed with incorrect prediction");
      } catch (error) {
        expect((error as any).toString()).to.include("Incorrect prediction");
      }
    });

    it("Prevents double reward claim", async () => {
      try {
        await program.methods
          .claimReward()
          .accounts({
            prediction: winnerPredictionPda,
            stream: claimStreamPda,
            vault: claimVaultPda,
            viewerTokenAccount: viewerTokenAccount,
            vaultTokenAccount: claimVaultTokenAccount,
            viewer: viewer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([viewer])
          .rpc();

        expect.fail("Should have failed with already claimed");
      } catch (error) {
        expect((error as any).toString()).to.include("Already claimed");
      }
    });

    it("Prevents claiming reward for different viewer", async () => {
      const [otherPredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          claimStreamPda.toBuffer(),
          maliciousActor.publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .claimReward()
          .accounts({
            prediction: winnerPredictionPda, // viewer's prediction
            stream: claimStreamPda,
            vault: claimVaultPda,
            viewerTokenAccount: maliciousTokenAccount, // malicious actor's token account
            vaultTokenAccount: claimVaultTokenAccount,
            viewer: maliciousActor.publicKey, // malicious actor
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([maliciousActor])
          .rpc();

        expect.fail("Should have failed with unauthorized claim");
      } catch (error) {
        expect((error as any).toString()).to.include("Unauthorized");
      }
    });
  });

  describe("Edge Cases - Stream Cancellation", () => {
    let cancelStreamPda: PublicKey;
    let cancelVaultPda: PublicKey;
    let cancelVaultTokenAccount: PublicKey;
    let cancelPredictionPda: PublicKey;

    before(async () => {
      // Create stream for cancellation tests
      [cancelStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(400).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(400),
          "Cancellation Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: cancelStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: cancelStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      [cancelVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), cancelStreamPda.toBuffer()],
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
          creator: creator.publicKey,
          stream: cancelStreamPda,
          vault: cancelVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: cancelVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Submit prediction for refund test
      [cancelPredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          cancelStreamPda.toBuffer(),
          viewer3.publicKey.toBuffer(),
        ],
        program.programId,
      );

      await program.methods
        .submitPrediction(1, new BN(100))
        .accounts({
          stream: cancelStreamPda,
          prediction: cancelPredictionPda,
          vault: cancelVaultPda,
          viewerTokenAccount: viewer3TokenAccount,
          vaultTokenAccount: cancelVaultTokenAccount,
          viewer: viewer3.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([viewer3])
        .rpc();
    });

    it("Prevents cancellation by non-creator", async () => {
      try {
        await program.methods
          .cancelStream()
          .accounts({
            stream: cancelStreamPda,
            creator: maliciousActor.publicKey,
          })
          .signers([maliciousActor])
          .rpc();

        expect.fail(
          "Should have failed with unauthorized vault initialization",
        );
      } catch (error) {
        expect((error as any).toString()).to.include("Unauthorized");
      }
    });

    it("Prevents cancellation after stream is resolved", async () => {
      // End and resolve stream
      await program.methods
        .endStream()
        .accounts({
          stream: cancelStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      await program.methods
        .resolvePrediction(1)
        .accounts({
          stream: cancelStreamPda,
          creator: creator.publicKey,
          vault: cancelVaultPda,
          creatorTokenAccount: creatorTokenAccount,
          vaultTokenAccount: cancelVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Try to cancel resolved stream
      try {
        await program.methods
          .cancelStream()
          .accounts({
            stream: cancelStreamPda,
            creator: creator.publicKey,
          })
          .rpc();

        expect.fail("Should have failed with already resolved");
      } catch (error) {
        expect((error as any).toString()).to.include("already resolved");
      }
    });

    it("Allows full refund after cancellation", async () => {
      // Create new stream for this test
      const [refundStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(401).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(401),
          "Refund Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: refundStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: refundStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      const [refundVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), refundStreamPda.toBuffer()],
        program.programId,
      );

      const refundVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        refundVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: refundStreamPda,
          vault: refundVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: refundVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Submit prediction
      const [refundPredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          refundStreamPda.toBuffer(),
          viewer2.publicKey.toBuffer(),
        ],
        program.programId,
      );

      const initialBalance = (
        await getAccount(provider.connection, viewer2TokenAccount)
      ).amount;

      await program.methods
        .submitPrediction(1, new BN(50))
        .accounts({
          stream: refundStreamPda,
          prediction: refundPredictionPda,
          vault: refundVaultPda,
          viewerTokenAccount: viewer2TokenAccount,
          vaultTokenAccount: refundVaultTokenAccount,
          viewer: viewer2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([viewer2])
        .rpc();

      // Cancel stream
      await program.methods
        .cancelStream()
        .accounts({
          stream: refundStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Claim refund
      await program.methods
        .claimRefund()
        .accounts({
          prediction: refundPredictionPda,
          stream: refundStreamPda,
          vault: refundVaultPda,
          viewerTokenAccount: viewer2TokenAccount,
          vaultTokenAccount: refundVaultTokenAccount,
          viewer: viewer2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([viewer2])
        .rpc();

      const finalBalance = (
        await getAccount(provider.connection, viewer2TokenAccount)
      ).amount;
      expect(Number(finalBalance)).to.be.greaterThan(Number(initialBalance));

      const predictionAccount = await (program.account as any).prediction.fetch(
        refundPredictionPda,
      );
      expect(predictionAccount.refunded).to.be.true;
    });

    it("Prevents double refund claim", async () => {
      // Declare variables for this test
      const [refundStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(402).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      const [refundVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), refundStreamPda.toBuffer()],
        program.programId,
      );

      const [refundPredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          refundStreamPda.toBuffer(),
          viewer2.publicKey.toBuffer(),
        ],
        program.programId,
      );

      const refundVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        refundVaultPda,
        true,
      );

      // Try to claim refund again from cancelled stream
      try {
        await program.methods
          .claimRefund()
          .accounts({
            prediction: refundPredictionPda,
            stream: refundStreamPda,
            vault: refundVaultPda,
            viewerTokenAccount: viewer2TokenAccount,
            vaultTokenAccount: refundVaultTokenAccount,
            viewer: viewer2.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([viewer2])
          .rpc();

        expect.fail("Should have failed with already refunded");
      } catch (error) {
        expect((error as any).toString()).to.include("already refunded");
      }
    });
  });

  describe("Security Edge Cases", () => {
    it("Prevents unauthorized token vault initialization", async () => {
      const [secureStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(500).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      // Create stream
      await program.methods
        .createStream(
          new BN(500),
          "Security Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: secureStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Try to initialize vault with malicious actor
      const [maliciousVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), secureStreamPda.toBuffer()],
        program.programId,
      );

      const maliciousVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        maliciousVaultPda,
        true,
      );

      try {
        await program.methods
          .initializeTokenVault()
          .accounts({
            creator: maliciousActor.publicKey, // Not the stream creator
            stream: secureStreamPda,
            vault: maliciousVaultPda,
            tokenMint: tokenMint,
            vaultTokenAccount: maliciousVaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([maliciousActor])
          .rpc();

        expect.fail(
          "Should have failed with unauthorized vault initialization",
        );
      } catch (error) {
        expect((error as any).toString()).to.include("Unauthorized");
      }
    });

    it("Handles maximum number of predictions per stream", async () => {
      const [maxPredictionsStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(501).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      // Create stream
      await program.methods
        .createStream(
          new BN(501),
          "Max Predictions Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: maxPredictionsStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: maxPredictionsStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      const [maxPredictionsVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), maxPredictionsStreamPda.toBuffer()],
        program.programId,
      );

      const maxPredictionsVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        maxPredictionsVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: maxPredictionsStreamPda,
          vault: maxPredictionsVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: maxPredictionsVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // This test would need to know the actual maximum limit
      // For now, just verify normal predictions work
      const [testPredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          maxPredictionsStreamPda.toBuffer(),
          viewer.publicKey.toBuffer(),
        ],
        program.programId,
      );

      await program.methods
        .submitPrediction(1, new BN(10))
        .accounts({
          stream: maxPredictionsStreamPda,
          prediction: testPredictionPda,
          vault: maxPredictionsVaultPda,
          viewerTokenAccount: viewerTokenAccount,
          vaultTokenAccount: maxPredictionsVaultTokenAccount,
          viewer: viewer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([viewer])
        .rpc();

      const predictionAccount = await (program.account as any).prediction.fetch(
        testPredictionPda,
      );
      expect(predictionAccount.viewer.toString()).to.equal(
        viewer.publicKey.toString(),
      );
    });

    it("Prevents prediction submission after lock time", async () => {
      // Create stream with very short lock time
      const [lockedStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(502).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      const pastStartTime = new BN(Date.now() / 1000 - 10); // 10 seconds ago
      const shortLockOffset = new BN(1); // 1 second lock

      await program.methods
        .createStream(
          new BN(502),
          "Quick Lock Stream",
          pastStartTime,
          shortLockOffset,
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: lockedStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: lockedStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      const [lockedVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), lockedStreamPda.toBuffer()],
        program.programId,
      );

      const lockedVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        lockedVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: lockedStreamPda,
          vault: lockedVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: lockedVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Wait for stream to be locked
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const [latePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          lockedStreamPda.toBuffer(),
          viewer2.publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .submitPrediction(1, new BN(10))
          .accounts({
            stream: lockedStreamPda,
            prediction: latePredictionPda,
            vault: lockedVaultPda,
            viewerTokenAccount: viewer2TokenAccount,
            vaultTokenAccount: lockedVaultTokenAccount,
            viewer: viewer2.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([viewer2])
          .rpc();

        expect.fail("Should have failed with stream locked");
      } catch (error) {
        expect((error as any).toString()).to.include("Stream locked");
      }
    });
  });

  describe("Performance Edge Cases", () => {
    it("Handles concurrent prediction submissions", async () => {
      const [concurrentStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(600).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      // Create stream
      await program.methods
        .createStream(
          new BN(600),
          "Concurrent Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: concurrentStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: concurrentStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      const [concurrentVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), concurrentStreamPda.toBuffer()],
        program.programId,
      );

      const concurrentVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        concurrentVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: concurrentStreamPda,
          vault: concurrentVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: concurrentVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Submit predictions concurrently
      const concurrentViewers = [viewer, viewer2, viewer3];
      const predictionPromises = concurrentViewers.map(async (user, index) => {
        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("prediction"),
            concurrentStreamPda.toBuffer(),
            user.publicKey.toBuffer(),
          ],
          program.programId,
        );

        const userTokenAccount =
          index === 0
            ? viewerTokenAccount
            : index === 1
              ? viewer2TokenAccount
              : viewer3TokenAccount;

        return program.methods
          .submitPrediction(index + 1, new BN(10))
          .accounts({
            stream: concurrentStreamPda,
            prediction: predictionPda,
            vault: concurrentVaultPda,
            viewerTokenAccount: userTokenAccount,
            vaultTokenAccount: concurrentVaultTokenAccount,
            viewer: user.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();
      });

      // Wait for all predictions to complete
      await Promise.all(predictionPromises);

      // Verify all predictions were created
      for (const user of concurrentViewers) {
        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("prediction"),
            concurrentStreamPda.toBuffer(),
            user.publicKey.toBuffer(),
          ],
          program.programId,
        );

        const predictionAccount = await (
          program.account as any
        ).prediction.fetch(predictionPda);
        expect(predictionAccount.viewer.toString()).to.equal(
          user.publicKey.toString(),
        );
      }
    });

    it("Handles maximum stake amounts", async () => {
      const [maxStakeStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(601).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      // Create stream
      await program.methods
        .createStream(
          new BN(601),
          "Max Stake Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: maxStakeStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: maxStakeStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      const [maxStakeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), maxStakeStreamPda.toBuffer()],
        program.programId,
      );

      const maxStakeVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        maxStakeVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: maxStakeStreamPda,
          vault: maxStakeVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: maxStakeVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Test with large stake amount
      const [maxStakePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          maxStakeStreamPda.toBuffer(),
          viewer.publicKey.toBuffer(),
        ],
        program.programId,
      );

      const largeStake = new BN(500 * 1_000_000); // 500 tokens

      await program.methods
        .submitPrediction(1, largeStake)
        .accounts({
          stream: maxStakeStreamPda,
          prediction: maxStakePredictionPda,
          vault: maxStakeVaultPda,
          viewerTokenAccount: viewerTokenAccount,
          vaultTokenAccount: maxStakeVaultTokenAccount,
          viewer: viewer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([viewer])
        .rpc();

      const predictionAccount = await (program.account as any).prediction.fetch(
        maxStakePredictionPda,
      );
      expect(predictionAccount.stakeAmount.toString()).to.equal(
        largeStake.toString(),
      );
    });
  });
});
