# 🛠️ Code Templates & Quick Start Examples

**Fast-track your development with ready-to-use code snippets**

---

## 📋 Table of Contents

1. [Smart Contract Templates](#smart-contract-templates)
2. [Reward Calculation Examples](#reward-calculation-examples)
3. [Frontend Integration Snippets](#frontend-integration-snippets)
4. [Testing Templates](#testing-templates)
5. [Deployment Scripts](#deployment-scripts)

---

## Smart Contract Templates

### Basic Instruction Template

```rust
use anchor_lang::prelude::*;

#[program]
pub mod cyphercast {
    use super::*;

    // Template for resolve_prediction instruction
    pub fn resolve_prediction(
        ctx: Context<ResolvePrediction>,
        winning_outcome: u8,
    ) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        
        // Validate caller is authorized (oracle or creator)
        require!(
            ctx.accounts.authority.key() == stream.creator ||
            ctx.accounts.authority.key() == stream.oracle,
            ErrorCode::UnauthorizedResolver
        );
        
        // Validate stream is in correct state
        require!(
            stream.status == StreamStatus::Active,
            ErrorCode::StreamNotActive
        );
        
        // Set winning outcome
        stream.winning_outcome = Some(winning_outcome);
        stream.status = StreamStatus::Resolved;
        stream.resolved_at = Clock::get()?.unix_timestamp;
        
        msg!("Prediction resolved! Winning outcome: {}", winning_outcome);
        Ok(())
    }

    // Template for claim_reward instruction
    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let stream = &ctx.accounts.stream;
        
        // Validate stream is resolved
        require!(
            stream.status == StreamStatus::Resolved,
            ErrorCode::StreamNotResolved
        );
        
        // Validate prediction is a winner
        require!(
            prediction.outcome == stream.winning_outcome.unwrap(),
            ErrorCode::NotAWinner
        );
        
        // Prevent double-claiming
        require!(
            !prediction.claimed,
            ErrorCode::AlreadyClaimed
        );
        
        // Calculate reward
        let reward = calculate_user_reward(
            prediction.stake_amount,
            stream.total_winner_stakes,
            stream.total_pool,
            stream.creator_fee_bps,
        )?;
        
        // Transfer reward from vault to user
        // (Add token transfer logic here)
        
        prediction.claimed = true;
        prediction.claimed_at = Some(Clock::get()?.unix_timestamp);
        
        msg!("Reward claimed: {} tokens", reward);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,
    #[account(
        mut,
        has_one = user,
        has_one = stream,
    )]
    pub prediction: Account<'info, Prediction>,
    pub user: Signer<'info>,
    /// CHECK: Token vault PDA
    pub token_vault: AccountInfo<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
```

---

## Reward Calculation Examples

### Simple Winner-Takes-All Formula

```rust
/// Calculates reward for a single winner
/// 
/// Formula:
/// - Total Pool = sum of all stakes
/// - Creator Fee = Total Pool × (creator_fee_bps / 10000)
/// - Reward Pool = Total Pool - Creator Fee
/// - User Reward = (User Stake / Total Winner Stakes) × Reward Pool
pub fn calculate_user_reward(
    user_stake: u64,
    total_winner_stakes: u64,
    total_pool: u64,
    creator_fee_bps: u16, // basis points (500 = 5%)
) -> Result<u64> {
    require!(total_winner_stakes > 0, ErrorCode::NoWinners);
    require!(total_pool > 0, ErrorCode::EmptyPool);
    
    // Calculate creator fee (e.g., 5% = 500 basis points)
    let creator_fee = (total_pool as u128)
        .checked_mul(creator_fee_bps as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap() as u64;
    
    // Remaining pool for winners
    let reward_pool = total_pool.checked_sub(creator_fee).unwrap();
    
    // User's proportional share
    let user_reward = (reward_pool as u128)
        .checked_mul(user_stake as u128)
        .unwrap()
        .checked_div(total_winner_stakes as u128)
        .unwrap() as u64;
    
    Ok(user_reward)
}
```

### Advanced: Return Original Stake + Winnings

```rust
pub fn calculate_user_payout(
    user_stake: u64,
    total_winner_stakes: u64,
    total_loser_stakes: u64,
    creator_fee_bps: u16,
) -> Result<u64> {
    // Total pool is all stakes
    let total_pool = total_winner_stakes
        .checked_add(total_loser_stakes)
        .unwrap();
    
    // Creator takes fee from total pool
    let creator_fee = (total_pool as u128)
        .checked_mul(creator_fee_bps as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap() as u64;
    
    // Distribute loser stakes (after fee) among winners
    let distributable_pool = total_loser_stakes
        .checked_sub(creator_fee)
        .unwrap();
    
    // User gets their stake back + proportional winnings
    let winnings = (distributable_pool as u128)
        .checked_mul(user_stake as u128)
        .unwrap()
        .checked_div(total_winner_stakes as u128)
        .unwrap() as u64;
    
    let total_payout = user_stake.checked_add(winnings).unwrap();
    
    Ok(total_payout)
}
```

### Helper: Calculate Pool Statistics

```rust
pub fn calculate_pool_stats(stream: &Stream, predictions: &[Prediction]) -> PoolStats {
    let mut total_pool = 0u64;
    let mut total_winner_stakes = 0u64;
    let mut total_loser_stakes = 0u64;
    let mut winner_count = 0u32;
    let mut loser_count = 0u32;
    
    let winning_outcome = stream.winning_outcome.unwrap();
    
    for prediction in predictions {
        total_pool += prediction.stake_amount;
        
        if prediction.outcome == winning_outcome {
            total_winner_stakes += prediction.stake_amount;
            winner_count += 1;
        } else {
            total_loser_stakes += prediction.stake_amount;
            loser_count += 1;
        }
    }
    
    PoolStats {
        total_pool,
        total_winner_stakes,
        total_loser_stakes,
        winner_count,
        loser_count,
    }
}

#[derive(Debug)]
pub struct PoolStats {
    pub total_pool: u64,
    pub total_winner_stakes: u64,
    pub total_loser_stakes: u64,
    pub winner_count: u32,
    pub loser_count: u32,
}
```

---

## Frontend Integration Snippets

### Wallet Connection Setup

```typescript
// src/context/WalletProvider.tsx
import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

require('@solana/wallet-adapter-react-ui/styles.css');

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
    
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
```

### Program Interaction Hook

```typescript
// src/hooks/useCyphercast.ts
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3 } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '../idl/cyphercast.json';

const PROGRAM_ID = new PublicKey('YourProgramIDHere');

export function useCyphercast() {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();

    const getProvider = () => {
        if (!wallet) throw new Error('Wallet not connected');
        return new AnchorProvider(connection, wallet, {
            commitment: 'confirmed',
        });
    };

    const getProgram = () => {
        const provider = getProvider();
        return new Program(idl as any, PROGRAM_ID, provider);
    };

    const createStream = async (streamId: string, metadata: string) => {
        const program = getProgram();
        const [streamPda] = await PublicKey.findProgramAddress(
            [Buffer.from('stream'), Buffer.from(streamId)],
            PROGRAM_ID
        );

        const tx = await program.methods
            .createStream(streamId, metadata)
            .accounts({
                stream: streamPda,
                creator: wallet!.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();

        console.log('Stream created:', tx);
        return { signature: tx, streamPda };
    };

    const submitPrediction = async (
        streamId: string,
        outcome: number,
        amount: number
    ) => {
        const program = getProgram();
        const [streamPda] = await PublicKey.findProgramAddress(
            [Buffer.from('stream'), Buffer.from(streamId)],
            PROGRAM_ID
        );
        const [predictionPda] = await PublicKey.findProgramAddress(
            [
                Buffer.from('prediction'),
                streamPda.toBuffer(),
                wallet!.publicKey.toBuffer(),
            ],
            PROGRAM_ID
        );

        const tx = await program.methods
            .submitPrediction(outcome, new BN(amount))
            .accounts({
                stream: streamPda,
                prediction: predictionPda,
                user: wallet!.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();

        console.log('Prediction submitted:', tx);
        return { signature: tx, predictionPda };
    };

    const claimReward = async (streamId: string) => {
        const program = getProgram();
        const [streamPda] = await PublicKey.findProgramAddress(
            [Buffer.from('stream'), Buffer.from(streamId)],
            PROGRAM_ID
        );
        const [predictionPda] = await PublicKey.findProgramAddress(
            [
                Buffer.from('prediction'),
                streamPda.toBuffer(),
                wallet!.publicKey.toBuffer(),
            ],
            PROGRAM_ID
        );

        const tx = await program.methods
            .claimReward()
            .accounts({
                stream: streamPda,
                prediction: predictionPda,
                user: wallet!.publicKey,
                // Add token accounts here
            })
            .rpc();

        console.log('Reward claimed:', tx);
        return tx;
    };

    return {
        createStream,
        submitPrediction,
        claimReward,
        connected: !!wallet,
    };
}
```

### UI Component Example

```typescript
// src/components/PredictionForm.tsx
import { useState } from 'react';
import { useCyphercast } from '../hooks/useCyphercast';

export function PredictionForm({ streamId }: { streamId: string }) {
    const [outcome, setOutcome] = useState(0);
    const [amount, setAmount] = useState(0);
    const [loading, setLoading] = useState(false);
    const { submitPrediction, connected } = useCyphercast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!connected) {
            alert('Please connect your wallet first');
            return;
        }

        setLoading(true);
        try {
            const result = await submitPrediction(streamId, outcome, amount);
            alert(`Prediction submitted! Signature: ${result.signature}`);
        } catch (error) {
            console.error('Error submitting prediction:', error);
            alert('Failed to submit prediction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">
                    Choose Outcome
                </label>
                <select
                    value={outcome}
                    onChange={(e) => setOutcome(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300"
                >
                    <option value={0}>Outcome A</option>
                    <option value={1}>Outcome B</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium">
                    Stake Amount (SOL)
                </label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    min="0.01"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300"
                />
            </div>

            <button
                type="submit"
                disabled={loading || !connected}
                className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
                {loading ? 'Submitting...' : 'Submit Prediction'}
            </button>
        </form>
    );
}
```

---

## Testing Templates

### Anchor Test Template

```typescript
// tests/cyphercast.ts
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Cyphercast } from "../target/types/cyphercast";
import { assert } from "chai";

describe("cyphercast", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Cyphercast as Program<Cyphercast>;
    const streamId = "test-stream-1";

    it("Creates a stream", async () => {
        const [streamPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("stream"), Buffer.from(streamId)],
            program.programId
        );

        await program.methods
            .createStream(streamId, "Test Stream Metadata")
            .accounts({
                stream: streamPda,
                creator: provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        const stream = await program.account.stream.fetch(streamPda);
        assert.equal(stream.streamId, streamId);
        assert.ok(stream.creator.equals(provider.wallet.publicKey));
    });

    it("Submits a prediction", async () => {
        const [streamPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("stream"), Buffer.from(streamId)],
            program.programId
        );

        const [predictionPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("prediction"),
                streamPda.toBuffer(),
                provider.wallet.publicKey.toBuffer(),
            ],
            program.programId
        );

        const stakeAmount = new anchor.BN(1000000); // 0.001 SOL

        await program.methods
            .submitPrediction(0, stakeAmount)
            .accounts({
                stream: streamPda,
                prediction: predictionPda,
                user: provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        const prediction = await program.account.prediction.fetch(predictionPda);
        assert.equal(prediction.outcome, 0);
        assert.ok(prediction.stakeAmount.eq(stakeAmount));
    });

    it("Resolves prediction and claims reward", async () => {
        // First, resolve the prediction
        const [streamPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("stream"), Buffer.from(streamId)],
            program.programId
        );

        await program.methods
            .resolvePrediction(0) // Outcome 0 wins
            .accounts({
                stream: streamPda,
                authority: provider.wallet.publicKey,
            })
            .rpc();

        // Verify stream is resolved
        const stream = await program.account.stream.fetch(streamPda);
        assert.equal(stream.winningOutcome, 0);

        // Then claim the reward
        const [predictionPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("prediction"),
                streamPda.toBuffer(),
                provider.wallet.publicKey.toBuffer(),
            ],
            program.programId
        );

        await program.methods
            .claimReward()
            .accounts({
                stream: streamPda,
                prediction: predictionPda,
                user: provider.wallet.publicKey,
            })
            .rpc();

        const prediction = await program.account.prediction.fetch(predictionPda);
        assert.ok(prediction.claimed);
    });
});
```

---

## Deployment Scripts

### Deploy Script

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying CypherCast to Solana Devnet..."

# Set to Devnet
solana config set --url devnet

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "Low balance. Requesting airdrop..."
    solana airdrop 2
    sleep 5
fi

# Build program
echo "Building program..."
anchor build

# Deploy
echo "Deploying to Devnet..."
anchor deploy --provider.cluster devnet

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/cyphercast-keypair.json)
echo "✅ Program deployed!"
echo "Program ID: $PROGRAM_ID"

# Update Anchor.toml
sed -i "s/cyphercast = \".*\"/cyphercast = \"$PROGRAM_ID\"/" Anchor.toml

echo "🎉 Deployment complete!"
echo "Next steps:"
echo "1. Update your frontend with the Program ID: $PROGRAM_ID"
echo "2. Run tests: anchor test --skip-local-validator"
echo "3. View on Solana Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
```

### Quick Test Script

```bash
#!/bin/bash
# test.sh

echo "🧪 Running CypherCast tests..."

# Build first
anchor build

# Run tests
anchor test

echo "✅ Tests complete!"
```

---

## Error Codes

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized to resolve this prediction")]
    UnauthorizedResolver,
    
    #[msg("Stream is not in active status")]
    StreamNotActive,
    
    #[msg("Stream has not been resolved yet")]
    StreamNotResolved,
    
    #[msg("This prediction is not a winner")]
    NotAWinner,
    
    #[msg("Reward has already been claimed")]
    AlreadyClaimed,
    
    #[msg("No winners in this prediction")]
    NoWinners,
    
    #[msg("Pool is empty")]
    EmptyPool,
    
    #[msg("Invalid outcome value")]
    InvalidOutcome,
    
    #[msg("Stake amount too low")]
    StakeTooLow,
    
    #[msg("Prediction window has closed")]
    PredictionClosed,
}
```

---

## Environment Setup

### .env.example

```bash
# Solana Network
REACT_APP_SOLANA_NETWORK=devnet
REACT_APP_SOLANA_RPC_URL=https://api.devnet.solana.com

# Program
REACT_APP_PROGRAM_ID=YourProgramIDHere

# Optional: Custom RPC (Helius, QuickNode, etc.)
# REACT_APP_SOLANA_RPC_URL=https://your-custom-rpc-url
```

### package.json Scripts

```json
{
  "scripts": {
    "build": "anchor build",
    "test": "anchor test",
    "deploy": "anchor deploy --provider.cluster devnet",
    "dev": "cd app && npm run dev",
    "lint": "cargo clippy -- -D warnings"
  }
}
```

---

## Quick Reference: PDA Seeds

```rust
// Stream PDA
["stream", stream_id.as_bytes()]

// Prediction PDA
["prediction", stream_pda.as_ref(), user.key().as_ref()]

// Participant PDA (for join_stream)
["participant", stream_pda.as_ref(), user.key().as_ref()]

// TokenVault PDA
["vault", stream_pda.as_ref()]
```

---

**Copy these templates and customize for your needs. Focus on getting something working first, then optimize!**

*See also: [TIMELINE_ASSESSMENT.md](./TIMELINE_ASSESSMENT.md) | [QUICK_ACTION_GUIDE.md](./QUICK_ACTION_GUIDE.md) | [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)*
