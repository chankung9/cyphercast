# CypherCast Local Development Guide

## Quick Start with Local Solana Network

### 1. Start Local Environment

```bash
# Start local Solana validator and setup
./setup-local.sh
```

### 2. Build & Deploy Program

```bash
# Build the Anchor program
anchor build

# Deploy to local network
./deploy.sh
```

### 3. Start Frontend

```bash
# Navigate to app directory
cd app

# Install dependencies (if not done)
npm install

# Start React app
npm start
```

## Network Configuration

- **RPC URL**: `http://localhost:8899`
- **Cluster**: `localnet`
- **Program**: Will be deployed to local network

## Testing Flow

1. **Connect Wallet**: Use test wallet or Phantom in development mode
2. **Create Stream**: Test stream creation with local SOL
3. **Join Stream**: Test joining as different users
4. **Make Predictions**: Test prediction submission and staking
5. **End Stream & Claim**: Test reward distribution

## Troubleshooting

### If validator isn't starting:

```bash
# Kill any existing validator
pkill solana-test-validator

# Restart
./setup-local.sh
```

### If deployment fails:

```bash
# Check balance
solana balance

# Get more SOL if needed
solana airdrop 5

# Try deployment again
./deploy.sh
```

### If frontend can't connect:

- Make sure local validator is running on port 8899
- Check console for connection errors
- Verify program ID matches in client.ts

## File Structure for Local Development

```
cyphercast/
├── setup-local.sh      # Start local environment
├── deploy.sh           # Deploy to local network
├── Anchor.toml         # Already configured for localnet
├── programs/cyphercast/src/lib.rs  # Anchor program
├── app/
│   ├── client.ts       # RPC client
│   └── src/context/SolanaProvider.tsx  # Now uses localhost:8899
└── tests/cyphercast.ts # Local tests
```

## Ready for Demo!

Once everything works locally:

1. Record demo video of full user flow
2. Prepare pitch highlighting OPOS features
3. Deploy to devnet for hackathon submission if needed
