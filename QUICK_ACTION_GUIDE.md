# ⚡ Quick Action Guide - 9-Day Sprint

**Last Updated:** October 14, 2025  
**Days Remaining:** 9  
**Status:** 🔴 CRITICAL PATH

---

## 🎯 TODAY'S PRIORITY (Day 1)

### Core Smart Contract - Reward System Implementation

**Time Allocation:** 6-8 hours

#### Task 1: Design Reward Formula (1 hour)
```rust
// Recommended Simple Formula for MVP:
// 
// Total Pool = Sum of all prediction stakes
// Winner Pool = Stakes from winning predictions
// Creator Fee = 5% of Total Pool
// 
// For each winner:
// Reward = (Winner Stake / Total Winner Stakes) × (Total Pool × 0.95) + Winner Stake
```

#### Task 2: Implement `resolve_prediction()` (2-3 hours)
- [ ] Add instruction to lib.rs
- [ ] Validate oracle/creator authority
- [ ] Mark winning outcome
- [ ] Calculate total pools
- [ ] Update stream state

#### Task 3: Implement `claim_reward()` (2-3 hours)
- [ ] Add instruction to lib.rs
- [ ] Verify user has winning prediction
- [ ] Calculate user's reward share
- [ ] Transfer from TokenVault to user
- [ ] Mark prediction as claimed
- [ ] Prevent double-claiming

#### Task 4: Basic Testing (1-2 hours)
- [ ] Write test for resolution
- [ ] Write test for claim
- [ ] Test edge cases (no winners, ties)

**End of Day Milestone:** ✅ All 5 instructions implemented and tested

---

## 📅 Week-at-a-Glance

```
┌─────────┬──────────────────────────────┬──────────────┐
│   Day   │         Main Focus           │   Priority   │
├─────────┼──────────────────────────────┼──────────────┤
│ 1 (Mon) │ Reward System Implementation │ 🔴 CRITICAL  │
│ 2 (Tue) │ Smart Contract Completion    │ 🔴 CRITICAL  │
│ 3 (Wed) │ Devnet Deployment + Testing  │ 🟠 HIGH      │
│ 4 (Thu) │ Frontend Setup + Integration │ 🟠 HIGH      │
│ 5 (Fri) │ Core UI Components           │ 🟠 HIGH      │
│ 6 (Sat) │ End-to-End User Flow         │ 🟡 MEDIUM    │
│ 7 (Sun) │ Demo Video Recording         │ 🟡 MEDIUM    │
│ 8 (Mon) │ Polish + Documentation       │ 🟡 MEDIUM    │
│ 9 (Tue) │ Final Submission + Buffer    │ 🔴 CRITICAL  │
└─────────┴──────────────────────────────┴──────────────┘
```

---

## 🚀 Quick Start Commands

### Smart Contract Development
```bash
# Navigate to project
cd /path/to/cyphercast

# Build program
anchor build

# Run tests
anchor test

# Deploy to Devnet
anchor deploy --provider.cluster devnet

# Get program ID
solana address -k target/deploy/cyphercast-keypair.json
```

### Frontend Development
```bash
# Set up frontend (when ready)
npx create-solana-dapp@latest cyphercast-app
cd cyphercast-app

# Install dependencies
npm install

# Run dev server
npm run dev
```

### Testing on Devnet
```bash
# Set to Devnet
solana config set --url devnet

# Check balance
solana balance

# Airdrop SOL (if needed)
solana airdrop 2

# View recent transactions
solana confirm -v <TRANSACTION_SIGNATURE>
```

---

## ✅ Daily Completion Checklist

**Copy this checklist each day:**

```
Date: ___________

Morning (8am - 12pm):
[ ] Review yesterday's progress
[ ] Identify today's #1 priority
[ ] Set specific, measurable goal
[ ] Begin coding/implementation

Afternoon (1pm - 5pm):
[ ] Continue implementation
[ ] Test changes incrementally
[ ] Commit working code
[ ] Document any blockers

Evening (6pm - 9pm):
[ ] Complete day's milestone
[ ] Write/update tests
[ ] Push to repository
[ ] Plan tomorrow's tasks
[ ] Update progress in timeline doc

Blockers/Issues:
_________________________________
_________________________________

Tomorrow's Top 3 Tasks:
1. _________________________________
2. _________________________________
3. _________________________________
```

---

## 🎯 Critical Milestones Tracker

### Week 1 Milestones

- [ ] **Day 1-2:** Smart contract with all 5 instructions working
  - [ ] `create_stream()` ✅
  - [ ] `join_stream()` ✅
  - [ ] `submit_prediction()` ✅
  - [ ] `resolve_prediction()` ⏳
  - [ ] `claim_reward()` ⏳

- [ ] **Day 3:** Deployed to Devnet with passing tests
  - [ ] Deployment successful
  - [ ] Program ID documented
  - [ ] Test transactions confirmed
  - [ ] Explorer links working

- [ ] **Day 4-5:** Frontend with wallet connection
  - [ ] Wallet adapter integrated
  - [ ] Can connect Phantom/Solflare
  - [ ] Display wallet balance
  - [ ] Send test transaction

