# CypherCast Event Storming

## Purpose
Event storming illustrates the lifecycle of an interactive stream from creation to reward payout. This narrative stitches together user actions, on-chain instructions, and emitted events so non-technical stakeholders can follow the experience end-to-end.

## Key Actors
- **Creator** – Launches the stream and sets configuration values.
- **Viewer** – Joins the session, stakes tokens, and claims rewards.
- **Oracle / Moderator** – Provides the authoritative result when the stream ends.
- **Program** – The Anchor contract enforcing rules and payouts.

## Event Timeline
| # | Event | Trigger | Result |
| - | ----- | ------- | ------ |
| 1 | `StreamPlanned` (off-chain) | Creator drafts schedule & metadata | Title, artwork, and tip percentage shared with the community |
| 2 | `StreamCreated` | `create_stream` instruction | `Stream` PDA initialized with timing windows, tip settings, and zeroed totals |
| 3 | `VaultReady` | `initialize_token_vault` | TokenVault PDA and ATA created; staking token mint locked |
| 4 | `CommunityVaultReady` (optional) | `initialize_community_vault` | DAO treasury account prepared to receive revenue |
| 5 | `ViewerJoined` | `join_stream` | Participant PDA records viewer entry without forcing an immediate stake |
| 6 | `PredictionSubmitted` | `submit_prediction` | SPL tokens move into the TokenVault and an event is emitted for analytics |
| 7 | `LockReached` | On-chain clock check | Additional predictions rejected once `start_time + lock_offset_secs` has passed |
| 8 | `StreamResolved` | `resolve_prediction` | Winning choice stored, streamer tip transferred, aggregate totals frozen |
| 9 | `RewardClaimed` | `claim_reward` | Winner receives proportional share, `reward_claimed` flag flips to prevent re-entry |
| 10 | `TreasuryFunded` (future) | Custom instruction | Contributions move from TokenVault to CommunityVault for platform incentives |

## Narrative Walkthrough
1. **Creator primes the event** by promoting the stream and submitting `create_stream` with the desired tip percentage and timing guards.
2. **Before going live**, the creator initializes the TokenVault so any incoming stakes have a custody destination. If the campaign shares revenue with the community treasury, they also call `initialize_community_vault`.
3. **Viewers arrive and join** the stream. Joining records their presence and enables later whitelisting features, but staking is deferred until a prediction is made.
4. **Predictions flow in** once the question is announced. Each call to `submit_prediction` transfers tokens, updates aggregate totals for the selected choice, and publishes a `PredictionSubmitted` event for dashboards.
5. **At the lock time**, the program automatically rejects late predictions, keeping the contest fair without manual intervention.
6. **When the outcome is known**, an authorized oracle executes `resolve_prediction`. The program deducts the streamer tip, emits `StreamResolved`, and stores the winning totals for payout math.
7. **Winners self-serve rewards** through `claim_reward`. The instruction checks the stored totals, calculates the viewer’s share of the distributable pool, and signs a token transfer from the vault PDA.
8. **Analytics tools** listen to both events to display leaderboards, calculate creator revenue, and measure participation for future sponsorship deals.

## Cancellation & Grace Period
- If a stream must be canceled, the system will set `canceled_at` and future work will trigger refunds using the `refunded` flag on predictions.
- `grace_period_secs` gives operators a buffer to validate oracle data before claims open, a feature earmarked for Phase 3 automation.

## Future Events
As the product evolves, additional events such as `RefundIssued`, `VaultContribution`, or `MilestoneUnlocked` can extend this timeline without altering the existing flow, preserving backwards compatibility for early adopters.
