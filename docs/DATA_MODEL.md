# CypherCast Data Model

## Overview
The CypherCast Anchor program stores all state inside deterministic Program Derived Accounts (PDAs). This document catalogs the primary accounts, their fields, and the PDA seeds used to derive them. It reflects the Phase 2.5 implementation with proportional rewards, streamer tips, and the community vault scaffold.

## Account Summary
| Account | Purpose | Seed Formula |
| ------- | ------- | ------------ |
| `Stream` | Configures a live session, scheduling rules, and monetization settings | `seeds = [b"stream", creator, stream_id]` |
| `Participant` | Tracks that a viewer has joined a stream | `seeds = [b"participant", stream, viewer]` |
| `Prediction` | Records each viewer prediction and stake | `seeds = [b"prediction", stream, viewer]` |
| `TokenVault` | Holds SPL tokens staked for a stream | `seeds = [b"vault", stream]` |
| `CommunityVault` | Treasury controlled by DAO authority | `seeds = [b"community_vault", mint, authority]` |

## Stream Account
| Field | Type | Description |
| ----- | ---- | ----------- |
| `creator` | `Pubkey` | Wallet that created the stream |
| `stream_id` | `u64` | External identifier supplied by creator |
| `title` | `String (<=200)` | Display title synced with off-chain metadata |
| `start_time` | `i64` | UNIX timestamp when stream goes live |
| `end_time` | `i64` | Completion timestamp (set on resolve or cancel) |
| `lock_offset_secs` | `i64` | Seconds after `start_time` when predictions close |
| `grace_period_secs` | `i64` | Buffer window for disputes/refunds |
| `tip_bps` | `u16` | Streamer tip in basis points (0–10,000) |
| `precision` | `u8` | Decimal precision for reward math (<= 9) |
| `config_hash` | `[u8; 32]` | Future-proof hash of immutable config data |
| `total_stake` | `u64` | Aggregate amount staked across all choices |
| `total_by_choice` | `[u64; 11]` | Per-choice stake totals used for proportional rewards |
| `is_active` | `bool` | Legacy flag for compatibility, indicates stream is live |
| `is_resolved` | `bool` | Indicates winning choice has been set |
| `winning_choice` | `u8` | Index of winning choice (0..=10) |
| `tip_amount` | `u64` | Actual tip paid to creator during resolution |
| `resolved_at` | `i64` | Timestamp when `resolve_prediction` executed |
| `canceled_at` | `i64` | Timestamp when stream was cancelled |
| `bump` | `u8` | PDA bump seed |

**Capacity** – `Stream::SPACE` reserves room for titles up to 200 bytes and the full `total_by_choice` array.

## Participant Account
| Field | Type | Description |
| ----- | ---- | ----------- |
| `stream` | `Pubkey` | Associated `Stream` account |
| `viewer` | `Pubkey` | Wallet that joined |
| `stake_amount` | `u64` | Latest stake snapshot (Phase 2.5 defers stake until prediction) |
| `joined_at` | `i64` | UNIX timestamp of the join action |
| `bump` | `u8` | PDA bump seed |

## Prediction Account
| Field | Type | Description |
| ----- | ---- | ----------- |
| `stream` | `Pubkey` | Associated `Stream` account |
| `viewer` | `Pubkey` | Wallet that placed the prediction |
| `choice` | `u8` | Selected outcome (0..=10, enforced by `MAX_CHOICES`) |
| `stake_amount` | `u64` | Amount transferred into the TokenVault |
| `timestamp` | `i64` | Time prediction was submitted |
| `reward_claimed` | `bool` | Guard flag preventing double claims |
| `refunded` | `bool` | Guard flag for potential cancellation refunds |
| `bump` | `u8` | PDA bump seed |

## TokenVault Account
| Field | Type | Description |
| ----- | ---- | ----------- |
| `stream` | `Pubkey` | Stream associated with this vault |
| `token_account` | `Pubkey` | Associated token account (ATA) controlled by the vault PDA |
| `mint` | `Pubkey` | SPL token mint accepted for staking |
| `bump` | `u8` | PDA bump seed |
| `total_deposited` | `u64` | Cumulative SPL tokens staked |
| `total_released` | `u64` | Tokens paid out to winners and tips |

**Reward Flow** – When `resolve_prediction` runs, the program computes the streamer tip and records it in the `Stream`. Winners later withdraw from the remaining pool through `claim_reward`.

## CommunityVault Account (Scaffold)
| Field | Type | Description |
| ----- | ---- | ----------- |
| `authority` | `Pubkey` | DAO or multisig that governs the vault |
| `token_account` | `Pubkey` | ATA holding treasury funds |
| `mint` | `Pubkey` | Token denomination for treasury |
| `bump` | `u8` | PDA bump seed |
| `total_contributions` | `u64` | Sum of tokens routed into the vault |

## Constants & Helpers
- `MAX_CHOICES = 10` – The program preallocates 11 entries (`0..=10`) for predictions.
- `DISCRIMINATOR = 8` – Anchor prefix included in all account size calculations.
- **Time Guards** – Submissions compare the current clock against `start_time + lock_offset_secs`.
- **Precision Guard** – `precision <= 9` prevents arithmetic overflow for decimal math.

## Derived Data
- **Config Hash** – Stored today as zeroed bytes; subsequent releases will compute a SHA-256 over immutable parameters to detect tampering.
- **Tip Amount** – Calculated as `floor(total_deposited * tip_bps / 10_000)` and stored on the stream for analytics.
- **Proportional Rewards** – Winners receive `stake_amount / total_by_choice[winner]` share of the distributable pool (`total_deposited - tip_amount`).

## Related Events
| Event | When Emitted | Payload |
| ----- | ------------ | ------- |
| `PredictionSubmitted` | After every prediction | Stream, viewer, choice, amount |
| `StreamResolved` | When oracle finalizes outcome | Stream, winning choice, tip amount |

These events enable lightweight indexing for dashboards without reading account data directly.
