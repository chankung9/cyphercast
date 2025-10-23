# CypherCast Architecture

## Purpose
This document explains how the CypherCast platform is assembled across the frontend, off-chain services, and the Solana on-chain program. It highlights the Phase 2.5 upgrades such as proportional rewards, streamer tips, and the community vault scaffold so technical reviewers can see how every layer fits together.

## High-Level System

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
    D0["CypherCast – Watch. Predict. Earn.\nInteractive Streaming Layer on Solana"]:::title

    subgraph frontend [Frontend Layer]
        direction TB
        A1[Stream Embed\nYouTube / Twitch]
        A2[Prediction Panel]
        A3[WalletConnect\nPhantom / Solflare]
        A4[Stake & Claim Buttons]
    end

    subgraph offchain [Off-chain Services]
        direction TB
        B1[Oracle Script\n(Stream outcomes)]
        B2[Metadata API]
        B3[Analytics Pipeline]
    end

    subgraph onchain [On-chain Program]
        direction TB
        C1[Stream Manager]
        C2[Prediction Engine]
        C3[(TokenVault + CommunityVault)]:::token
    end

    subgraph network [Solana]
        direction TB
        S1[Localnet / Devnet]
    end

    D0 --> A1 --> A2 --> A3 --> A4
    A3 -- wallet tx --> C2
    B1 -- resolution --> C2
    B3 -- metrics --> B2
    C1 --> C2 --> C3
    C3 --- S1
    C3 -. events .-> B3
    B2 -. updates .-> A2

    classDef title fill:#000,stroke:#9a6bff,color:#fff,font-weight:bold;
    classDef token fill:#1a4b8c,stroke:#ffdd00,color:#fff;
    classDef network fill:#0c2340,stroke:#57e6ff,color:#9fe2ff;
```

### Frontend Layer
- **React/Vite dApp** (Phase 3 target) renders live streams, prediction options, and wallet prompts.
- **Wallet Adapter** provides Phantom/Solflare integration for signing transactions.
- **Stake & Claim UI** encapsulates the join → predict → claim flow demonstrated in the CLI today.

### Off-Chain Services
- **Oracle Script** pushes authoritative results when a stream ends. In the hackathon build this is a script invoked by the operator.
- **Metadata API** distributes stream descriptions, thumbnails, and lock timers to clients.
- **Analytics Pipeline** listens to emitted events (`PredictionSubmitted`, `StreamResolved`) and powers dashboards.

### On-Chain Program
- **Stream Manager** covers stream creation, scheduling windows, and configuration locks introduced in Phase 2.5.
- **Prediction Engine** validates stakes, enforces the auto-lock, and records each prediction with its viewer and amount.
- **TokenVault** secures SPL tokens, tracking cumulative deposits, releases, and the streamer tip that is deducted automatically on resolution.
- **CommunityVault (scaffold)** prepares a DAO-controlled pool that can accumulate platform revenue or sponsorships.

### Execution Flow
1. **Create Stream** – Creator configures schedule, tip percentage, precision, and grace periods via `create_stream`.
2. **Initialize Vaults** – Creator opens the TokenVault PDA and (optionally) the CommunityVault PDA.
3. **Join & Predict** – Viewers join once, then stake tokens per prediction; transfers land in the TokenVault.
4. **Resolve** – Oracle resolves the winning choice, the program pays the streamer tip immediately, and stores totals for proportional calculations.
5. **Claim Rewards** – Winners claim their share based on their stake vs. the total winning stake.

### Anchor Module Layout
```
programs/cyphercast/src/lib.rs
├─ create_stream
├─ initialize_token_vault
├─ initialize_community_vault
├─ join_stream
├─ submit_prediction
├─ resolve_prediction
└─ claim_reward
```

- **Guards & Constants** – `MAX_CHOICES = 10`, precision capped at 9 decimal places, and `tip_bps` limited to 100%.
- **PDAs** – Deterministic addresses secure the Stream, Participant, Prediction, TokenVault, and CommunityVault accounts.
- **Events** – `PredictionSubmitted` and `StreamResolved` feed the analytics layer without extra indexing infra.

### Phase 2.5 Improvements
- **Dynamic configuration** fields (`tip_bps`, `precision`, lock offsets) are frozen in the stream config hash for auditability.
- **Proportional rewards** derive payouts from `stream.total_by_choice` after deducting the streamer tip.
- **Streamer monetization** automatically transfers the tip to the creator’s ATA during resolution and records the amount for reporting.
- **Community vault hook** lays the groundwork for platform-level treasuries while keeping rewards non-custodial.
