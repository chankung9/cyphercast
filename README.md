# 🎬 CypherCast — _Watch. Predict. Earn._

> **On-chain Interactive Streaming Layer built on Solana.**  
> Engage audiences with live predictions, token staking, and transparent rewards — powered by Anchor & PDAs.

[![Solana](https://img.shields.io/badge/Solana-Localnet-green)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)](https://www.anchor-lang.com/)
[![Phase](https:/---

## 🧑‍💻 Development Team

| Role            | Member    | Focus                                |
| --------------- | --------- | ------------------------------------ |
| Dev / Technical | Worrapong | Anchor program, PDA architecture     |
| Product         | Worrapong | Vision, roadmap, hackathon strategy  |

---

## 📚 Documentation

- [CLI Quick Reference](./docs/CLI-QUICK-REF.md) - Command-line tool usage
- [Local Setup Guide](./LOCAL_SETUP.md) - Development environment setup
- [Anchor Program](./programs/cyphercast/src/lib.rs) - Smart contract source code

---

## 🤝 Contributing

This is a hackathon project currently in Phase 1 MVP. We welcome:

- 🐛 Bug reports and feedback
- 💡 Feature suggestions for Phase 2
- 🔧 Pull requests (especially for reward distribution!)
- 📖 Documentation improvements

### Development Workflow

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/cyphercast.git

# 2. Install dependencies
npm install

# 3. Make changes
# Edit programs/cyphercast/src/lib.rs

# 4. Build and test
anchor build
anchor test

# 5. Submit PR
```

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

---

## 🌐 Built for Solana Cypherpunk Hackathon

**October 2025** - [Hackathon Details](https://solana.com/hackathon)

> "Streaming meets Web3. Viewers don't just watch — they own the moment."  
> — CypherCast Team 🚀

### 🔗 Links

- **GitHub**: [github.com/chankung9/cyphercast](https://github.com/chankung9/cyphercast)
- **Program ID**: `5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF` (Localnet)
- **Status**: Phase 1 MVP - 60% Complete

---

**⭐ Star this repo if you believe in the future of interactive Web3 streaming!**dge/Phase-1%20MVP-yellow)](https://github.com)

---

## � Current Status: Phase 1 MVP (60% Complete)

**✅ What's Working:**
- Anchor program with PDA-based architecture
- 5 core instructions: `create_stream`, `join_stream`, `submit_prediction`, `end_stream`, `claim_reward`
- Participant and prediction tracking on-chain
- CLI demo tool for testing
- Local deployment ready

**🚧 In Development (Phase 2):**
- `resolve_prediction` instruction for outcome determination
- Full reward distribution with SOL transfers
- React frontend with wallet integration
- Devnet deployment

**Program ID (Localnet):** `5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF`

---

## 🚀 Overview

**CypherCast** transforms passive viewing into active participation.  
Instead of just watching, viewers can **predict live outcomes**, **stake tokens**, and **earn rewards** on-chain.

- 🧠 **For Viewers:** Make predictions during streams → Win tokens instantly
- 🎥 **For Creators:** Boost engagement and earn from every prediction pool
- 🔐 **Powered by Solana:** Sub-second, low-fee microtransactions secured by PDAs

> “Not another streaming platform — it’s a Web3 layer that enhances existing ones like YouTube or Twitch.”

---

## 🧩 Core Concept

| Problem                                        | Solution                                              | Why Solana (OPOS)                   |
| ---------------------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| 70% of viewers just watch, no participation    | Viewers stake tokens to predict outcomes in real-time | ⚡ Sub-second, low-fee transactions |
| Creators rely on ads and tips that don’t scale | Creator earns from prediction engagement pools        | 🔐 Secure PDAs & on-chain proof     |
| Fans get no ownership or rewards               | Transparent reward distribution via Anchor            | 📱 Solana Mobile Stack-ready UX     |

---

## ⚙️ Architecture Overview

CypherCast consists of **three main layers** — React frontend, Off-chain integration, and On-chain Solana programs.

```mermaid
---
config:
  theme: dark
  themeVariables:
    fontSize: 14px
    edgeLabelBackground: '#111'
  flowchart:
    curve: monotoneX
  layout: elk
---
flowchart TD
    %% HEADER
    D0["CypherCast – Watch. Predict. Earn.\nWeb3 Interactive Streaming Layer on Solana"]:::title

    %% FRONTEND LAYER
    subgraph frontend [Frontend Layer]
        direction TB
        fa([User Entry - App UI])
        A1[Stream Embed\nYouTube / Twitch]
        A2[Prediction Panel & Stake UI]
        A3[WalletConnect\nPhantom / Solflare]:::wallet
        A4[Stake + Claim Buttons]
    end

    %% OFFCHAIN LAYER
    subgraph offchain [Off-chain Services]
        direction TB
        ob1[Surfpool SDK\nTesting]
        ob2[Oracle Script\nMock Resolver]
        ob3[Metadata IPFS]
        ob4[API Gateway / WebSocket]
    end

    %% ONCHAIN LAYER
    subgraph onchain [On-Chain Programs - Solana + Anchor]
        direction TB
        oc1[Program: StreamManager]
        oc2[Program: FanGame\nPrediction Engine]
        oc3[(TokenVault\nStake & Reward)]:::token
    end

    %% NETWORK
    subgraph network [Solana Network]
        direction TB
        sol[💠 Devnet / Mainnet Cluster]:::network
    end

    %% CONNECTIONS
    D0 --> fa
    fa --> A1 --> A2 --> A3 --> A4
    A4 -- User Events --> ob4
    A3 -- Wallet API --> ob4
    ob4 -- WebSocket/API TX --> oc1
    ob1 --> ob2 --> ob3 --> ob4
    oc1 --> oc2 --> oc3
    oc3 --- sol
    sol -. Stake / Resolve / Claim .-> oc3
    oc3 -. Smart Contract Events .-> ob4
    ob4 -. Data & Updates .-> fa

    %% STYLING
    style frontend fill:#1a1a3d,stroke:#9a6bff,stroke-width:2px
    style offchain fill:#00332b,stroke:#00ffc3,stroke-width:2px
    style onchain fill:#3a183b,stroke:#ff66c4,stroke-width:2px
    style network fill:#141414,stroke:#57e6ff,stroke-width:2px
    style D0 fill:#000,stroke:#9a6bff,stroke-width:2px,color:#fff

    classDef wallet fill:#336633,stroke:#fff,stroke-width:1px,color:#fff;
    classDef token fill:#0057b7,stroke:#ff0,stroke-width:2px,color:#fff;
    classDef network fill:#0c2340,stroke:#57e6ff,stroke-width:2px,color:#9fe2ff;
    classDef title fill:#000,stroke:#9a6bff,stroke-width:2px,color:#fff,font-weight:bold;
```

---

## 🔄 Transaction Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    participant C as Creator (Streamer)
    participant V as Viewer (User)
    participant F as Frontend (React + Wallet)
    participant O as Oracle/Admin
    participant P as Program (Anchor Smart Contract)
    participant T as TokenVault (PDA)

    Note over C,V: Stream is live on YouTube / Twitch

    C->>P: create_stream(stream_id, metadata)
    activate P
    P->>P: initialize Stream PDA
    deactivate P
    Note right of P: Stream account created on-chain

    V->>F: open Stream page (connect wallet)
    F->>V: show prediction question & options
    V->>P: submit_prediction(stream_id, choice, amount)
    activate P
    P->>T: transfer tokens (viewer → vault)
    P->>P: record prediction PDA
    deactivate P
    Note over P,V: Tx confirmed on Solana (<1s)

    O->>P: resolve_prediction(stream_id, result)
    activate P
    P->>P: mark outcome and winners
    deactivate P

    V->>P: claim_reward()
    activate P
    P->>T: transfer reward → winner wallet
    deactivate P
    Note right of V: Winner receives SPL token instantly

    Note over P,T: All interactions auditable on Solana Explorer
```

---

## 🧠 Project Structure

```css
cyphercast/
├─ Anchor.toml
├─ programs/
│   └─ cyphercast/
│       ├─ Cargo.toml
│       └─ src/lib.rs
├─ app/
│   ├─ client.ts
│   └─ src/
│       ├─ index.tsx
│       ├─ App.tsx
│       ├─ components/
│       │   ├─ StreamList.tsx
│       │   ├─ StreamView.tsx
│       │   ├─ PredictionForm.tsx
│       │   ├─ WalletConnect.tsx
│       │   └─ StakePanel.tsx
│       └─ context/SolanaProvider.tsx
└─ tests/
    └─ cyphercast.ts
```

---

## 🧱 Example: Anchor.toml

```toml
[programs.localnet]
cyphercast = "5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF"

[registry]
url = "https://anchor.projectserum.com"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

[workspace]
members = [
  "programs/cyphercast"
]
```

> **Note:** Program ID `5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF` is for local development.  
> For Devnet/Mainnet deployment, this will be updated.

---

## 🧩 Key Anchor Instructions

| Instruction            | Description                                |
| ---------------------- | ------------------------------------------ |
| `create_stream()`      | Initializes a stream PDA linked to creator |
| `join_stream()`        | Records viewer participation               |
| `submit_prediction()`  | Submits user’s predicted outcome & stake   |
| `resolve_prediction()` | Oracle or creator finalizes result         |
| `claim_reward()`       | Winner claims SPL reward from TokenVault   |

---

## 💻 Local Setup

### 1️⃣ Prerequisites

- Node.js 18+ — Download: https://nodejs.org/en/download/  
  Verify: node --version (v18+)

- Rust (rustup) — Install: https://rustup.rs/  
  Verify: rustc --version

- Anchor CLI — Install & docs: https://github.com/coral-xyz/anchor#installation  
  Verify: anchor --version

- Solana CLI — Install: https://docs.solana.com/cli/install-solana-cli-tools  
  Verify: solana --version

- Yarn (optional) — Install: https://yarnpkg.com/getting-started/install  
   or npm (bundled with Node.js) — https://www.npmjs.com/get-npm  
   Verify: yarn --version or npm --version

### 2️⃣ Install & Build

```bash
git clone https://github.com/chankung9/cyphercast.git
cd cyphercast

# Install dependencies
npm install

# Build the Anchor program
anchor build

# Run tests
anchor test

# Deploy to local validator
anchor deploy
```

### 3️⃣ Run CLI Demo

```bash
# Using the direct CLI tool
node cli/direct-cli.js demo

# Or step by step:
# 1. Create a stream
node cli/direct-cli.js create "My Stream" "Prediction question?"

# 2. Join stream (need stream PDA from step 1)
node cli/direct-cli.js join <STREAM_PDA> 0.1

# 3. Submit prediction
node cli/direct-cli.js predict <STREAM_PDA> 0 0.05

# 4. Fetch stream data
node cli/direct-cli.js fetch <STREAM_PDA>
```

For more CLI commands, see [docs/CLI-QUICK-REF.md](./docs/CLI-QUICK-REF.md)

---

## 🎥 Demo Flow (Phase 1 MVP)

### Current Implementation:

1. **Creator** uses CLI → creates a stream with `create_stream()`
   ```bash
   node cli/direct-cli.js create "Gaming Tournament" "Who will win?"
   ```

2. **Viewer** joins stream with stake → `join_stream()`
   ```bash
   node cli/direct-cli.js join <STREAM_PDA> 0.1
   ```

3. **Viewer** submits prediction → `submit_prediction()`
   ```bash
   node cli/direct-cli.js predict <STREAM_PDA> 0 0.05
   ```

4. **Creator** ends stream → `end_stream()`
   ```bash
   node cli/direct-cli.js end <STREAM_PDA>
   ```

5. **Verification** - View on-chain data
   ```bash
   node cli/direct-cli.js fetch <STREAM_PDA>
   ```

All transactions are recorded on Solana blockchain with **sub-second finality**.

### Coming Soon (Phase 2):
- React frontend with wallet integration
- Automated reward calculation and distribution
- Oracle integration for outcome resolution

---

## 🧭 Roadmap

| Phase                         | Goal                               | Key Deliverables                        | Status      |
| ----------------------------- | ---------------------------------- | --------------------------------------- | ----------- |
| **Phase 1 – MVP (Current)**   | Technical proof of concept         | ✅ Anchor program with PDA architecture<br/>✅ CLI testing tool<br/>✅ Core instructions (create, join, predict, end)<br/>⚠️ Basic reward framework | **60% Complete** |
| **Phase 2 – Reward System**   | Complete reward distribution       | 🚧 resolve_prediction instruction<br/>🚧 SOL/token transfers<br/>🚧 Winner calculation logic<br/>🚧 React frontend UI | **Planned** |
| **Phase 3 – Market Proof**    | Validate with real creators        | Beta site + social traction             | **Q1 2026** |
| **Phase 4 – Ecosystem**       | DAO + Revenue split protocol       | Governance + mobile-native UX           | **Q2 2026** |

---

## 🧱 Technology Stack

| Layer               | Technology                                         | Phase 1 Status |
| ------------------- | -------------------------------------------------- | -------------- |
| **Smart Contracts** | Anchor 0.31.1 (Rust), Solana PDAs                 | ✅ Implemented |
| **Testing**         | TypeScript, Anchor Test Framework                 | ✅ Working     |
| **CLI Tools**       | Node.js, @solana/web3.js                          | ✅ Working     |
| **Network**         | Solana Localnet (Devnet planned)                  | ✅ Localnet    |
| **Frontend**        | React, Vite, Wallet Adapter (Phase 2)             | 🚧 Planned     |
| **Off-chain**       | Oracle integration (Phase 2)                      | 🚧 Planned     |

**Core Dependencies:**
- `@coral-xyz/anchor` - Solana framework
- `@solana/web3.js` - Solana JavaScript API
- `@solana/spl-token` - Token program (Phase 2)

---

## 🪙 Security & Architecture

### PDA-Based Account Structure

1. **Stream PDAs** - Deterministic addresses derived from:
   ```rust
   seeds = [b"stream", creator.key().as_ref(), stream_id.to_le_bytes()]
   ```

2. **Participant PDAs** - Unique per viewer per stream:
   ```rust
   seeds = [b"participant", stream.key().as_ref(), viewer.key().as_ref()]
   ```

3. **Prediction PDAs** - One prediction per viewer per stream:
   ```rust
   seeds = [b"prediction", stream.key().as_ref(), viewer.key().as_ref()]
   ```

### Security Features

- ✅ **No Storage Overhead** - PDAs are derived, not stored
- ✅ **Ownership Verification** - Only program can modify accounts
- ✅ **Deterministic** - Same inputs always generate same addresses
- ✅ **Signer Validation** - Anchor framework checks all permissions
- ✅ **On-chain Audit Trail** - All transactions publicly verifiable

### Phase 2 Security Enhancements
- 🚧 Token vault for stake management
- 🚧 Multi-signature for critical operations
- 🚧 Time-locks for dispute resolution
- 🚧 Smart contract audit

---

## 🧑‍💻 Contributors

| Role            | Member    | Focus                                |
| --------------- | --------- | ------------------------------------ |
| Dev / Technical | Worrapong | Anchor program, frontend integration |
| Biz / Growth    | Worrapong | Market validation, creator outreach  |
| Pitch / Design  | Worrapong | Presentation, deck, and demo video   |

---

## 🌐 Built for

[Solana Cypherpunk Hackathon – October 2025]

"Streaming meets Web3. Viewers don’t just watch — they own the moment."
— CypherCast Team 🚀
