import anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Phase 2: Token Vault & Reward Distribution", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Helper: wait for an Anchor event with timeout and automatic cleanup.
  async function waitForEvent(
    program: any,
    name: string,
    timeoutMs = 15000,
  ): Promise<{ ev: any }> {
    return new Promise(async (resolve, reject) => {
      let settled = false;
      let listenerId: number | null = null;

      const timer = setTimeout(async () => {
        if (settled) return;
        settled = true;
        if (listenerId !== null) {
          try {
            await program.removeEventListener(listenerId);
          } catch {
            // ignore cleanup errors
          }
        }
        reject(new Error(`Timeout waiting for event: ${name}`));
      }, timeoutMs);

      listenerId = await program.addEventListener(name, async (ev: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (listenerId !== null) {
          try {
            await program.removeEventListener(listenerId);
          } catch {
            // ignore cleanup errors
          }
        }
        resolve({ ev });
      });
    });
  }
  const { BN } = anchor;

  const program = anchor.workspace.Cyphercast as any;
  const creator = provider.wallet as anchor.Wallet;
  const viewer1 = anchor.web3.Keypair.generate();
  const viewer2 = anchor.web3.Keypair.generate();

  // Token configuration and stream config constants
  const TOKEN_DECIMALS = 6;
  const TOKEN_MULTIPLIER = 10 ** TOKEN_DECIMALS; // 1_000_000 for 6 decimals
  const TIP_BPS = 300; // 3% in basis points
  const PRECISION = 6; // align with token decimals for this test
  const LOCK_OFFSET_SECS = 3600; // 1 hour cutoff
  const GRACE_PERIOD_SECS = 600; // 10 minutes

  let tokenMint: anchor.web3.PublicKey;
  let creatorTokenAccount: anchor.web3.PublicKey;
  let viewer1TokenAccount: anchor.web3.PublicKey;
  let viewer2TokenAccount: anchor.web3.PublicKey;

  const streamId = new BN(Date.now());
  let streamPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;

  before("Setup: Create token mint and fund accounts", async () => {
    // Airdrop SOL to viewers
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        viewer1.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL,
      ),
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        viewer2.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL,
      ),
    );

    // Airdrop SOL to creator (payer) to cover mint fees
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        creator.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL,
      ),
    );

    // Create SPL token mint
    tokenMint = await createMint(
      provider.connection,
      creator.payer,
      creator.publicKey,
      null,
      6, // 6 decimals
    );

    console.log("Token Mint:", tokenMint.toBase58());

    // Create token accounts for creator and viewers (ensure ATAs exist)
    const creatorAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      tokenMint,
      creator.publicKey,
    );
    creatorTokenAccount = creatorAta.address;

    const viewer1Ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      tokenMint,
      viewer1.publicKey,
    );
    viewer1TokenAccount = viewer1Ata.address;

    const viewer2Ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      tokenMint,
      viewer2.publicKey,
    );
    viewer2TokenAccount = viewer2Ata.address;

    // Mint tokens to viewers for testing (1000 tokens each)
    await mintTo(
      provider.connection,
      creator.payer,
      tokenMint,
      viewer1TokenAccount,
      creator.publicKey,
      1000 * TOKEN_MULTIPLIER, // 1000 tokens with 6 decimals
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );

    await mintTo(
      provider.connection,
      creator.payer,
      tokenMint,
      viewer2TokenAccount,
      creator.publicKey,
      1000 * TOKEN_MULTIPLIER,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );

    console.log("Tokens minted to viewers");

    // Derive PDAs
    [streamPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPda.toBuffer()],
      program.programId,
    );

    vaultTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      vaultPda,
      true, // allowOwnerOffCurve = true for PDA
    );

    console.log("Stream PDA:", streamPda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());
    console.log("Vault Token Account:", vaultTokenAccount.toBase58());
  });

  it("✅ Task 1 & 2: Creates stream and initializes token vault", async () => {
    const title = "Phase 2 Test Stream";
    const startTime = new BN(Math.floor(Date.now() / 1000));

    // Create stream
    await program.methods
      .createStream(
        streamId,
        title,
        startTime,
        new BN(LOCK_OFFSET_SECS),
        TIP_BPS,
        PRECISION,
        new BN(GRACE_PERIOD_SECS),
      )
      .accounts({
        stream: streamPda,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Activate to freeze config (optional but aligns with Phase 2.5)
    await program.methods
      .activateStream()
      .accounts({
        stream: streamPda,
        creator: creator.publicKey,
      })
      .rpc();

    const streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.creator.toString()).to.equal(
      creator.publicKey.toString(),
    );
    expect(streamAccount.isActive).to.be.true;
    console.log("✓ Stream created successfully");

    // Initialize token vault
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
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const vaultAccount = await program.account.tokenVault.fetch(vaultPda);
    expect(vaultAccount.stream.toString()).to.equal(streamPda.toString());
    expect(vaultAccount.tokenAccount.toString()).to.equal(
      vaultTokenAccount.toString(),
    );
    console.log("✓ Token vault initialized successfully");

    // Verify vault token account was created
    const vaultTokenAccountInfo = await getAccount(
      provider.connection,
      vaultTokenAccount,
    );
    expect(vaultTokenAccountInfo.mint.toString()).to.equal(
      tokenMint.toString(),
    );
    expect(vaultTokenAccountInfo.owner.toString()).to.equal(
      vaultPda.toString(),
    );
    console.log("✓ Vault token account verified");
  });

  it("✅ Task 3: Joins stream (no stake transfer)", async () => {
    const stakeAmount = new BN(10 * TOKEN_MULTIPLIER); // 10 tokens (ignored on join)

    const [participantPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant"),
        streamPda.toBuffer(),
        viewer1.publicKey.toBuffer(),
      ],
      program.programId,
    );

    await program.methods
      .joinStream(stakeAmount)
      .accounts({
        stream: streamPda,
        participant: participantPda,
        viewer: viewer1.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer1])
      .rpc();

    // Verify participant account (no stake recorded on join)
    const participantAccount =
      await program.account.participant.fetch(participantPda);
    expect(participantAccount.stakeAmount.toString()).to.equal("0");
    console.log("✓ Participant joined without staking (as expected)");
  });

  it("✅ Task 3: Submits prediction with SPL token stake", async () => {
    const choice = 1;
    const stakeAmount = new BN(20 * TOKEN_MULTIPLIER); // 20 tokens

    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const viewer2BalanceBefore = await getAccount(
      provider.connection,
      viewer2TokenAccount,
    );
    const vaultBalanceBefore = await getAccount(
      provider.connection,
      vaultTokenAccount,
    );

    await program.methods
      .submitPrediction(choice, stakeAmount)
      .accounts({
        stream: streamPda,
        prediction: predictionPda,
        vault: vaultPda,
        viewerTokenAccount: viewer2TokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        viewer: viewer2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer2])
      .rpc();

    // Verify prediction account
    const predictionAccount =
      await program.account.prediction.fetch(predictionPda);
    expect(predictionAccount.choice).to.equal(choice);
    expect(predictionAccount.stakeAmount.toString()).to.equal(
      stakeAmount.toString(),
    );
    expect(predictionAccount.rewardClaimed).to.be.false;
    console.log("✓ Prediction submitted");

    // Verify tokens transferred
    const viewer2BalanceAfter = await getAccount(
      provider.connection,
      viewer2TokenAccount,
    );
    const vaultBalanceAfter = await getAccount(
      provider.connection,
      vaultTokenAccount,
    );

    expect(viewer2BalanceBefore.amount - viewer2BalanceAfter.amount).to.equal(
      BigInt(stakeAmount.toString()),
    );
    expect(vaultBalanceAfter.amount - vaultBalanceBefore.amount).to.equal(
      BigInt(stakeAmount.toString()),
    );
    console.log("✓ Prediction stake transferred to vault");
  });

  it("✅ Task 4: Ends stream and resolves prediction", async () => {
    // End the stream
    await program.methods
      .endStream()
      .accounts({
        stream: streamPda,
        creator: creator.publicKey,
      })
      .rpc();

    let streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.isActive).to.be.false;
    console.log("✓ Stream ended");

    // Capture creator ATA balance before tip
    const creatorBalanceBefore = await getAccount(
      provider.connection,
      creatorTokenAccount,
    );

    // Resolve prediction with winning choice
    const winningChoice = 1;
    await program.methods
      .resolvePrediction(winningChoice)
      .accounts({
        stream: streamPda,
        creator: creator.publicKey,
        vault: vaultPda,
        creatorTokenAccount: creatorTokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.isResolved).to.be.true;
    expect(streamAccount.winningChoice).to.equal(winningChoice);

    // Verify streamer tip credited
    const creatorBalanceAfter = await getAccount(
      provider.connection,
      creatorTokenAccount,
    );
    const tipCredited =
      creatorBalanceAfter.amount - creatorBalanceBefore.amount;
    expect(Number(tipCredited)).to.be.greaterThan(0);
    console.log("✓ Prediction resolved with winning choice:", winningChoice);
    console.log(
      "✓ Streamer tip credited:",
      Number(tipCredited) / TOKEN_MULTIPLIER,
      "tokens",
    );
  });

  it("✅ Task 5: Claims reward with SPL token transfer", async () => {
    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const viewer2BalanceBefore = await getAccount(
      provider.connection,
      viewer2TokenAccount,
    );
    const vaultBalanceBefore = await getAccount(
      provider.connection,
      vaultTokenAccount,
    );

    await program.methods
      .claimReward()
      .accounts({
        prediction: predictionPda,
        stream: streamPda,
        vault: vaultPda,
        viewerTokenAccount: viewer2TokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        viewer: viewer2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer2])
      .rpc();

    // Verify reward claimed flag
    const predictionAccount =
      await program.account.prediction.fetch(predictionPda);
    expect(predictionAccount.rewardClaimed).to.be.true;
    console.log("✓ Reward claimed flag set");

    // Verify tokens transferred from vault to winner
    const viewer2BalanceAfter = await getAccount(
      provider.connection,
      viewer2TokenAccount,
    );
    const vaultBalanceAfter = await getAccount(
      provider.connection,
      vaultTokenAccount,
    );

    // Compute expected reward after tip deduction
    const tipAmount = Math.floor(
      (predictionAccount.stakeAmount.toNumber() * TIP_BPS) / 10_000,
    );
    const rewardAmount = predictionAccount.stakeAmount.toNumber() - tipAmount;

    expect(viewer2BalanceAfter.amount - viewer2BalanceBefore.amount).to.equal(
      BigInt(rewardAmount),
    );
    expect(vaultBalanceBefore.amount - vaultBalanceAfter.amount).to.equal(
      BigInt(rewardAmount),
    );
    console.log("✓ Reward tokens transferred successfully");
    console.log(`  Reward amount: ${rewardAmount / TOKEN_MULTIPLIER} tokens`);
    console.log(`  Tip amount: ${tipAmount / TOKEN_MULTIPLIER} tokens`);
  });

  it("❌ Should fail: Double claim prevention", async () => {
    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId,
    );

    try {
      await program.methods
        .claimReward()
        .accounts({
          prediction: predictionPda,
          stream: streamPda,
          vault: vaultPda,
          viewerTokenAccount: viewer2TokenAccount,
          vaultTokenAccount: vaultTokenAccount,
          viewer: viewer2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([viewer2])
        .rpc();

      expect.fail("Should have thrown error for double claim");
    } catch (e: any) {
      expect(String(e)).to.include("RewardAlreadyClaimed");
      console.log("✓ Double claim prevented correctly");
    }
  });

  it("❌ Should fail: Claim with incorrect prediction", async () => {
    // viewer1 didn't win (no prediction or wrong choice)
    // Try to create a losing prediction scenario
    const streamId2 = new BN(Date.now() + 1);

    const [streamPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId2.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    const [vaultPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPda2.toBuffer()],
      program.programId,
    );

    const vaultTokenAccount2 = await getAssociatedTokenAddress(
      tokenMint,
      vaultPda2,
      true,
    );

    // Create new stream
    await program.methods
      .createStream(
        streamId2,
        "Test Stream 2",
        new BN(Math.floor(Date.now() / 1000)),
      )
      .accounts({
        stream: streamPda2,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Initialize vault
    await program.methods
      .initializeTokenVault()
      .accounts({
        creator: creator.publicKey,
        stream: streamPda2,
        vault: vaultPda2,
        tokenMint: tokenMint,
        vaultTokenAccount: vaultTokenAccount2,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Submit losing prediction
    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda2.toBuffer(),
        viewer1.publicKey.toBuffer(),
      ],
      program.programId,
    );

    await program.methods
      .submitPrediction(2, new BN(5 * TOKEN_MULTIPLIER)) // Choice 2
      .accounts({
        stream: streamPda2,
        prediction: predictionPda,
        vault: vaultPda2,
        viewerTokenAccount: viewer1TokenAccount,
        vaultTokenAccount: vaultTokenAccount2,
        viewer: viewer1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer1])
      .rpc();

    // End and resolve with different winning choice
    await program.methods
      .endStream()
      .accounts({
        stream: streamPda2,
        creator: creator.publicKey,
      })
      .rpc();

    await program.methods
      .resolvePrediction(1) // Winning choice is 1, not 2
      .accounts({
        stream: streamPda2,
        creator: creator.publicKey,
      })
      .rpc();

    // Try to claim with wrong prediction
    try {
      await program.methods
        .claimReward()
        .accounts({
          prediction: predictionPda,
          stream: streamPda2,
          vault: vaultPda2,
          viewerTokenAccount: viewer1TokenAccount,
          vaultTokenAccount: vaultTokenAccount2,
          viewer: viewer1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([viewer1])
        .rpc();

      expect.fail("Should have thrown error for incorrect prediction");
    } catch (e: any) {
      expect(String(e)).to.include("NotWinner");
      console.log("✓ Incorrect prediction claim prevented");
    }
  });

  it("✅ Multiple winners: proportional distribution with tip", async () => {
    // New stream for isolation
    const streamIdMW = new BN(Date.now() + 100);
    const [streamPdaMW] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamIdMW.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );
    const [vaultPdaMW] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPdaMW.toBuffer()],
      program.programId,
    );
    const vaultTokenAccountMW = await getAssociatedTokenAddress(
      tokenMint,
      vaultPdaMW,
      true,
    );

    // Create + activate + init vault
    await program.methods
      .createStream(
        streamIdMW,
        "MW Stream",
        new BN(Math.floor(Date.now() / 1000)),
        new BN(LOCK_OFFSET_SECS),
        TIP_BPS,
        PRECISION,
        new BN(GRACE_PERIOD_SECS),
      )
      .accounts({
        stream: streamPdaMW,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .activateStream()
      .accounts({
        stream: streamPdaMW,
        creator: creator.publicKey,
      })
      .rpc();

    await program.methods
      .initializeTokenVault()
      .accounts({
        creator: creator.publicKey,
        stream: streamPdaMW,
        vault: vaultPdaMW,
        tokenMint: tokenMint,
        vaultTokenAccount: vaultTokenAccountMW,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Stakes: viewer1 = 10, viewer2 = 30
    const s1 = new BN(10 * TOKEN_MULTIPLIER);
    const s2 = new BN(30 * TOKEN_MULTIPLIER);

    const [predPda1] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPdaMW.toBuffer(),
        viewer1.publicKey.toBuffer(),
      ],
      program.programId,
    );
    const [predPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPdaMW.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId,
    );

    // viewer1 prediction
    await program.methods
      .submitPrediction(1, s1)
      .accounts({
        stream: streamPdaMW,
        prediction: predPda1,
        vault: vaultPdaMW,
        viewerTokenAccount: viewer1TokenAccount,
        vaultTokenAccount: vaultTokenAccountMW,
        viewer: viewer1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer1])
      .rpc();

    // viewer2 prediction
    await program.methods
      .submitPrediction(1, s2)
      .accounts({
        stream: streamPdaMW,
        prediction: predPda2,
        vault: vaultPdaMW,
        viewerTokenAccount: viewer2TokenAccount,
        vaultTokenAccount: vaultTokenAccountMW,
        viewer: viewer2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer2])
      .rpc();

    // End and resolve
    await program.methods
      .endStream()
      .accounts({
        stream: streamPdaMW,
        creator: creator.publicKey,
      })
      .rpc();

    const creatorBalanceBeforeMW = await getAccount(
      provider.connection,
      creatorTokenAccount,
    );

    await program.methods
      .resolvePrediction(1)
      .accounts({
        stream: streamPdaMW,
        creator: creator.publicKey,
        vault: vaultPdaMW,
        creatorTokenAccount: creatorTokenAccount,
        vaultTokenAccount: vaultTokenAccountMW,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const creatorBalanceAfterMW = await getAccount(
      provider.connection,
      creatorTokenAccount,
    );

    // Expect tip = floor((s1+s2) * TIP_PERCENT / 100)
    const totalStake = s1.toNumber() + s2.toNumber();
    const tipAmountMW = Math.floor((totalStake * TIP_BPS) / 10_000);
    expect(
      creatorBalanceAfterMW.amount - creatorBalanceBeforeMW.amount,
    ).to.equal(BigInt(tipAmountMW));

    // Claim rewards for both
    const v1Before = await getAccount(provider.connection, viewer1TokenAccount);
    const v2Before = await getAccount(provider.connection, viewer2TokenAccount);
    const vaultBeforeMW = await getAccount(
      provider.connection,
      vaultTokenAccountMW,
    );

    await program.methods
      .claimReward()
      .accounts({
        prediction: predPda1,
        stream: streamPdaMW,
        vault: vaultPdaMW,
        viewerTokenAccount: viewer1TokenAccount,
        vaultTokenAccount: vaultTokenAccountMW,
        viewer: viewer1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer1])
      .rpc();

    await program.methods
      .claimReward()
      .accounts({
        prediction: predPda2,
        stream: streamPdaMW,
        vault: vaultPdaMW,
        viewerTokenAccount: viewer2TokenAccount,
        vaultTokenAccount: vaultTokenAccountMW,
        viewer: viewer2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer2])
      .rpc();

    const v1After = await getAccount(provider.connection, viewer1TokenAccount);
    const v2After = await getAccount(provider.connection, viewer2TokenAccount);
    const vaultAfterMW = await getAccount(
      provider.connection,
      vaultTokenAccountMW,
    );

    // Distributable = totalStake - tip
    const distributable = totalStake - tipAmountMW;
    const totalWinner = totalStake;
    const r1 = Math.floor(distributable * (s1.toNumber() / totalWinner));
    const r2 = Math.floor(distributable * (s2.toNumber() / totalWinner));

    expect(v1After.amount - v1Before.amount).to.equal(BigInt(r1));
    expect(v2After.amount - v2Before.amount).to.equal(BigInt(r2));
    expect(vaultBeforeMW.amount - vaultAfterMW.amount).to.equal(
      BigInt(r1 + r2),
    );
    console.log("✓ Multiple winners distributed proportionally with tip");
  });

  it("✅ Cancel and refund returns full stake", async () => {
    // New stream for cancel/refund
    const streamIdCR = new BN(Date.now() + 200);
    const [streamPdaCR] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamIdCR.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );
    const [vaultPdaCR] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPdaCR.toBuffer()],
      program.programId,
    );
    const vaultTokenAccountCR = await getAssociatedTokenAddress(
      tokenMint,
      vaultPdaCR,
      true,
    );

    // Create + activate + init vault
    await program.methods
      .createStream(
        streamIdCR,
        "CR Stream",
        new BN(Math.floor(Date.now() / 1000)),
        new BN(LOCK_OFFSET_SECS),
        TIP_BPS,
        PRECISION,
        new BN(GRACE_PERIOD_SECS),
      )
      .accounts({
        stream: streamPdaCR,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .activateStream()
      .accounts({
        stream: streamPdaCR,
        creator: creator.publicKey,
      })
      .rpc();

    await program.methods
      .initializeTokenVault()
      .accounts({
        creator: creator.publicKey,
        stream: streamPdaCR,
        vault: vaultPdaCR,
        tokenMint: tokenMint,
        vaultTokenAccount: vaultTokenAccountCR,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // viewer1 stakes
    const sRefund = new BN(7 * TOKEN_MULTIPLIER);
    const [predPdaCR] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPdaCR.toBuffer(),
        viewer1.publicKey.toBuffer(),
      ],
      program.programId,
    );

    await program.methods
      .submitPrediction(2, sRefund)
      .accounts({
        stream: streamPdaCR,
        prediction: predPdaCR,
        vault: vaultPdaCR,
        viewerTokenAccount: viewer1TokenAccount,
        vaultTokenAccount: vaultTokenAccountCR,
        viewer: viewer1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer1])
      .rpc();

    // Cancel stream
    await program.methods
      .cancelStream()
      .accounts({
        stream: streamPdaCR,
        creator: creator.publicKey,
      })
      .rpc();

    // Refund claim
    const v1BeforeCR = await getAccount(
      provider.connection,
      viewer1TokenAccount,
    );
    const vaultBeforeCR = await getAccount(
      provider.connection,
      vaultTokenAccountCR,
    );

    await program.methods
      .claimRefund()
      .accounts({
        prediction: predPdaCR,
        stream: streamPdaCR,
        vault: vaultPdaCR,
        viewerTokenAccount: viewer1TokenAccount,
        vaultTokenAccount: vaultTokenAccountCR,
        viewer: viewer1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer1])
      .rpc();

    const v1AfterCR = await getAccount(
      provider.connection,
      viewer1TokenAccount,
    );
    const vaultAfterCR = await getAccount(
      provider.connection,
      vaultTokenAccountCR,
    );

    expect(v1AfterCR.amount - v1BeforeCR.amount).to.equal(
      BigInt(sRefund.toNumber()),
    );
    expect(vaultBeforeCR.amount - vaultAfterCR.amount).to.equal(
      BigInt(sRefund.toNumber()),
    );
    console.log("✓ Cancel and refund returned full stake");
  });

  it("✅ Community vault init emits event", async () => {
    // Derive PDA and ATA for community vault
    const [communityVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("community_vault")],
      program.programId,
    );
    const communityVaultTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      communityVaultPda,
      true,
    );

    // Listen for event
    // Wait for CommunityVaultInitialized with a timeout to avoid hanging tests
    const waitCvInit = waitForEvent(
      program,
      "CommunityVaultInitialized",
      15000,
    );

    // Initialize community vault (use creator as dao authority for now)
    await program.methods
      .initializeCommunityVault()
      .accounts({
        creator: creator.publicKey,
        daoAuthority: creator.publicKey,
        communityVault: communityVaultPda,
        tokenMint,
        communityVaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const { ev } = await waitCvInit;

    expect(ev).to.have.property("authority");
    expect(ev).to.have.property("mint");
    expect(ev).to.have.property("tokenAccount");
    expect(ev.authority.toString()).to.equal(creator.publicKey.toString());
    expect(ev.mint.toString()).to.equal(tokenMint.toString());
    expect(ev.tokenAccount.toString()).to.equal(
      communityVaultTokenAccount.toString(),
    );
    console.log("✓ CommunityVaultInitialized event received");
  });

  it("✅ Events emitted on submit/resolve/claim", async () => {
    // Fresh stream for event flow
    const streamIdEV = new BN(Date.now() + 300);
    const [streamPdaEV] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamIdEV.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );
    const [vaultPdaEV] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPdaEV.toBuffer()],
      program.programId,
    );
    const vaultTokenAccountEV = await getAssociatedTokenAddress(
      tokenMint,
      vaultPdaEV,
      true,
    );

    // Create + activate + init vault
    await program.methods
      .createStream(
        streamIdEV,
        "Events Stream",
        new BN(Math.floor(Date.now() / 1000)),
        new BN(LOCK_OFFSET_SECS),
        TIP_BPS,
        PRECISION,
        new BN(GRACE_PERIOD_SECS),
      )
      .accounts({
        stream: streamPdaEV,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .activateStream()
      .accounts({
        stream: streamPdaEV,
        creator: creator.publicKey,
      })
      .rpc();

    await program.methods
      .initializeTokenVault()
      .accounts({
        creator: creator.publicKey,
        stream: streamPdaEV,
        vault: vaultPdaEV,
        tokenMint,
        vaultTokenAccount: vaultTokenAccountEV,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // 1) PredictionSubmitted event
    const submitStake = new BN(9 * TOKEN_MULTIPLIER);
    const [predictionPdaEV] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPdaEV.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const waitPredSubmitted = waitForEvent(
      program,
      "PredictionSubmitted",
      15000,
    );

    await program.methods
      .submitPrediction(1, submitStake)
      .accounts({
        stream: streamPdaEV,
        prediction: predictionPdaEV,
        vault: vaultPdaEV,
        viewerTokenAccount: viewer2TokenAccount,
        vaultTokenAccount: vaultTokenAccountEV,
        viewer: viewer2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer2])
      .rpc();

    {
      const { ev } = await waitPredSubmitted;
      expect(ev.stream.toString()).to.equal(streamPdaEV.toString());
      expect(ev.viewer.toString()).to.equal(viewer2.publicKey.toString());
      expect(ev.choice).to.equal(1);
      expect(Number(ev.amount)).to.equal(submitStake.toNumber());
      console.log("✓ PredictionSubmitted event received");
    }

    // End stream
    await program.methods
      .endStream()
      .accounts({
        stream: streamPdaEV,
        creator: creator.publicKey,
      })
      .rpc();

    // 2) StreamResolved event
    const waitResolved = waitForEvent(program, "StreamResolved", 15000);

    await program.methods
      .resolvePrediction(1)
      .accounts({
        stream: streamPdaEV,
        creator: creator.publicKey,
        vault: vaultPdaEV,
        creatorTokenAccount: creatorTokenAccount,
        vaultTokenAccount: vaultTokenAccountEV,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    {
      const { ev } = await waitResolved;
      expect(ev.stream.toString()).to.equal(streamPdaEV.toString());
      expect(ev.winningChoice).to.equal(1);
      expect(Number(ev.tipAmount)).to.be.greaterThanOrEqual(0);
      console.log("✓ StreamResolved event received");
    }

    // 3) RewardClaimed event
    const waitClaimed = waitForEvent(program, "RewardClaimed", 15000);

    await program.methods
      .claimReward()
      .accounts({
        prediction: predictionPdaEV,
        stream: streamPdaEV,
        vault: vaultPdaEV,
        viewerTokenAccount: viewer2TokenAccount,
        vaultTokenAccount: vaultTokenAccountEV,
        viewer: viewer2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer2])
      .rpc();

    {
      const { ev } = await waitClaimed;
      expect(ev.stream.toString()).to.equal(streamPdaEV.toString());
      expect(ev.viewer.toString()).to.equal(viewer2.publicKey.toString());
      expect(Number(ev.amount)).to.be.greaterThan(0);
      console.log("✓ RewardClaimed event received");
    }
  });

  it("❌ No-winner: claim should fail when no prediction matches winning choice", async () => {
    // New stream where no one predicts the winning choice
    const streamIdNW = new BN(Date.now() + 400);
    const [streamPdaNW] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamIdNW.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );
    const [vaultPdaNW] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPdaNW.toBuffer()],
      program.programId,
    );
    const vaultTokenAccountNW = await getAssociatedTokenAddress(
      tokenMint,
      vaultPdaNW,
      true,
    );

    // Create + activate + init vault
    await program.methods
      .createStream(
        streamIdNW,
        "NoWinner Stream",
        new BN(Math.floor(Date.now() / 1000)),
        new BN(LOCK_OFFSET_SECS),
        TIP_BPS,
        PRECISION,
        new BN(GRACE_PERIOD_SECS),
      )
      .accounts({
        stream: streamPdaNW,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .activateStream()
      .accounts({
        stream: streamPdaNW,
        creator: creator.publicKey,
      })
      .rpc();

    await program.methods
      .initializeTokenVault()
      .accounts({
        creator: creator.publicKey,
        stream: streamPdaNW,
        vault: vaultPdaNW,
        tokenMint,
        vaultTokenAccount: vaultTokenAccountNW,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Submit prediction on losing choice (2)
    const sNW = new BN(4 * TOKEN_MULTIPLIER);
    const [predictionPdaNW] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPdaNW.toBuffer(),
        viewer1.publicKey.toBuffer(),
      ],
      program.programId,
    );

    await program.methods
      .submitPrediction(2, sNW)
      .accounts({
        stream: streamPdaNW,
        prediction: predictionPdaNW,
        vault: vaultPdaNW,
        viewerTokenAccount: viewer1TokenAccount,
        vaultTokenAccount: vaultTokenAccountNW,
        viewer: viewer1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer1])
      .rpc();

    // End and resolve with choice 1 (no winners)
    await program.methods
      .endStream()
      .accounts({
        stream: streamPdaNW,
        creator: creator.publicKey,
      })
      .rpc();

    await program.methods
      .resolvePrediction(1)
      .accounts({
        stream: streamPdaNW,
        creator: creator.publicKey,
        vault: vaultPdaNW,
        creatorTokenAccount: creatorTokenAccount,
        vaultTokenAccount: vaultTokenAccountNW,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Attempt to claim (should fail because this prediction is not a winner)
    try {
      await program.methods
        .claimReward()
        .accounts({
          prediction: predictionPdaNW,
          stream: streamPdaNW,
          vault: vaultPdaNW,
          viewerTokenAccount: viewer1TokenAccount,
          vaultTokenAccount: vaultTokenAccountNW,
          viewer: viewer1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([viewer1])
        .rpc();
      expect.fail("Should have thrown error for no-winner scenario");
    } catch (e: any) {
      // Since prediction choice != winning choice, expect NotWinner
      expect(String(e)).to.include("NotWinner");
      console.log("✓ No-winner claim prevented (NotWinner)");
    }
  });

  it("❌ Auto-lock: submit prediction rejected after cutoff", async () => {
    // Create stream already past cutoff
    const streamIdLock = new BN(Date.now() + 500);
    const [streamPdaLock] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamIdLock.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );
    const [vaultPdaLock] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPdaLock.toBuffer()],
      program.programId,
    );
    const vaultTokenAccountLock = await getAssociatedTokenAddress(
      tokenMint,
      vaultPdaLock,
      true,
    );

    // start_time set to past, lock_offset_secs = 1 -> locked immediately
    const pastStart = new BN(Math.floor(Date.now() / 1000) - 100);
    await program.methods
      .createStream(
        streamIdLock,
        "AutoLock Stream",
        pastStart,
        new BN(1), // 1 second offset
        TIP_BPS,
        PRECISION,
        new BN(GRACE_PERIOD_SECS),
      )
      .accounts({
        stream: streamPdaLock,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .activateStream()
      .accounts({
        stream: streamPdaLock,
        creator: creator.publicKey,
      })
      .rpc();

    await program.methods
      .initializeTokenVault()
      .accounts({
        creator: creator.publicKey,
        stream: streamPdaLock,
        vault: vaultPdaLock,
        tokenMint,
        vaultTokenAccount: vaultTokenAccountLock,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Try to submit prediction after cutoff
    const [predictionPdaLock] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPdaLock.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId,
    );

    try {
      await program.methods
        .submitPrediction(1, new BN(2 * TOKEN_MULTIPLIER))
        .accounts({
          stream: streamPdaLock,
          prediction: predictionPdaLock,
          vault: vaultPdaLock,
          viewerTokenAccount: viewer2TokenAccount,
          vaultTokenAccount: vaultTokenAccountLock,
          viewer: viewer2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([viewer2])
        .rpc();
      expect.fail("Should have thrown error for locked stream");
    } catch (e: any) {
      expect(String(e)).to.include("StreamLocked");
      console.log("✓ Auto-lock prevented late prediction submission");
    }
  });

  it("📊 Summary: Verify final vault balance", async () => {
    const vaultBalance = await getAccount(
      provider.connection,
      vaultTokenAccount,
    );

    console.log("\n=== Phase 2.5 Test Summary ===");
    console.log(
      `Vault balance: ${vaultBalance.amount.toString()} (${Number(vaultBalance.amount) / TOKEN_MULTIPLIER} tokens)`,
    );
    console.log("✓ All Phase 2.5 tasks completed successfully!");
  });
});
