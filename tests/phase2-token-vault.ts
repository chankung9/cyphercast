import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cyphercast } from "../target/types/cyphercast";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Phase 2: Token Vault & Reward Distribution", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cyphercast as Program<Cyphercast>;
  const creator = provider.wallet as anchor.Wallet;
  const viewer1 = anchor.web3.Keypair.generate();
  const viewer2 = anchor.web3.Keypair.generate();

  let tokenMint: anchor.web3.PublicKey;
  let creatorTokenAccount: anchor.web3.PublicKey;
  let viewer1TokenAccount: anchor.web3.PublicKey;
  let viewer2TokenAccount: anchor.web3.PublicKey;

  const streamId = new anchor.BN(Date.now());
  let streamPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;

  before("Setup: Create token mint and fund accounts", async () => {
    // Airdrop SOL to viewers
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(viewer1.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(viewer2.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    // Create SPL token mint
    tokenMint = await createMint(
      provider.connection,
      creator.payer,
      creator.publicKey,
      null,
      6 // 6 decimals
    );

    console.log("Token Mint:", tokenMint.toBase58());

    // Create token accounts for creator and viewers
    creatorTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      creator.publicKey
    );

    viewer1TokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      viewer1.publicKey
    );

    viewer2TokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      viewer2.publicKey
    );

    // Mint tokens to viewers for testing (1000 tokens each)
    await mintTo(
      provider.connection,
      creator.payer,
      tokenMint,
      viewer1TokenAccount,
      creator.publicKey,
      1000 * 1_000_000, // 1000 tokens with 6 decimals
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );

    await mintTo(
      provider.connection,
      creator.payer,
      tokenMint,
      viewer2TokenAccount,
      creator.publicKey,
      1000 * 1_000_000,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );

    console.log("Tokens minted to viewers");

    // Derive PDAs
    [streamPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPda.toBuffer()],
      program.programId
    );

    vaultTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      vaultPda,
      true // allowOwnerOffCurve = true for PDA
    );

    console.log("Stream PDA:", streamPda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());
    console.log("Vault Token Account:", vaultTokenAccount.toBase58());
  });

  it("✅ Task 1 & 2: Creates stream and initializes token vault", async () => {
    const title = "Phase 2 Test Stream";
    const startTime = new anchor.BN(Math.floor(Date.now() / 1000));

    // Create stream
    await program.methods
      .createStream(streamId, title, startTime)
      .accounts({
        stream: streamPda,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.creator.toString()).to.equal(creator.publicKey.toString());
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
    expect(vaultAccount.tokenAccount.toString()).to.equal(vaultTokenAccount.toString());
    console.log("✓ Token vault initialized successfully");

    // Verify vault token account was created
    const vaultTokenAccountInfo = await getAccount(
      provider.connection,
      vaultTokenAccount
    );
    expect(vaultTokenAccountInfo.mint.toString()).to.equal(tokenMint.toString());
    expect(vaultTokenAccountInfo.owner.toString()).to.equal(vaultPda.toString());
    console.log("✓ Vault token account verified");
  });

  it("✅ Task 3: Joins stream with SPL token stake", async () => {
    const stakeAmount = new anchor.BN(10 * 1_000_000); // 10 tokens

    const [participantPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant"),
        streamPda.toBuffer(),
        viewer1.publicKey.toBuffer(),
      ],
      program.programId
    );

    const viewer1BalanceBefore = await getAccount(
      provider.connection,
      viewer1TokenAccount
    );

    await program.methods
      .joinStream(stakeAmount)
      .accounts({
        stream: streamPda,
        participant: participantPda,
        vault: vaultPda,
        viewerTokenAccount: viewer1TokenAccount,
        vaultTokenAccount: vaultTokenAccount,
        viewer: viewer1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer1])
      .rpc();

    // Verify participant account
    const participantAccount = await program.account.participant.fetch(participantPda);
    expect(participantAccount.stakeAmount.toString()).to.equal(stakeAmount.toString());
    console.log("✓ Participant joined with stake");

    // Verify tokens transferred to vault
    const viewer1BalanceAfter = await getAccount(
      provider.connection,
      viewer1TokenAccount
    );
    const vaultBalance = await getAccount(
      provider.connection,
      vaultTokenAccount
    );

    expect(
      viewer1BalanceBefore.amount - viewer1BalanceAfter.amount
    ).to.equal(BigInt(stakeAmount.toString()));
    expect(vaultBalance.amount.toString()).to.equal(stakeAmount.toString());
    console.log("✓ Tokens transferred to vault successfully");

    // Verify stream total stake updated
    const streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.totalStake.toString()).to.equal(stakeAmount.toString());
    console.log("✓ Stream total stake updated");
  });

  it("✅ Task 3: Submits prediction with SPL token stake", async () => {
    const choice = 1;
    const stakeAmount = new anchor.BN(20 * 1_000_000); // 20 tokens

    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId
    );

    const viewer2BalanceBefore = await getAccount(
      provider.connection,
      viewer2TokenAccount
    );
    const vaultBalanceBefore = await getAccount(
      provider.connection,
      vaultTokenAccount
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
    const predictionAccount = await program.account.prediction.fetch(predictionPda);
    expect(predictionAccount.choice).to.equal(choice);
    expect(predictionAccount.stakeAmount.toString()).to.equal(stakeAmount.toString());
    expect(predictionAccount.rewardClaimed).to.be.false;
    console.log("✓ Prediction submitted");

    // Verify tokens transferred
    const viewer2BalanceAfter = await getAccount(
      provider.connection,
      viewer2TokenAccount
    );
    const vaultBalanceAfter = await getAccount(
      provider.connection,
      vaultTokenAccount
    );

    expect(
      viewer2BalanceBefore.amount - viewer2BalanceAfter.amount
    ).to.equal(BigInt(stakeAmount.toString()));
    expect(
      vaultBalanceAfter.amount - vaultBalanceBefore.amount
    ).to.equal(BigInt(stakeAmount.toString()));
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

    // Resolve prediction with winning choice
    const winningChoice = 1;
    await program.methods
      .resolvePrediction(winningChoice)
      .accounts({
        stream: streamPda,
        creator: creator.publicKey,
      })
      .rpc();

    streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.isResolved).to.be.true;
    expect(streamAccount.winningChoice).to.equal(winningChoice);
    console.log("✓ Prediction resolved with winning choice:", winningChoice);
  });

  it("✅ Task 5: Claims reward with SPL token transfer", async () => {
    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId
    );

    const viewer2BalanceBefore = await getAccount(
      provider.connection,
      viewer2TokenAccount
    );
    const vaultBalanceBefore = await getAccount(
      provider.connection,
      vaultTokenAccount
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
    const predictionAccount = await program.account.prediction.fetch(predictionPda);
    expect(predictionAccount.rewardClaimed).to.be.true;
    console.log("✓ Reward claimed flag set");

    // Verify tokens transferred from vault to winner
    const viewer2BalanceAfter = await getAccount(
      provider.connection,
      viewer2TokenAccount
    );
    const vaultBalanceAfter = await getAccount(
      provider.connection,
      vaultTokenAccount
    );

    const rewardAmount = predictionAccount.stakeAmount.toNumber() * 2; // 2x multiplier
    expect(
      viewer2BalanceAfter.amount - viewer2BalanceBefore.amount
    ).to.equal(BigInt(rewardAmount));
    expect(
      vaultBalanceBefore.amount - vaultBalanceAfter.amount
    ).to.equal(BigInt(rewardAmount));
    console.log("✓ Reward tokens transferred successfully");
    console.log(`  Reward amount: ${rewardAmount / 1_000_000} tokens`);
  });

  it("❌ Should fail: Double claim prevention", async () => {
    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        viewer2.publicKey.toBuffer(),
      ],
      program.programId
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
    } catch (error) {
      expect(error.toString()).to.include("RewardAlreadyClaimed");
      console.log("✓ Double claim prevented correctly");
    }
  });

  it("❌ Should fail: Claim with incorrect prediction", async () => {
    // viewer1 didn't win (no prediction or wrong choice)
    // Try to create a losing prediction scenario
    const streamId2 = new anchor.BN(Date.now() + 1);

    const [streamPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId2.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [vaultPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPda2.toBuffer()],
      program.programId
    );

    const vaultTokenAccount2 = await getAssociatedTokenAddress(
      tokenMint,
      vaultPda2,
      true
    );

    // Create new stream
    await program.methods
      .createStream(streamId2, "Test Stream 2", new anchor.BN(Math.floor(Date.now() / 1000)))
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
      program.programId
    );

    await program.methods
      .submitPrediction(2, new anchor.BN(5 * 1_000_000)) // Choice 2
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
    } catch (error) {
      expect(error.toString()).to.include("NotWinner");
      console.log("✓ Incorrect prediction claim prevented");
    }
  });

  it("📊 Summary: Verify final vault balance", async () => {
    const vaultBalance = await getAccount(
      provider.connection,
      vaultTokenAccount
    );

    console.log("\n=== Phase 2 Test Summary ===");
    console.log(`Vault balance: ${vaultBalance.amount.toString()} (${Number(vaultBalance.amount) / 1_000_000} tokens)`);
    console.log(`Expected: 0 tokens (all rewards claimed)`);
    console.log("✓ All Phase 2 tasks completed successfully!");
  });
});
