import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cyphercast } from "../target/types/cyphercast";
import { expect } from "chai";

describe("cyphercast", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cyphercast as Program<Cyphercast>;
  const creator = provider.wallet as anchor.Wallet;
  const viewer = anchor.web3.Keypair.generate();

  it("Creates a stream", async () => {
    const streamId = new anchor.BN(1);
    const title = "Test Stream";
    const startTime = new anchor.BN(Date.now() / 1000);

    const [streamPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

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
    expect(streamAccount.title).to.equal(title);
    expect(streamAccount.isActive).to.be.true;
  });

  it("Joins a stream", async () => {
    const streamId = new anchor.BN(1);
    const stakeAmount = new anchor.BN(1000000); // 0.001 SOL in lamports

    // Airdrop SOL to viewer for testing
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(viewer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    const [streamPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [participantPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant"),
        streamPda.toBuffer(),
        viewer.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .joinStream(stakeAmount)
      .accounts({
        stream: streamPda,
        participant: participantPda,
        viewer: viewer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer])
      .rpc();

    const participantAccount = await program.account.participant.fetch(participantPda);
    expect(participantAccount.viewer.toString()).to.equal(viewer.publicKey.toString());
    expect(participantAccount.stakeAmount.toString()).to.equal(stakeAmount.toString());

    const streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.totalStake.toString()).to.equal(stakeAmount.toString());
  });

  it("Submits a prediction", async () => {
    const streamId = new anchor.BN(1);
    const choice = 1;
    const stakeAmount = new anchor.BN(500000); // 0.0005 SOL in lamports

    const [streamPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        viewer.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .submitPrediction(choice, stakeAmount)
      .accounts({
        stream: streamPda,
        prediction: predictionPda,
        viewer: viewer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([viewer])
      .rpc();

    const predictionAccount = await program.account.prediction.fetch(predictionPda);
    expect(predictionAccount.viewer.toString()).to.equal(viewer.publicKey.toString());
    expect(predictionAccount.choice).to.equal(choice);
    expect(predictionAccount.stakeAmount.toString()).to.equal(stakeAmount.toString());
    expect(predictionAccount.rewardClaimed).to.be.false;
  });

  it("Ends a stream", async () => {
    const streamId = new anchor.BN(1);

    const [streamPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        creator.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .endStream()
      .accounts({
        stream: streamPda,
        creator: creator.publicKey,
      })
      .rpc();

    const streamAccount = await program.account.stream.fetch(streamPda);
    expect(streamAccount.isActive).to.be.false;
    expect(streamAccount.endTime.toNumber()).to.be.greaterThan(0);
  });
});
