# CypherCast CLI Quick Reference

Single-page cheat sheet for running the local demo flow with the `cli/direct-cli.js` script. The CLI interacts directly with the Anchor program over RPC and is ideal for stakeholder walkthroughs.

## 🚀 Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Make CLI executable
chmod +x cli/direct-cli.js

# 3. Run full scripted demo (creates, predicts, resolves, claims)
node cli/direct-cli.js demo
```

## 📋 Core Commands
| Command | Syntax | Notes |
| ------- | ------ | ----- |
| `create` | `node cli/direct-cli.js create "<title>"` | Generates a unique stream id using the current timestamp |
| `join` | `node cli/direct-cli.js join <streamPda>` | Records viewer participation (no stake yet) |
| `predict` | `node cli/direct-cli.js predict <streamPda> <choice> <amount>` | Stakes SPL tokens (in SOL units for the demo mint) |
| `end` | `node cli/direct-cli.js end <streamPda>` | Marks stream complete (legacy helper) |
| `resolve` | `node cli/direct-cli.js resolve <streamPda> <winningChoice>` | Finalizes result and pays streamer tip |
| `claim` | `node cli/direct-cli.js claim <predictionPda>` | Withdraws proportional rewards |
| `fetch` | `node cli/direct-cli.js fetch <streamPda>` | Prints raw account data for verification |
| `demo` | `node cli/direct-cli.js demo` | Runs the entire lifecycle with sample viewers |

> **Tip:** Pass `--help` to any command for inline usage hints.

## 🔄 Typical Workflow
```bash
node cli/direct-cli.js create "Gaming Night"           # Step 1
node cli/direct-cli.js join <streamPda>                 # Step 2
node cli/direct-cli.js predict <streamPda> 3 5          # Step 3
node cli/direct-cli.js resolve <streamPda> 3            # Step 4
node cli/direct-cli.js claim <predictionPda>            # Step 5
```

## 🧰 Environment
| Item | Value |
| ---- | ----- |
| Program ID | `5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF` |
| RPC URL | `http://localhost:8899` |
| Default Wallet | `~/.config/solana/id.json` |
| Token Mint | Demo mint generated during test bootstrap |

## ✅ Troubleshooting
- Run `solana-keygen new` if the default wallet path is missing.
- Use `solana airdrop 5` to top up your local wallet before staking.
- Delete the `.anchor` directory to force a fresh program deploy if PDAs change.

Refer to `docs/TESTING.md` for automated coverage details or `docs/EVENT_STORMING.md` to narrate the same journey for non-technical audiences.
