# CypherCast Reward System Documentation

## Overview

CypherCast implements a proportional reward distribution system where users stake SPL tokens on predictions and receive rewards based on their contribution to the winning choice pool.

## Reward Formula

### Core Calculation

```
reward_amount = (distributable_pool × user_stake) ÷ winner_total_stake
```

Where:
- `distributable_pool = total_deposited - streamer_tip`
- `user_stake` = Individual prediction stake amount
- `winner_total_stake` = Sum of all stakes for the winning choice

### Streamer Tip Calculation

```
streamer_tip = floor(total_deposited × tip_bps ÷ 10,000)
```

- `tip_bps` = Basis points (0-10,000, where 1000 = 10%)
- Uses floor division for integer precision
- Paid only once at stream resolution

## Example Calculations

### Single Winner Scenario
- Total deposited: 100 tokens
- Tip BPS: 1000 (10%)
- User stake: 100 tokens
- Winner total: 100 tokens

```
streamer_tip = floor(100 × 1000 ÷ 10,000) = 10 tokens
distributable_pool = 100 - 10 = 90 tokens
reward_amount = (90 × 100) ÷ 100 = 90 tokens
```

### Multiple Winners Scenario
- Total deposited: 80 tokens (30 + 50 from winners)
- Tip BPS: 1000 (10%)
- User 1 stake: 30 tokens
- User 2 stake: 50 tokens
- Winner total: 80 tokens

```
streamer_tip = floor(80 × 1000 ÷ 10,000) = 8 tokens
distributable_pool = 80 - 8 = 72 tokens
User 1 reward = (72 × 30) ÷ 80 = 27 tokens
User 2 reward = (72 × 50) ÷ 80 = 45 tokens
```

## Integer Precision

- All calculations use u128 intermediate values to prevent overflow
- Final amounts are cast to u64 (token amounts)
- Floor division is used for all divisions
- Remainder tokens remain in the vault

## Edge Cases

### No Winners
- If `winner_total_stake = 0`, claims fail with `NoWinner` error
- All tokens remain in vault

### Zero Distributable Pool
- If `distributable_pool = 0`, reward amount is 0
- Users can claim but receive no tokens

### Overflow Protection
- All calculations include overflow checks
- Transactions fail with `Overflow` error if limits exceeded

## Refund System

### Canceled Streams
- Full stake amount returned: `refund_amount = user_stake`
- No tip deducted from canceled streams
- Refunds marked with `refunded = true`

### Double Claim Prevention
- `reward_claimed` flag prevents multiple reward claims
- `refunded` flag prevents multiple refund claims
- Cross-validation prevents refund after reward claim

## Error Codes

| Error | Condition | Resolution |
|-------|-----------|------------|
| `Unauthorized` | Non-creator tries to initialize vault/resolve | Use creator account |
| `RewardAlreadyClaimed` | User claims reward twice | Check claim status first |
| `RefundAlreadyClaimed` | User claims refund twice | Check refund status first |
| `NoWinner` | No winners for resolved choice | Verify winning choice |
| `Overflow` | Calculation exceeds u64 limits | Reduce stake amounts |
| `NotWinner` | User claims for wrong prediction | Verify prediction choice |

## Integration Notes

### Frontend Calculations
Frontend should use the same formula to display expected rewards:

```typescript
function calculateExpectedReward(
  userStake: number,
  winnerTotal: number,
  totalDeposited: number,
  tipBps: number
): number {
  const tipAmount = Math.floor(totalDeposited * tipBps / 10000);
  const distributable = totalDeposited - tipAmount;
  return Math.floor(distributable * userStake / winnerTotal);
}
```

### Event Listening
Monitor these events for real-time updates:
- `StreamResolved`: Contains tip amount
- `RewardClaimed`: Contains actual reward paid
- `PredictionSubmitted`: Tracks user stakes

## Security Considerations

1. **PDA Signing**: Vault uses PDA seeds for secure token transfers
2. **Authorization**: Only creators can resolve streams and initialize vaults
3. **State Validation**: All operations check stream state (active, resolved, canceled)
4. **Double Spend Protection**: Flags prevent multiple claims/refunds
5. **Precision Handling**: Integer math prevents floating point errors
