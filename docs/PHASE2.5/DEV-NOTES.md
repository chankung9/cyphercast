# CypherCast Anchor Program – Phase 2.5 Dev Notes

Audience: engineers integrating on-chain logic, tests, analytics, and dashboards.

This document describes the Phase 2.5 changes to the Anchor program: new instructions, states/config, reward math, minimal Community Vault, and event emissions. It also summarizes the test coverage added for this phase and provides integration notes.

---------------------

## TL;DR

- Staking only happens on submit_prediction; join_stream no longer moves tokens.
- Rewards are proportional among winners after deducting a streamer tip.
- Auto lock by time on submit_prediction (cutoff = start_time + lock_offset_secs).
- Activation step freezes config via a config hash.
- Cancel & Refund flow for safe rollback.
- Minimal Community Vault PDA and init instruction.
- Event logs emitted on submit/resolve/claim for analytics.

---------------------

## Program State & Config

Stream fields (high-level):
- creator: Pubkey
- stream_id: u64
- title: String (<= 200 bytes)
- start_time: i64
- end_time: i64
- lock_offset_secs: i64
- grace_period_secs: i64
- tip_percent: u8 (1..=10)
- precision: u8 (<= 9)
- config_hash: [u8; 32] (set on activation)
- total_stake: u64 (sum of all stake amounts)
- total_by_choice: [u64; 11] (choice 0..=10)
- is_active: bool (legacy flag for Phase 1 compatibility)
- is_resolved: bool (legacy flag for Phase 1 compatibility)
- winning_choice: u8
- tip_amount: u64 (actual tip paid at resolve)
- resolved_at: i64
- canceled_at: i64
- bump: u8

Prediction fields:
- stream: Pubkey
- viewer: Pubkey
- choice: u8
- stake_amount: u64
- timestamp: i64
- reward_claimed: bool
- refunded: bool
- bump: u8

TokenVault fields:
- stream: Pubkey
- token_account: Pubkey (vault ATA owned by PDA)
- mint: Pubkey
- bump: u8
- total_deposited: u64
- total_released: u64

CommunityVault (minimal) fields:
- authority: Pubkey (temporary DAO signer, can be creator for now)
- token_account: Pubkey (community vault ATA)
- mint: Pubkey
- bump: u8
- total_contributions: u64

---------------------

## PDA Layout

- Stream: ["stream", creator, stream_id:u64]
- Participant: ["participant", stream, viewer]
- Prediction: ["prediction", stream, viewer]
- Vault (per stream): ["vault", stream]
- Community Vault (global): ["community_vault"]

Note: For Phase 2.5 we keep PDAs stable. Config updates never change PDAs (config is frozen by activation).

---------------------

## Instruction APIs (summaries)

All instructions follow Anchor’s `.methods.<ix>(...).accounts({...}).rpc()` client pattern.

1) create_stream(stream_id: u64, title: String, start_time: i64, lock_offset_secs: i64, tip_percent: u8, precision: u8, grace_period_secs: i64)
- Accounts:
  - stream (PDA, init, seeds ["stream", creator, stream_id])
  - creator (signer)
  - system_program
- Validations:
  - title <= 200 bytes
  - precision <= 9
  - tip_percent in [1,10]
- Initializes config fields and counters. Stream is marked active (legacy) but not yet “frozen”.

2) activate_stream()
- Accounts:
  - stream (mut)
  - creator (signer)
- Effects:
  - Computes config_hash from (title, tip_percent, precision, lock_offset_secs, grace_period_secs) to freeze config.
  - Fails if already activated, canceled, or resolved.

3) initialize_token_vault()
- Accounts:
  - creator (signer)
  - stream (mut)
  - vault (PDA, init, seeds ["vault", stream])
  - token_mint
  - vault_token_account (ATA owned by vault PDA)
  - token_program
  - associated_token_program
  - system_program
- Effects:
  - Creates program-controlled vault with mint and token account bound to PDA.

4) initialize_community_vault() [Minimal]
- Accounts:
  - creator (signer)
  - dao_authority (signer) — for now may be the creator
  - community_vault (PDA, init, seeds ["community_vault"])
  - token_mint
  - community_vault_token_account (ATA owned by community vault PDA)
  - token_program
  - associated_token_program
  - system_program
- Effects:
  - Creates global community vault PDA and its ATA.
  - Emits CommunityVaultInitialized.

