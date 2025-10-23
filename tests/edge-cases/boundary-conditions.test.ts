import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BN } from "bn.js";
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

describe("CypherCast - Boundary Conditions Edge Cases", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cyphercast as Program<any>;
  const creator = provider.wallet as anchor.Wallet;
  const boundaryTester = Keypair.generate();

  let tokenMint: PublicKey;
  let boundaryTesterTokenAccount: PublicKey;

  before(async () => {
    // Setup boundary tester
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        boundaryTester.publicKey,
        2 * LAMPORTS_PER_SOL,
      ),
    );

    // Create test token mint
    tokenMint = await createMint(
      provider.connection,
      creator.payer,
      creator.publicKey,
      null,
      6, // 6 decimals
    );

    boundaryTesterTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      boundaryTester.publicKey,
    );
    await createAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      tokenMint,
      boundaryTester.publicKey,
    );

    await mintTo(
      provider.connection,
      creator.payer,
      tokenMint,
      boundaryTesterTokenAccount,
      creator.publicKey,
      10000 * 1_000_000, // 10000 tokens for boundary testing
    );
  });

  describe("Numeric Boundary Testing", () => {
    it("Creates stream with minimum valid values", async () => {
      const streamId = new BN(0); // Minimum stream ID
      const title = "Min"; // Minimum title length
      const startTime = new BN(1); // Minimum start time
      const lockOffsetSecs = new BN(0); // Minimum lock offset
      const tipBps = 1; // Minimum tip (0.01%)
      const precision = 0; // Minimum precision
      const gracePeriodSecs = new BN(0); // Minimum grace period

      const [minStreamPda] = PublicKey.findProgramAddressSync(
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
          stream: minStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount = await program.account.stream.fetch(minStreamPda);
      expect(streamAccount.streamId.toString()).to.equal(streamId.toString());
      expect(streamAccount.title).to.equal(title);
      expect(streamAccount.tipBps).to.equal(tipBps);
      expect(streamAccount.precision).to.equal(precision);
    });

    it("Creates stream with maximum valid values", async () => {
      const streamId = new BN("18446744073709551615"); // Maximum u64
      const title = "A".repeat(200); // Maximum title length
      const startTime = new BN("9223372036854775807"); // Maximum i64
      const lockOffsetSecs = new BN("9223372036854775807"); // Maximum i64
      const tipBps = 10000; // Maximum tip (100%)
      const precision = 9; // Maximum precision per Phase 2.5 docs
      const gracePeriodSecs = new BN("9223372036854775807"); // Maximum i64

      const [maxStreamPda] = PublicKey.findProgramAddressSync(
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
          stream: maxStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount = await program.account.stream.fetch(maxStreamPda);
      expect(streamAccount.streamId.toString()).to.equal(streamId.toString());
      expect(streamAccount.title.length).to.equal(200);
      expect(streamAccount.tipBps).to.equal(tipBps);
      expect(streamAccount.precision).to.equal(precision);
    });

    it("Rejects stream ID that exceeds u64 maximum", async () => {
      try {
        const invalidStreamId = new BN("18446744073709551616"); // u64 + 1
        const [invalidStreamPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("stream"),
            creator.publicKey.toBuffer(),
            invalidStreamId.toArrayLike(Buffer, "le", 8),
          ],
          program.programId,
        );

        await program.methods
          .createStream(
            invalidStreamId,
            "Invalid Stream",
            new BN(Date.now() / 1000),
            new BN(300),
            1000,
            2,
            new BN(60),
          )
          .accounts({
            stream: invalidStreamPda,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have failed with invalid stream ID");
      } catch (error) {
        expect(error.toString()).to.include("byte array longer");
      }
    });

    it("Rejects negative tip percentage", async () => {
      try {
        const [negativeTipStreamPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("stream"),
            creator.publicKey.toBuffer(),
            new BN(1001).toArrayLike(Buffer, "le", 8),
          ],
          program.programId,
        );

        await program.methods
          .createStream(
            new BN(1001),
            "Negative Tip Stream",
            new BN(Date.now() / 1000),
            new BN(300),
            -1, // Negative tip
            2,
            new BN(60),
          )
          .accounts({
            stream: negativeTipStreamPda,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have failed with negative tip");
      } catch (error) {
        expect(error.toString()).to.include("RangeError") ||
          expect(error.toString()).to.include("out of range");
      }
    });

    it("Rejects precision value exceeding Phase 2.5 maximum", async () => {
      try {
        const [invalidPrecisionStreamPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("stream"),
            creator.publicKey.toBuffer(),
            new BN(1002).toArrayLike(Buffer, "le", 8),
          ],
          program.programId,
        );

        await program.methods
          .createStream(
            new BN(1002),
            "Invalid Precision Stream",
            new BN(Date.now() / 1000),
            new BN(300),
            1000,
            10, // Exceeds Phase 2.5 maximum (9)
            new BN(60),
          )
          .accounts({
            stream: invalidPrecisionStreamPda,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have failed with invalid precision");
      } catch (error) {
        expect(error.toString()).to.include("InvalidConfig");
      }
    });
  });

  describe("Choice Boundary Testing", () => {
    let choiceTestStreamPda: PublicKey;
    let choiceTestVaultPda: PublicKey;
    let choiceTestVaultTokenAccount: PublicKey;

    before(async () => {
      // Setup stream for choice boundary testing
      [choiceTestStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(2000).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(2000),
          "Choice Boundary Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: choiceTestStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: choiceTestStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      [choiceTestVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), choiceTestStreamPda.toBuffer()],
        program.programId,
      );

      choiceTestVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        choiceTestVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: choiceTestStreamPda,
          vault: choiceTestVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: choiceTestVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("Accepts minimum valid choice (0)", async () => {
      const [minChoicePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          choiceTestStreamPda.toBuffer(),
          boundaryTester.publicKey.toBuffer(),
        ],
        program.programId,
      );

      await program.methods
        .submitPrediction(0, new BN(10))
        .accounts({
          stream: choiceTestStreamPda,
          prediction: minChoicePredictionPda,
          vault: choiceTestVaultPda,
          viewerTokenAccount: boundaryTesterTokenAccount,
          vaultTokenAccount: choiceTestVaultTokenAccount,
          viewer: boundaryTester.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([boundaryTester])
        .rpc();

      const predictionAccount = await program.account.prediction.fetch(
        minChoicePredictionPda,
      );
      expect(predictionAccount.choice).to.equal(0);
    });

    it("Accepts maximum valid choice (10)", async () => {
      const [maxChoicePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          choiceTestStreamPda.toBuffer(),
          creator.publicKey.toBuffer(),
        ],
        program.programId,
      );

      const creatorTokenAccount = await getAssociatedTokenAddress(
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
        creatorTokenAccount,
        creator.publicKey,
        100 * 1_000_000,
      );

      await program.methods
        .submitPrediction(10, new BN(10))
        .accounts({
          stream: choiceTestStreamPda,
          prediction: maxChoicePredictionPda,
          vault: choiceTestVaultPda,
          viewerTokenAccount: creatorTokenAccount,
          vaultTokenAccount: choiceTestVaultTokenAccount,
          viewer: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const predictionAccount = await program.account.prediction.fetch(
        maxChoicePredictionPda,
      );
      expect(predictionAccount.choice).to.equal(10);
    });

    it("Rejects choice value -1 (below minimum)", async () => {
      const [negativeChoicePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          choiceTestStreamPda.toBuffer(),
          Keypair.generate().publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .submitPrediction(-1, new BN(10))
          .accounts({
            stream: choiceTestStreamPda,
            prediction: negativeChoicePredictionPda,
            vault: choiceTestVaultPda,
            viewerTokenAccount: boundaryTesterTokenAccount,
            vaultTokenAccount: choiceTestVaultTokenAccount,
            viewer: boundaryTester.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([boundaryTester])
          .rpc();

        expect.fail("Should have failed with negative choice");
      } catch (error) {
        expect(error.toString()).to.include("RangeError") ||
          expect(error.toString()).to.include("out of range");
      }
    });

    it("Rejects choice value 11 (above maximum)", async () => {
      const [overMaxChoicePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          choiceTestStreamPda.toBuffer(),
          Keypair.generate().publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .submitPrediction(11, new BN(10))
          .accounts({
            stream: choiceTestStreamPda,
            prediction: overMaxChoicePredictionPda,
            vault: choiceTestVaultPda,
            viewerTokenAccount: boundaryTesterTokenAccount,
            vaultTokenAccount: choiceTestVaultTokenAccount,
            viewer: boundaryTester.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([boundaryTester])
          .rpc();

        expect.fail("Should have failed with choice too high");
      } catch (error) {
        expect(error.toString()).to.include("AnchorError") ||
          expect(error.toString()).to.include("InvalidChoice") ||
          expect(error.toString()).to.include("choice");
      }
    });
  });

  describe("Stake Amount Boundary Testing", () => {
    let stakeTestStreamPda: PublicKey;
    let stakeTestVaultPda: PublicKey;
    let stakeTestVaultTokenAccount: PublicKey;

    before(async () => {
      // Setup stream for stake boundary testing
      [stakeTestStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(2001).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(2001),
          "Stake Boundary Test Stream",
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: stakeTestStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .activateStream()
        .accounts({
          stream: stakeTestStreamPda,
          creator: creator.publicKey,
        })
        .rpc();

      // Initialize vault
      [stakeTestVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), stakeTestStreamPda.toBuffer()],
        program.programId,
      );

      stakeTestVaultTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        stakeTestVaultPda,
        true,
      );

      await program.methods
        .initializeTokenVault()
        .accounts({
          creator: creator.publicKey,
          stream: stakeTestStreamPda,
          vault: stakeTestVaultPda,
          tokenMint: tokenMint,
          vaultTokenAccount: stakeTestVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("Accepts minimum valid stake amount (1 token)", async () => {
      const [minStakePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          stakeTestStreamPda.toBuffer(),
          boundaryTester.publicKey.toBuffer(),
        ],
        program.programId,
      );

      const minStake = new BN(1 * 1_000_000); // 1 token

      await program.methods
        .submitPrediction(1, minStake)
        .accounts({
          stream: stakeTestStreamPda,
          prediction: minStakePredictionPda,
          vault: stakeTestVaultPda,
          viewerTokenAccount: boundaryTesterTokenAccount,
          vaultTokenAccount: stakeTestVaultTokenAccount,
          viewer: boundaryTester.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([boundaryTester])
        .rpc();

      const predictionAccount = await program.account.prediction.fetch(
        minStakePredictionPda,
      );
      expect(predictionAccount.stakeAmount.toString()).to.equal(
        minStake.toString(),
      );
    });

    it("Accepts maximum reasonable stake amount", async () => {
      const maxStakeTester = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          maxStakeTester.publicKey,
          10 * LAMPORTS_PER_SOL,
        ),
      );

      const maxStakeTesterTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        maxStakeTester.publicKey,
      );
      await createAssociatedTokenAccount(
        provider.connection,
        creator.payer,
        tokenMint,
        maxStakeTester.publicKey,
      );

      await mintTo(
        provider.connection,
        creator.payer,
        tokenMint,
        maxStakeTesterTokenAccount,
        creator.publicKey,
        50000 * 1_000_000, // 50000 tokens
      );

      const [maxStakePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          stakeTestStreamPda.toBuffer(),
          maxStakeTester.publicKey.toBuffer(),
        ],
        program.programId,
      );

      const maxStake = new BN(10000 * 1_000_000); // 10000 tokens

      await program.methods
        .submitPrediction(2, maxStake)
        .accounts({
          stream: stakeTestStreamPda,
          prediction: maxStakePredictionPda,
          vault: stakeTestVaultPda,
          viewerTokenAccount: maxStakeTesterTokenAccount,
          vaultTokenAccount: stakeTestVaultTokenAccount,
          viewer: maxStakeTester.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maxStakeTester])
        .rpc();

      const predictionAccount = await program.account.prediction.fetch(
        maxStakePredictionPda,
      );
      expect(predictionAccount.stakeAmount.toString()).to.equal(
        maxStake.toString(),
      );
    });

    it("Rejects zero stake amount", async () => {
      const [zeroStakePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          stakeTestStreamPda.toBuffer(),
          Keypair.generate().publicKey.toBuffer(),
        ],
        program.programId,
      );

      try {
        await program.methods
          .submitPrediction(1, new BN(0))
          .accounts({
            stream: stakeTestStreamPda,
            prediction: zeroStakePredictionPda,
            vault: stakeTestVaultPda,
            viewerTokenAccount: boundaryTesterTokenAccount,
            vaultTokenAccount: stakeTestVaultTokenAccount,
            viewer: boundaryTester.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([boundaryTester])
          .rpc();

        expect.fail("Should have failed with zero stake");
      } catch (error) {
        expect(error.toString()).to.include("AnchorError") ||
          expect(error.toString()).to.include("InvalidStake") ||
          expect(error.toString()).to.include("stake");
      }
    });

    it("Rejects stake amount exceeding token balance", async () => {
      const [overBalancePredictionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("prediction"),
          stakeTestStreamPda.toBuffer(),
          Keypair.generate().publicKey.toBuffer(),
        ],
        program.programId,
      );

      const currentBalance = (
        await getAccount(provider.connection, boundaryTesterTokenAccount)
      ).amount;
      const overBalanceStake = new BN(
        Number(currentBalance) + 1000 * 1_000_000,
      ); // Balance + 1000 tokens

      try {
        await program.methods
          .submitPrediction(1, overBalanceStake)
          .accounts({
            stream: stakeTestStreamPda,
            prediction: overBalancePredictionPda,
            vault: stakeTestVaultPda,
            viewerTokenAccount: boundaryTesterTokenAccount,
            vaultTokenAccount: stakeTestVaultTokenAccount,
            viewer: boundaryTester.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([boundaryTester])
          .rpc();

        expect.fail("Should have failed with insufficient balance");
      } catch (error) {
        expect(error.toString()).to.include("AnchorError") ||
          expect(error.toString()).to.include("TokenError") ||
          expect(error.toString()).to.include("insufficient");
      }
    });
  });

  describe("Time Boundary Testing", () => {
    it("Handles stream start time in the past", async () => {
      const pastTime = new BN(Date.now() / 1000 - 3600); // 1 hour ago
      const [pastTimeStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(3000).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(3000),
          "Past Time Stream",
          pastTime,
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: pastTimeStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount =
        await program.account.stream.fetch(pastTimeStreamPda);
      expect(streamAccount.startTime.toString()).to.equal(pastTime.toString());
    });

    it("Handles stream start time in the distant future", async () => {
      const futureTime = new BN(Date.now() / 1000 + 31536000); // 1 year from now
      const [futureTimeStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(3001).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(3001),
          "Future Time Stream",
          futureTime,
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: futureTimeStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount =
        await program.account.stream.fetch(futureTimeStreamPda);
      expect(streamAccount.startTime.toString()).to.equal(
        futureTime.toString(),
      );
    });

    it("Handles minimum lock time (0 seconds)", async () => {
      const [noLockStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(3002).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(3002),
          "No Lock Stream",
          new BN(Date.now() / 1000),
          new BN(0), // No lock time
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: noLockStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount = await program.account.stream.fetch(noLockStreamPda);
      expect(streamAccount.lockOffsetSecs.toString()).to.equal("0");
    });

    it("Handles maximum reasonable lock time", async () => {
      const maxLockTime = new BN(86400 * 365); // 1 year in seconds
      const [maxLockStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(3003).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(3003),
          "Max Lock Stream",
          new BN(Date.now() / 1000),
          maxLockTime,
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: maxLockStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount =
        await program.account.stream.fetch(maxLockStreamPda);
      expect(streamAccount.lockOffsetSecs.toString()).to.equal(
        maxLockTime.toString(),
      );
    });
  });

  describe("String Boundary Testing", () => {
    it("Handles empty string gracefully", async () => {
      // Empty strings are actually allowed by the program
      const [emptyTitleStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(4000).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(4000),
          "", // Empty title - this should succeed
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: emptyTitleStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Verify the stream was created successfully
      const streamAccount = await (program.account as any).stream.fetch(
        emptyTitleStreamPda,
      );
      expect(streamAccount.title).to.equal("");
    });

    it("Handles single character title", async () => {
      const [singleCharStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(4001).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(4001),
          "A", // Single character
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: singleCharStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount =
        await program.account.stream.fetch(singleCharStreamPda);
      expect(streamAccount.title).to.equal("A");
    });

    it("Handles title with special characters", async () => {
      const specialTitle = "Stream!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const [specialCharStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(4002).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(4002),
          specialTitle,
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: specialCharStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount =
        await program.account.stream.fetch(specialCharStreamPda);
      expect(streamAccount.title).to.equal(specialTitle);
    });

    it("Handles title with Unicode characters", async () => {
      const unicodeTitle = "Stream 🎮🏆🎯 测试 🚀🌟";
      const [unicodeStreamPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stream"),
          creator.publicKey.toBuffer(),
          new BN(4003).toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      await program.methods
        .createStream(
          new BN(4003),
          unicodeTitle,
          new BN(Date.now() / 1000),
          new BN(300),
          1000,
          2,
          new BN(60),
        )
        .accounts({
          stream: unicodeStreamPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const streamAccount =
        await program.account.stream.fetch(unicodeStreamPda);
      expect(streamAccount.title).to.equal(unicodeTitle);
    });
  });
});
