# 🎬 CypherCast — *Watch. Predict. Earn.*

> **On-chain interactive streaming layer built on Solana.** Viewers stake tokens on live moments, creators earn tips automatically, and every payout is transparent.

[![Solana](https://img.shields.io/badge/Solana-Localnet-green)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)](https://www.anchor-lang.com/)
[![Tests](https://img.shields.io/badge/Tests-Automated-success)](./docs/TESTING.md)
[![Status](https://img.shields.io/badge/Build-Phase%202.5%20Complete-brightgreen)](./docs/MVP.md)
[![Changelog](https://img.shields.io/badge/History-CHANGELOG.md-informational)](./CHANGELOG.md)

---

## 🚀 Elevator Pitch
CypherCast turns passive live streams into an interactive economy. Instead of watching ads, fans stake SPL tokens on outcomes, win proportional rewards, and boost creator revenue in real time. The MVP is fully on-chain, proven by automated tests, and ready for investor demos.

### Why Now
- **Creators need new revenue rails** beyond ads and one-time tips.
- **Viewers crave ownership** in the moments they help create.
- **Solana makes micro-engagement viable** with sub-second finality and negligible fees.

### What We Deliver Today
- ✅ Stream lifecycle with deterministic PDAs for Streams, Participants, and Predictions.
- ✅ TokenVault custody securing all stakes and payouts.
- ✅ Proportional winner rewards after deducting a programmable streamer tip.
- ✅ CommunityVault scaffold for future DAO and sponsorship flows.
- ✅ Comprehensive documentation tailored for investors, builders, and operators.

---

## 🌟 Product Highlights
- **Instant Engagement** – Join a stream, stake on a prediction, and claim rewards seconds after the result.
- **Creator-first Monetization** – Configure `tip_bps` per stream; the program pays the tip automatically on resolution.
- **Transparent Economics** – Every stake, tip, and claim is recorded on-chain with event logs for analytics.
- **Composable Architecture** – On-chain accounts and events are designed for dashboards, leaderboards, and DeFi integrations.
- **Security by Design** – PDA ownership, overflow checks, and guard rails (max choices, precision limits, grace periods).

---

## 🧠 How It Works
1. **Create & Configure** – Streamer calls `create_stream`, setting start time, lock window, precision, and tip percentage.
2. **Stake Predictions** – Viewers join once, then place predictions. SPL tokens flow into the TokenVault PDA.
3. **Resolve & Tip** – Oracle finalizes the winning outcome. The program pays the creator tip immediately and freezes totals.
4. **Claim Rewards** – Winners withdraw their proportional share. Flags prevent double claims and late submissions.

See the full narrative in [docs/EVENT_STORMING.md](./docs/EVENT_STORMING.md).

---

## 📚 Documentation Map
| Audience | Start Here | Deep Dives |
| -------- | ---------- | ---------- |
| Investors & Partners | [docs/BUSINESS_MODEL.md](./docs/BUSINESS_MODEL.md) | [docs/MVP.md](./docs/MVP.md) |
| Engineers | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) |
| Operators | [docs/EVENT_STORMING.md](./docs/EVENT_STORMING.md) | [docs/CLI-QUICK-REF.md](./docs/CLI-QUICK-REF.md) |
| Testers | [docs/TESTING.md](./docs/TESTING.md) | [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) |

👉 Historical notes are preserved in [docs/archive/](./docs/archive/).

---

## 🧪 Quick Demo (Localnet)
```bash
# 1. Install dependencies
npm install

# 2. Run the full automated suite (spins up validator & deploys program)
npm test
# or
anchor test

# 3. Replay the flow manually
node cli/direct-cli.js demo
```
More detail: [docs/TESTING.md](./docs/TESTING.md) & [docs/CLI-QUICK-REF.md](./docs/CLI-QUICK-REF.md).

---

## 🧱 Tech Snapshot
| Layer | Highlights |
| ----- | ---------- |
| **On-chain** | Anchor 0.31.1 program with deterministic PDAs, proportional payouts, streamer tip distribution, community vault scaffold |
| **Token Logic** | SPL token custody via `TokenVault`, u128 math for rewards, event logging for analytics |
| **Tooling** | Mocha/TypeScript test suite, direct RPC CLI, automated local validator bootstrap |
| **Network** | Solana Localnet today → Devnet pilot planned in Phase 3 |

Explore structures and constants in [docs/DATA_MODEL.md](./docs/DATA_MODEL.md).

---

## 🛣️ Roadmap
| Phase | Goal | Highlights | Status |
| ----- | ---- | ---------- | ------ |
| **Phase 1 – MVP Core** | Prove interactive streaming on-chain | Stream PDAs, prediction + claim flow, CLI tooling | ✅ Complete |
| **Phase 2 – Token Vault** | Real token economics | SPL custody, CPI rewards, security hardening | ✅ Complete |
| **Phase 2.5 – Enhanced Rewards** | Monetization hooks | Proportional payouts, streamer tips, community vault scaffold | ✅ Complete |
| **Phase 3 – Frontend & UX** | Public dApp launch | React client, wallet adapter UX, analytics dashboards | 🎯 In progress |
| **Phase 4 – Market Proof** | Creator pilots | Sponsored pools, devnet campaign, retention metrics | 🔜 Planned |

Full change history: [CHANGELOG.md](./CHANGELOG.md).

---

## 🤝 Get Involved
We welcome:
- 🎨 Frontend collaborators to deliver the Phase 3 experience.
- 🤝 Partnerships with creators or media networks piloting interactive streams.
- 🧪 QA contributions expanding the proportional payout scenarios.
- 💬 Feedback from investors and ecosystems exploring tokenized engagement.

Open an issue, reach out via GitHub, or fork and experiment—CypherCast is ready for builders who believe viewers deserve more than passive ads.

---

## 📄 License
MIT License — see [LICENSE](./LICENSE).

---

## 🌐 Links & Attribution
- **GitHub**: [github.com/chankung9/cyphercast](https://github.com/chankung9/cyphercast)
- **Program ID**: `5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF` (Localnet)
- **Hackathon**: Solana Cypherpunk Hackathon, October 2025
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)

> “Streaming meets Web3. Viewers don't just watch — they own the moment.” — CypherCast Team 🚀