5) join_stream(_stake_amount: u64)
- Accounts:
  - stream (mut)
  - participant (PDA, init, seeds ["participant", stream, viewer])
  - viewer (signer)
  - system_program
- Effects:
  - Only registers participation. No tokens move here in Phase 2.5.
- Guards:
  - stream.is_active must be true
  - stream.canceled_at == 0

6) submit_prediction(choice: u8, stake_amount: u64)
- Accounts:
  - stream (mut)
  - prediction (PDA, init, seeds ["prediction", stream, viewer])
  - vault (mut)
  - viewer_token_account (ATA; owner == viewer, mint == vault.mint)
  - vault_token_account (ATA; == vault.token_account, mint == vault.mint)
  - viewer (signer)
  - token_program
  - system_program
- Effects:
  - Transfers SPL token stake from viewer ATA to vault ATA.
  - Updates vault.total_deposited, stream.total_stake, and stream.total_by_choice[choice].
  - Emits PredictionSubmitted.
- Guards:
  - stream.is_active == true
  - stream.canceled_at == 0
  - stake_amount > 0
  - choice <= MAX_CHOICES
  - Auto lock: now < start_time + lock_offset_secs (else StreamLocked)

7) end_stream()
- Accounts:
  - stream (mut)
  - creator (signer)
- Effects:
  - stream.is_active = false; sets end_time (legacy compatibility).
- Guards:
  - Only creator can end stream.

8) resolve_prediction(winning_choice: u8)
- Accounts:
  - stream (mut)
  - creator (signer)
  - vault (mut)
  - creator_token_account (creator ATA; owner == creator, mint == vault.mint)
  - vault_token_account (== vault.token_account, mint == vault.mint)
  - token_program
- Effects:
  - Fails if still active or already resolved; only creator allowed.
  - tip_amount = floor(vault.total_deposited * tip_percent / 100) — pays tip from vault to creator ATA using PDA signer.
  - Sets stream.is_resolved, stream.winning_choice, resolved_at.
  - Emits StreamResolved.
- Guards:
  - winning_choice <= MAX_CHOICES

9) claim_reward()
- Accounts:
  - prediction (mut; has_one = viewer; prediction.stream == stream)
  - stream (mut)
  - vault (mut)
  - viewer_token_account (viewer ATA; owner == viewer, mint == vault.mint)
  - vault_token_account (== vault.token_account, mint == vault.mint)
  - viewer (signer)
  - token_program
- Effects:
  - Requires stream.is_resolved, not canceled.
  - Requires prediction.choice == stream.winning_choice.
  - Proportional reward:
    - distributable = vault.total_deposited - stream.tip_amount
    - winner_total = stream.total_by_choice[winning_choice]
    - reward = floor(distributable * user_stake / winner_total)
  - Transfers reward from vault -> viewer using PDA signer.
  - Sets prediction.reward_claimed = true.
  - Emits RewardClaimed.
- Guards:
  - NoWinner if winner_total == 0
  - Prevent double-claim and refund-then-claim

10) cancel_stream()
- Accounts:
  - stream (mut)
  - creator (signer)
- Effects:
  - Marks stream as canceled; is_active = false, canceled_at = now.
- Guards:
  - Only creator; not already canceled; not resolved.

11) claim_refund()
- Accounts:
  - prediction (mut; has_one = viewer; prediction.stream == stream)
  - stream (mut)
  - vault (mut)
  - viewer_token_account (viewer ATA)
  - vault_token_account (vault ATA)
  - viewer (signer)
  - token_program
- Effects:
  - Only valid if stream is canceled.
  - Transfers prediction.stake_amount from vault back to viewer.
  - Sets prediction.refunded = true.

---------------------

## Reward Math (Phase 2.5)

- Tip (paid once at resolve):
  - tip_amount = floor(total_pool * tip_percent / 100)
  - total_pool = vault.total_deposited

- Proportional rewards (per claim):
  - distributable = total_pool - tip_amount
  - winner_total = sum of stakes for winning choice
  - reward = floor(distributable * user_stake / winner_total)
  - Use u128 for multiplication and division, then cast to u64.

- Remainder handling:
  - Phase 2.5 minimal: remainder not yet routed to CommunityVault.
  - Future: send dust/remainder to CommunityVault and emit contribution event.

---------------------

