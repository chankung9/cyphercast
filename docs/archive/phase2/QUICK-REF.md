# Phase 2 Quick Reference Guide

## Using Token Vault & Reward System

### 1. Initialize Token Vault (After Creating Stream)

```typescript
import { getAssociatedTokenAddress } from "@solana/spl-token";

// Derive PDAs
const [streamPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("stream"),
    creator.publicKey.toBuffer(),
    streamId.toArrayLike(Buffer, "le", 8),
  ],
  program.programId
);

const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), streamPda.toBuffer()],
  program.programId
);

// Get vault's token account address
const vaultTokenAccount = await getAssociatedTokenAddress(
  tokenMint,
  vaultPda,
  true // allowOwnerOffCurve for PDA
);

// Initialize vault
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
```

---

### 2. Join Stream with Token Stake

```typescript
import { getAssociatedTokenAddress } from "@solana/spl-token";

const stakeAmount = new BN(10 * 1_000_000); // 10 tokens (6 decimals)

// Get viewer's token account
const viewerTokenAccount = await getAssociatedTokenAddress(
  tokenMint,
  viewer.publicKey
);

// Derive participant PDA
const [participantPda] = PublicKey.findProgramAddressSync(
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
    vault: vaultPda,
    viewerTokenAccount: viewerTokenAccount,
    vaultTokenAccount: vaultTokenAccount,
    viewer: viewer.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([viewer])
  .rpc();
```

---

### 3. Submit Prediction with Token Stake

```typescript
const choice = 1; // Prediction choice (0-10)
const stakeAmount = new BN(20 * 1_000_000); // 20 tokens

const viewerTokenAccount = await getAssociatedTokenAddress(
  tokenMint,
  viewer.publicKey
);

const [predictionPda] = PublicKey.findProgramAddressSync(
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
    vault: vaultPda,
    viewerTokenAccount: viewerTokenAccount,
    vaultTokenAccount: vaultTokenAccount,
    viewer: viewer.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([viewer])
  .rpc();
```

---

### 4. End Stream (Creator Only)

```typescript
await program.methods
  .endStream()
  .accounts({
    stream: streamPda,
    creator: creator.publicKey,
  })
  .rpc();
```

---

### 5. Resolve Prediction (Creator Only)

```typescript
const winningChoice = 1; // The correct answer

await program.methods
  .resolvePrediction(winningChoice)
  .accounts({
    stream: streamPda,
    creator: creator.publicKey,
  })
  .rpc();
```

---

### 6. Claim Reward (Winners Only)

```typescript
const viewerTokenAccount = await getAssociatedTokenAddress(
  tokenMint,
  viewer.publicKey
);

const [predictionPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("prediction"),
    streamPda.toBuffer(),
    viewer.publicKey.toBuffer(),
  ],
  program.programId
);

await program.methods
  .claimReward()
  .accounts({
    prediction: predictionPda,
    stream: streamPda,
    vault: vaultPda,
    viewerTokenAccount: viewerTokenAccount,
    vaultTokenAccount: vaultTokenAccount,
    viewer: viewer.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([viewer])
  .rpc();
```

---

## Complete Flow Example

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  mintTo,
} from "@solana/spl-token";