- [ ] **Day 6:** Complete user flow working
  - [ ] Creator can create stream
  - [ ] Viewer can submit prediction
  - [ ] Admin can resolve
  - [ ] Winner can claim

- [ ] **Day 7-8:** Demo ready
  - [ ] Video recorded
  - [ ] Documentation complete
  - [ ] Presentation deck ready

- [ ] **Day 9:** Submitted
  - [ ] Code pushed
  - [ ] Links verified
  - [ ] Submission confirmed

---

## 🚨 Emergency Decision Matrix

**If you're running behind schedule:**

### Scenario 1: Day 3 - Smart contract not working
**Action:** 
- Skip advanced features
- Use simplest possible reward formula
- Focus on making ONE prediction scenario work
- Document others as "future work"

### Scenario 2: Day 5 - Frontend not started
**Action:**
- Use Solana dApp Scaffold (don't build from scratch)
- Copy-paste working examples
- Focus on functionality over design
- Use default styling

### Scenario 3: Day 7 - No end-to-end flow working
**Action:**
- Record demo with mock data if needed
- Show each component working independently
- Be transparent about integration status
- Focus on explaining the vision

### Scenario 4: Day 9 - Major bugs discovered
**Action:**
- Document known issues
- Submit anyway with disclaimer
- Show what works
- Explain how to fix (even if not fixed)

---

## 💡 Time-Saving Tips

### Code Snippets & Templates

**1. Simple Reward Calculation:**
```rust
pub fn calculate_rewards(
    total_pool: u64,
    winner_stakes: u64,
    user_stake: u64,
    creator_fee_bps: u16, // basis points (500 = 5%)
) -> (u64, u64) {
    let creator_fee = (total_pool * creator_fee_bps as u64) / 10000;
    let reward_pool = total_pool - creator_fee;
    let user_reward = (reward_pool * user_stake) / winner_stakes;
    (user_reward, creator_fee)
}
```

**2. PDA Derivation Pattern:**
```rust
pub fn get_stream_pda(stream_id: &str) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"stream", stream_id.as_bytes()],
        program_id,
    )
}
```

**3. Frontend RPC Connection:**
```typescript
import { Connection, clusterApiUrl } from '@solana/web3.js';

const connection = new Connection(
  clusterApiUrl('devnet'),
  'confirmed'
);
```

### Resources to Copy From
1. **Anchor Examples:** https://github.com/coral-xyz/anchor/tree/master/tests
2. **Solana Cookbook:** https://solanacookbook.com/
3. **dApp Scaffold:** https://github.com/solana-labs/dapp-scaffold
4. **Wallet Adapter:** https://github.com/solana-labs/wallet-adapter

---

## 📞 When to Ask for Help

**Ask immediately if:**
- ❌ Stuck on same issue for >2 hours
- ❌ Security concern in smart contract
- ❌ Deployment fails multiple times
- ❌ Critical dependency is broken
- ❌ Test environment not working

**Where to ask:**
- Solana StackExchange
- Anchor Discord: https://discord.gg/anchor
- Solana Tech Discord: https://discord.gg/solana
- Hackathon support channel

---

## 🎬 Demo Video Checklist

**Before Recording:**
- [ ] Full flow works end-to-end
- [ ] Test data is prepared
- [ ] Screen is clean (close unnecessary windows)
- [ ] Audio test completed
- [ ] Script written and practiced

**During Recording:**
- [ ] Introduction (15 sec): Problem statement
- [ ] Architecture (30 sec): Quick diagram walkthrough
- [ ] Demo (3 min): Live interaction
  - [ ] Create stream
  - [ ] Submit predictions (multiple wallets)
  - [ ] Resolve outcome
  - [ ] Claim reward
  - [ ] Show Solana Explorer
- [ ] Vision (30 sec): Future potential
- [ ] Call to action (15 sec)

**After Recording:**
- [ ] Edit for clarity
- [ ] Add captions/annotations
- [ ] Export in high quality
- [ ] Upload to YouTube
- [ ] Test link works
- [ ] Add to README

---

## 📊 Progress Tracker

**Update this table daily:**

| Metric | Target | Current | % Complete |
|--------|--------|---------|------------|
| Smart Contract Instructions | 5 | 3 | 60% |
| Tests Written | 10 | 0 | 0% |
| Frontend Pages | 3 | 0 | 0% |
| Demo Video | 1 | 0 | 0% |
| Documentation | 100% | 70% | 70% |
| **Overall Progress** | **100%** | **~25%** | **25%** |

---

## 🎯 Remember

> **"Perfect is the enemy of done."**

**Focus on:**
- ✅ Working > Perfect
- ✅ Demo-able > Feature-complete
- ✅ Simple > Complex
- ✅ Tested > Theoretical

**Your goal:** Prove the concept works. Everything else is optional.

---

**Need the full analysis?** → See [TIMELINE_ASSESSMENT.md](./TIMELINE_ASSESSMENT.md)

**Good luck! You've got this! 🚀**