## Events (for Analytics / Dashboards)

Emitted with emit! to be consumed over RPC logs.

- PredictionSubmitted
  - stream: Pubkey
  - viewer: Pubkey
  - choice: u8
  - amount: u64

- StreamResolved
  - stream: Pubkey
  - winning_choice: u8
  - tip_amount: u64

- RewardClaimed
  - stream: Pubkey
  - viewer: Pubkey
  - amount: u64

- CommunityVaultInitialized
  - authority: Pubkey
  - mint: Pubkey
  - token_account: Pubkey

Client listening pattern (TS):
- Use the program client’s event listener facility to subscribe.
- Ensure the program IDL has these events exposed (build before strict typing).

---------------------

## Error Codes (selected)

- TitleTooLong
- InvalidConfig (precision > 9, tip_percent not in [1,10])
- StreamNotActive
- StreamStillActive
- StreamLocked (time-based cutoff reached)
- Unauthorized
- AlreadyResolved
- NotResolved
- NotWinner
- RewardAlreadyClaimed
- RefundAlreadyClaimed
- Canceled
- AlreadyCanceled
- AlreadyActivated
- NoWinner
- Overflow

---------------------

## Breaking Changes vs Phase 2

- join_stream no longer transfers tokens or contributes to stake totals.
- submit_prediction is the only place tokens move into the vault and totals are tracked.
- resolve_prediction requires additional accounts (vault, vault_token_account, creator_token_account, token_program) to pay tip prior to claims.
- Stream now includes config and runtime fields; create_stream signature changed.
- Activation step added to freeze config (activate_stream).

Migration note: Any existing on-chain data from earlier phases will not match the new layouts. For local/test/devnets, recreate streams; for mainnet, plan a proper migration.

---------------------

## Tests (added in Phase 2.5)

All tests live under tests/phase2-token-vault.ts (ts-mocha).

Key scenarios:
- Token vault lifecycle: create → activate → init vault
- Join without staking
- Submit prediction with SPL token stake
- End + resolve with streamer tip paid
- Claim reward (proportional post-tip)
- Double-claim prevention
- Incorrect prediction claim prevention
- Multiple winners proportional distribution (with tip)
- Cancel & Refund (stake returned fully)
- Community vault init (event emission)
- Event emissions on submit/resolve/claim
- No-winner claim should fail
- Auto-lock rejects late submission

Running tests:
- Build program: `anchor build`
- Run: `anchor test` (or use ts-mocha targeting the test file)
- If not using generated types, cast program client to any in TS; for strict typing regenerate IDL and use Program<Cyphercast>.

---------------------

## Security & Validation Notes

- Token account constraints:
  - viewer_token_account.owner == viewer
  - viewer_token_account.mint == vault.mint
  - vault_token_account == vault.token_account
  - vault_token_account.mint == vault.mint
- Auto-lock prevents late staking.
- Proportional payouts use u128 intermediate math to avoid overflow.
- Cancel prevents further participation and enables refunds.
- Activation freezes config to prevent mid-stream changes.

---------------------

## Community Vault (Minimal in Phase 2.5)

- Provides PDA and ATA to aggregate community-bound funds in future phases.
- Exposes initialization and event emission.
- DAO authority is a signer param for now (can be creator).
- Next steps:
  - Route remainders/dust to CommunityVault on resolve/claim flows.
  - Add sweep_unclaimed_to_community after grace period.
  - Add dao_withdraw gated by DAO authority.
  - Emit VaultContribution events on each sweep/contribution.

---------------------

## Future Work (beyond Phase 2.5)

- State machine formalization (replace legacy is_active / is_resolved with enum)
- Manual lock instruction (irreversible)
- Unclaimed sweep + Closed state
- DAO authority redesign + governance hooks
- Formal documentation with diagrams and state transitions

---------------------

## Integration Checklist

- Update client to pass the new accounts on resolve_prediction (vault + creator ATA + vault ATA + token program).
- Ensure submit_prediction caller has sufficient token balance and correct mint.
- Subscribe to events for analytics dashboards:
  - PredictionSubmitted
  - StreamResolved
  - RewardClaimed
  - CommunityVaultInitialized
- Handle errors gracefully in UI/API (NotWinner, StreamLocked, Canceled, etc).
- For strict typing in TS, run Anchor build to generate IDL/types.

---------------------

Last updated: Phase 2.5