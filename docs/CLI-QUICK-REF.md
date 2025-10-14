# CypherCast CLI Quick Reference

One-page quick reference for testing CypherCast program.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Make CLI executable
chmod +x cli-tool.js

# 3. Run full demo
node cli-tool.js demo
```

---

## 📋 Commands

### Interactive Mode

```bash
node cli-tool.js
```

### Command-Line Mode

| Command               | Syntax                                          | Example                                        |
| --------------------- | ----------------------------------------------- | ---------------------------------------------- |
| **Create Stream**     | `node cli-tool.js create "<title>"`             | `node cli-tool.js create "Gaming Night"`       |
| **Join Stream**       | `node cli-tool.js join <pda> [sol]`             | `node cli-tool.js join DKfG7...xyz 0.01`       |
| **Submit Prediction** | `node cli-tool.js predict <pda> <choice> [sol]` | `node cli-tool.js predict DKfG7...xyz 5 0.005` |
| **End Stream**        | `node cli-tool.js end <pda>`                    | `node cli-tool.js end DKfG7...xyz`             |
| **Claim Reward**      | `node cli-tool.js claim <pda>`                  | `node cli-tool.js claim EKfH8...abc`           |
| **Fetch Stream**      | `node cli-tool.js fetch <pda>`                  | `node cli-tool.js fetch DKfG7...xyz`           |
| **Full Demo**         | `node cli-tool.js demo`                         | `node cli-tool.js demo`                        |

---

## 📊 Program Details

| Item               | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Program ID**     | `5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF` |
| **Network**        | Local (http://localhost:8899)                  |
| **IDL Path**       | `./target/idl/cyphercast.json`                 |
| **Default Wallet** | `~/.config/solana/id.json`                     |

---

## 🎯 Common Workflows

### Create & Join a Stream

```bash
# 1. Create
node cli-tool.js create "My Stream"
# Output: Stream PDA: DKfG7...xyz

# 2. Join
node cli-tool.js join DKfG7...xyz 0.01
```

### Submit Prediction & Claim

```bash
# 1. Predict
node cli-tool.js predict DKfG7...xyz 5 0.005
# Output: Prediction PDA: EKfH8...abc

# 2. End Stream
node cli-tool.js end DKfG7...xyz

# 3. Claim
node cli-tool.js claim EKfH8...abc
```

### Complete Flow

```bash
node cli-tool.js demo
```

---

## 🔧 Solana CLI Commands

```bash
# Check balance
solana balance

# Get test SOL
solana airdrop 2

# View program
solana program show 5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF

# Monitor logs
solana logs 5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF

# Check cluster
solana cluster-version
```

---

## ⚠️ Common Errors

| Error                      | Solution                   |
| -------------------------- | -------------------------- |
| **Cannot find module**     | `npm install`              |
| **Blockhash not found**    | Check validator is running |
| **Insufficient funds**     | `solana airdrop 2`         |
| **Account already exists** | Use different stream ID    |
| **Stream not active**      | Can't join ended streams   |
| **Invalid choice**         | Use 0-10 only              |

---

## 🎬 Demo Recording Steps

```bash
# Terminal 1: Monitor logs
solana logs 5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF

# Terminal 2: Run demo
node cli-tool.js demo

# Screen record both terminals showing:
# - Program logs in real-time
# - CLI output with each step
# - Success messages and transaction IDs
```

---

## 📝 Testing Checklist

- [ ] Run `node cli-tool.js demo` successfully
- [ ] Create stream manually
- [ ] Join with custom stake amount
- [ ] Submit prediction with different choices
- [ ] End stream as creator
- [ ] Claim reward
- [ ] Verify all transactions on-chain

---

## 🔗 Quick Links

- **Full Testing Guide**: `TESTING.md`
- **Local Setup**: `LOCAL_SETUP.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`
- **Program Source**: `programs/cyphercast/src/lib.rs`

---

**Pro Tip:** Save PDAs from output - you'll need them for subsequent commands!
