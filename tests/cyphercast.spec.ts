import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// Note: removed dependency on generated types for CI stability
import { PublicKey } from "@solana/web3.js";

describe.skip("cyphercast (legacy lamports tests - skipped)", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cyphercast as any;

  it("Creates a stream", async () => {
    const streamId = new anchor.BN(Date.now());
    const title = "Test Gaming Stream";
    const startTime = new anchor.BN(Math.floor(Date.now() / 1000));

    // Derive stream PDA
    const [streamPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        provider.wallet.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    console.log("Creating stream...");
    console.log("Stream PDA:", streamPDA.toString());

    const tx = await program.methods
      .createStream(streamId, title, startTime)
      .accounts({
        stream: streamPDA,
        creator: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Transaction signature:", tx);

    // Fetch the created stream
    const streamAccount = await program.account.stream.fetch(streamPDA);
    console.log("Stream created:");
    console.log("  Creator:", streamAccount.creator.toString());
    console.log("  Title:", streamAccount.title);
    console.log("  Stream ID:", streamAccount.streamId.toString());
    console.log("  Active:", streamAccount.isActive);
  });

  it("Joins a stream", async () => {
    // Create a stream first
    const streamId = new anchor.BN(Date.now() + 1);
    const title = "Another Test Stream";
    const startTime = new anchor.BN(Math.floor(Date.now() / 1000));

    const [streamPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("stream"),
        provider.wallet.publicKey.toBuffer(),
        streamId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    await program.methods
      .createStream(streamId, title, startTime)
      .accounts({
        stream: streamPDA,
        creator: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Now join the stream
    const [participantPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant"),
        streamPDA.toBuffer(),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const stakeAmount = new anchor.BN(1000000); // 0.001 SOL

    console.log("Joining stream...");
    const joinTx = await program.methods
      .joinStream(stakeAmount)
      .accounts({
        stream: streamPDA,
        participant: participantPDA,
        viewer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Join transaction:", joinTx);

    // Fetch participant
    const participantAccount =
      await program.account.participant.fetch(participantPDA);
    console.log("Participant joined:");
    console.log("  Viewer:", participantAccount.viewer.toString());
    console.log("  Stake:", participantAccount.stakeAmount.toString());
  });
});