async function completeFlow() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Cyphercast as Program<Cyphercast>;

  // 1. Create SPL Token (for testing)
  const tokenMint = await createMint(
    provider.connection,
    creator.payer,
    creator.publicKey,
    null,
    6 // decimals
  );

  // 2. Create Stream
  const streamId = new BN(Date.now());
  const [streamPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("stream"),
      creator.publicKey.toBuffer(),
      streamId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  await program.methods
    .createStream(streamId, "My Stream", new BN(Date.now() / 1000))
    .accounts({
      stream: streamPda,
      creator: creator.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  // 3. Initialize Token Vault
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), streamPda.toBuffer()],
    program.programId
  );

  const vaultTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    vaultPda,
    true
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

  // 4. Viewer submits prediction
  const viewerTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    viewer.publicKey
  );

  // Mint tokens to viewer first (for testing)
  await mintTo(
    provider.connection,
    creator.payer,
    tokenMint,
    viewerTokenAccount,
    creator.publicKey,
    100 * 1_000_000 // 100 tokens
  );

  const [predictionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("prediction"),
      streamPda.toBuffer(),
      viewer.publicKey.toBuffer(),
    ],
    program.programId
  );

  await program.methods
    .submitPrediction(1, new BN(10 * 1_000_000))
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

  // 5. End stream
  await program.methods
    .endStream()
    .accounts({
      stream: streamPda,
      creator: creator.publicKey,
    })
    .rpc();

  // 6. Resolve prediction
  await program.methods
    .resolvePrediction(1)
    .accounts({
      stream: streamPda,
      creator: creator.publicKey,
    })
    .rpc();

  // 7. Claim reward
  await program.methods
    .claimReward()
    .accounts({
      prediction: predictionPda,
      stream: streamPda,
      vault: vaultPda,
      viewerTokenAccount: viewerTokenAccount,
      vaultTokenAccount: vaultTokenAccount,
      viewer: viewer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([viewer])
    .rpc();

  console.log("Complete flow executed successfully!");
}
```

---

## Error Codes

```rust
#[error_code]
pub enum CypherCastError {
    #[msg("Stream is not active")]
    StreamNotActive,

    #[msg("Stream is still active")]
    StreamStillActive,

    #[msg("Invalid stake amount")]
    InvalidStakeAmount,

    #[msg("Invalid choice")]
    InvalidChoice,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,

    #[msg("Stream not resolved")]
    NotResolved,

    #[msg("Incorrect prediction")]
    NotWinner,

    #[msg("Stream already resolved")]
    AlreadyResolved,
}
```

---

## PDA Seeds Reference

| Account     | Seeds                                           |
| ----------- | ----------------------------------------------- |
| Stream      | `["stream", creator_pubkey, stream_id_bytes]`   |
| TokenVault  | `["vault", stream_pubkey]`                      |
| Participant | `["participant", stream_pubkey, viewer_pubkey]` |
| Prediction  | `["prediction", stream_pubkey, viewer_pubkey]`  |

---

## Account Sizes

| Account     | Size (bytes) |
| ----------- | ------------ |
| Stream      | 278          |
| TokenVault  | 73           |
| Participant | 89           |
| Prediction  | 91           |

---

## Tips & Best Practices

1. **Always initialize vault before joining/predicting**

   - Create stream first
   - Initialize vault second
   - Then users can join/predict

2. **Check token balances before staking**

   ```typescript
   const account = await getAccount(connection, viewerTokenAccount);
   if (account.amount < stakeAmount) {
     throw new Error("Insufficient token balance");
   }
   ```

3. **Handle token account creation**

   ```typescript
   const viewerTokenAccount = await getAssociatedTokenAddress(
     tokenMint,
     viewer.publicKey
   );

   // Check if account exists, create if not
   const accountInfo = await connection.getAccountInfo(viewerTokenAccount);
   if (!accountInfo) {
     await createAssociatedTokenAccount(
       connection,
       viewer,
       tokenMint,
       viewer.publicKey
     );
   }
   ```

4. **Verify stream state before operations**

   ```typescript
   const stream = await program.account.stream.fetch(streamPda);
   if (!stream.isActive) {
     throw new Error("Stream is not active");
   }
   if (stream.isResolved) {
     throw new Error("Stream already resolved");
   }
   ```

5. **Calculate expected rewards**
   ```typescript
   const prediction = await program.account.prediction.fetch(predictionPda);
   const expectedReward = prediction.stakeAmount.toNumber() * 2; // Current 2x multiplier
   ```

---

## Frontend Integration Example

```typescript
// hooks/useCypherCast.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export function useCypherCast() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useProgram(); // Your program hook

  const submitPrediction = async (
    streamId: BN,
    choice: number,
    stakeAmount: BN,
    tokenMint: PublicKey
  ) => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const [streamPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stream"), creator, streamId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), streamPda.toBuffer()],
      program.programId
    );

    const viewerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );

    const vaultTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      vaultPda,
      true
    );

    const [predictionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("prediction"),
        streamPda.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .submitPrediction(choice, stakeAmount)
      .accounts({
        stream: streamPda,
        prediction: predictionPda,
        vault: vaultPda,
        viewerTokenAccount,
        vaultTokenAccount,
        viewer: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await connection.confirmTransaction(tx);
    return tx;
  };

  return { submitPrediction };
}
```

---

## Testing Checklist

- [x] Token vault initialization
- [x] Join stream with token transfer
- [x] Submit prediction with token transfer
- [x] Resolve prediction (only creator)
- [x] Claim reward with correct prediction
- [x] Prevent double claim
- [x] Prevent claim with wrong prediction
- [x] Prevent unauthorized resolution
- [x] Verify token balances after each operation
- [x] Verify vault PDA signing works correctly
