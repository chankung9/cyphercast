use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF");

#[program]
pub mod cyphercast {
    use super::*;

    /// Maximum number of prediction choices supported by the program.
    pub const MAX_CHOICES: u8 = 10;

    /// Size of the discriminator added by Anchor to all accounts
    pub const DISCRIMINATOR: usize = 8;

    /// Initialize a token vault for a stream to hold staked SPL tokens
    pub fn initialize_token_vault(ctx: Context<InitializeTokenVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let stream = &ctx.accounts.stream;

        // Only the stream creator can initialize the vault
        require!(
            stream.creator == *ctx.accounts.creator.key,
            CypherCastError::Unauthorized
        );

        vault.stream = stream.key();
        vault.token_account = ctx.accounts.vault_token_account.key();
        vault.mint = ctx.accounts.token_mint.key();
        vault.bump = ctx.bumps.vault;
        vault.total_deposited = 0;
        vault.total_released = 0;

        msg!(
            "Token vault initialized for stream {} with token account {}",
            stream.stream_id,
            vault.token_account
        );
        Ok(())
    }

    pub fn create_stream(
        ctx: Context<CreateStream>,
        stream_id: u64,
        title: String,
        start_time: i64,
        lock_offset_secs: i64,
        tip_bps: u16,
        precision: u8,
        grace_period_secs: i64,
    ) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        require!(title.as_bytes().len() <= 200, CypherCastError::TitleTooLong);
        require!(precision <= 9, CypherCastError::InvalidConfig);
        require!(tip_bps <= 10_000, CypherCastError::InvalidConfig);

        stream.creator = *ctx.accounts.creator.key;
        stream.stream_id = stream_id;
        stream.title = title.clone();
        stream.start_time = start_time;
        stream.end_time = 0;
        // Phase 2.5 config
        stream.lock_offset_secs = lock_offset_secs;
        stream.grace_period_secs = grace_period_secs;
        stream.tip_bps = tip_bps;
        stream.precision = precision;
        stream.config_hash = [0u8; 32]; // computed on activation in later phase
                                        // Aggregates
        stream.total_stake = 0;
        stream.total_by_choice = [0; 11];
        // State flags (compat)
        stream.is_active = true;
        stream.is_resolved = false;
        stream.winning_choice = 0;
        // Runtime
        stream.tip_amount = 0;
        stream.resolved_at = 0;
        stream.canceled_at = 0;
        stream.bump = ctx.bumps.stream;

        msg!("Stream created: {} by {}", title, stream.creator);
        Ok(())
    }

    pub fn join_stream(ctx: Context<JoinStream>, _stake_amount: u64) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        let participant = &mut ctx.accounts.participant;

        require!(stream.is_active, CypherCastError::StreamNotActive);
        require!(stream.canceled_at == 0, CypherCastError::Canceled);

        participant.stream = stream.key();
        participant.viewer = *ctx.accounts.viewer.key;
        participant.stake_amount = 0;
        participant.joined_at = Clock::get()?.unix_timestamp;
        participant.bump = ctx.bumps.participant;

        msg!(
            "User {} joined stream {}",
            participant.viewer,
            stream.stream_id,
        );
        Ok(())
    }

    pub fn submit_prediction(
        ctx: Context<SubmitPrediction>,
        choice: u8,
        stake_amount: u64,
    ) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let stream = &mut ctx.accounts.stream;
        let vault = &mut ctx.accounts.vault;

        require!(stream.is_active, CypherCastError::StreamNotActive);
        require!(stream.canceled_at == 0, CypherCastError::Canceled);
        require!(stake_amount > 0, CypherCastError::InvalidStakeAmount);
        require!(choice <= MAX_CHOICES, CypherCastError::InvalidChoice);
        // Auto time-based lock: reject submissions at/after cutoff
        let now = Clock::get()?.unix_timestamp;
        require!(
            now < stream
                .start_time
                .checked_add(stream.lock_offset_secs)
                .ok_or(CypherCastError::Overflow)?,
            CypherCastError::StreamLocked
        );

        // Transfer SPL tokens from viewer's ATA to vault ATA for prediction stake
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.viewer_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.viewer.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, stake_amount)?;

        vault.total_deposited = vault
            .total_deposited
            .checked_add(stake_amount)
            .ok_or(CypherCastError::Overflow)?;

        // Track total stake and per-choice totals on stream for proportional rewards
        stream.total_stake = stream
            .total_stake
            .checked_add(stake_amount)
            .ok_or(CypherCastError::Overflow)?;
        let idx = choice as usize;
        stream.total_by_choice[idx] = stream.total_by_choice[idx]
            .checked_add(stake_amount)
            .ok_or(CypherCastError::Overflow)?;

        prediction.stream = stream.key();
        prediction.viewer = *ctx.accounts.viewer.key;
        prediction.choice = choice;
        prediction.stake_amount = stake_amount;
        prediction.timestamp = Clock::get()?.unix_timestamp;
        prediction.reward_claimed = false;
        prediction.bump = ctx.bumps.prediction;

        msg!(
            "Prediction submitted: choice {} with stake {} tokens by {}",
            choice,
            stake_amount,
            prediction.viewer
        );

        emit!(PredictionSubmitted {
            stream: stream.key(),
            viewer: prediction.viewer,
            choice,
            amount: stake_amount
        });

        Ok(())
    }

    pub fn initialize_community_vault(ctx: Context<InitializeCommunityVault>) -> Result<()> {
        let vault = &mut ctx.accounts.community_vault;
        vault.authority = ctx.accounts.dao_authority.key();
        vault.token_account = ctx.accounts.community_vault_token_account.key();
        vault.mint = ctx.accounts.token_mint.key();
        vault.bump = ctx.bumps.community_vault;
        vault.total_contributions = 0;

        emit!(CommunityVaultInitialized {
            authority: vault.authority,
            mint: vault.mint,
            token_account: vault.token_account
        });

        msg!(
            "Community vault initialized with token account {}",
            vault.token_account
        );
        Ok(())
    }

    pub fn end_stream(ctx: Context<EndStream>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;

        require!(stream.is_active, CypherCastError::StreamNotActive);
        require!(
            stream.creator == *ctx.accounts.creator.key,
            CypherCastError::Unauthorized
        );

        stream.end_time = Clock::get()?.unix_timestamp;
        stream.is_active = false;

        msg!("Stream {} ended by creator", stream.stream_id);
        Ok(())
    }

    pub fn resolve_prediction(ctx: Context<ResolvePrediction>, winning_choice: u8) -> Result<()> {
        let stream = &mut ctx.accounts.stream;

        // The stream must be inactive before resolving predictions.
        require!(!stream.is_active, CypherCastError::StreamStillActive);
        // The stream cannot be resolved more than once.
        require!(!stream.is_resolved, CypherCastError::AlreadyResolved);
        // Validate the winning choice against the maximum allowed choices.
        require!(
            winning_choice <= MAX_CHOICES,
            CypherCastError::InvalidChoice
        );
        // Only the creator of the stream can resolve the prediction.
        require!(
            stream.creator == *ctx.accounts.creator.key,
            CypherCastError::Unauthorized
        );

        // Compute and distribute streamer tip (once) at resolve time
        // tip_amount = floor(vault.total_deposited * tip_percent / 100)
        let total_pool = ctx.accounts.vault.total_deposited;
        if stream.tip_amount == 0 && stream.tip_bps > 0 {
            let tip_amount =
                ((total_pool as u128).saturating_mul(stream.tip_bps as u128) / 10_000u128) as u64;

            if tip_amount > 0 {
                let stream_key = stream.key();
                let vault_bump = ctx.accounts.vault.bump;
                let signer_seeds: &[&[&[u8]]] = &[&[b"vault", stream_key.as_ref(), &[vault_bump]]];

                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.creator_token_account.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                );
                token::transfer(cpi_ctx, tip_amount)?;

                // track release
                ctx.accounts.vault.total_released = ctx
                    .accounts
                    .vault
                    .total_released
                    .checked_add(tip_amount)
                    .ok_or(CypherCastError::Overflow)?;
                stream.tip_amount = tip_amount;
            }
        }

        stream.is_resolved = true;
        stream.winning_choice = winning_choice;
        stream.resolved_at = Clock::get()?.unix_timestamp;

        msg!(
            "Stream {} resolved with winning choice {} (tip: {})",
            stream.stream_id,
            winning_choice,
            stream.tip_amount
        );

        emit!(StreamResolved {
            stream: stream.key(),
            winning_choice,
            tip_amount: stream.tip_amount
        });

        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let stream = &ctx.accounts.stream;

        // Ensure the stream has been resolved and not canceled.
        require!(stream.is_resolved, CypherCastError::NotResolved);
        require!(stream.canceled_at == 0, CypherCastError::Canceled);
        // Only predictions that match the winning choice can claim rewards.
        require!(
            prediction.choice == stream.winning_choice,
            CypherCastError::NotWinner
        );
        // Prevent double-claiming of rewards and refunds.
        require!(
            !prediction.reward_claimed,
            CypherCastError::RewardAlreadyClaimed
        );
        require!(!prediction.refunded, CypherCastError::RefundAlreadyClaimed);

        // Proportional reward: user's stake share of the total winning stake over entire vault pool
        let winner_total = stream.total_by_choice[stream.winning_choice as usize];
        require!(winner_total > 0, CypherCastError::NoWinner);

        // Use distributable pool after streamer tip
        let distributable = ctx
            .accounts
            .vault
            .total_deposited
            .checked_sub(stream.tip_amount)
            .ok_or(CypherCastError::Overflow)?;
        let reward_amount = if distributable == 0 {
            0
        } else {
            (distributable as u128)
                .checked_mul(prediction.stake_amount as u128)
                .ok_or(CypherCastError::Overflow)?
                .checked_div(winner_total as u128)
                .ok_or(CypherCastError::Overflow)? as u64
        };

        // Transfer tokens from vault to winner using PDA signer
        let stream_key = stream.key();
        let vault_bump = ctx.accounts.vault.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", stream_key.as_ref(), &[vault_bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.viewer_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, reward_amount)?;

        // Update vault tracking
        ctx.accounts.vault.total_released = ctx
            .accounts
            .vault
            .total_released
            .checked_add(reward_amount)
            .ok_or(CypherCastError::Overflow)?;

        prediction.reward_claimed = true;

        msg!(
            "Reward of {} tokens claimed by {}",
            reward_amount,
            prediction.viewer
        );

        emit!(RewardClaimed {
            stream: stream.key(),
            viewer: prediction.viewer,
            amount: reward_amount
        });

        Ok(())
    }

    pub fn activate_stream(ctx: Context<ActivateStream>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;

        // Only creator can activate; cannot activate twice; cannot activate if canceled/resolved
        require!(
            stream.creator == *ctx.accounts.creator.key,
            CypherCastError::Unauthorized
        );
        require!(stream.canceled_at == 0, CypherCastError::Canceled);
        require!(!stream.is_resolved, CypherCastError::AlreadyResolved);
        require!(
            stream.config_hash == [0u8; 32],
            CypherCastError::AlreadyActivated
        );

        // Compute config hash to freeze settings
        let h = anchor_lang::solana_program::hash::hashv(&[
            stream.title.as_bytes(),
            &stream.tip_bps.to_le_bytes(),
            &[stream.precision],
            &stream.lock_offset_secs.to_le_bytes(),
            &stream.grace_period_secs.to_le_bytes(),
        ]);
        stream.config_hash = h.to_bytes();

        msg!("Stream {} activated (config frozen)", stream.stream_id);
        Ok(())
    }

    pub fn cancel_stream(ctx: Context<CancelStream>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;

        // Only creator; cannot cancel twice; cannot cancel after resolve
        require!(
            stream.creator == *ctx.accounts.creator.key,
            CypherCastError::Unauthorized
        );
        require!(stream.canceled_at == 0, CypherCastError::AlreadyCanceled);
        require!(!stream.is_resolved, CypherCastError::AlreadyResolved);

        stream.is_active = false;
        stream.canceled_at = Clock::get()?.unix_timestamp;

        msg!(
            "Stream {} canceled at {}",
            stream.stream_id,
            stream.canceled_at
        );
        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let stream = &ctx.accounts.stream;

        // Refunds only allowed if stream canceled
        require!(stream.canceled_at != 0, CypherCastError::Canceled);
        // Ensure not already claimed reward/refund
        require!(
            !prediction.reward_claimed,
            CypherCastError::RewardAlreadyClaimed
        );
        require!(!prediction.refunded, CypherCastError::RefundAlreadyClaimed);

        let amount = prediction.stake_amount;

        // Transfer tokens from vault back to viewer using PDA signer
        let stream_key = stream.key();
        let vault_bump = ctx.accounts.vault.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", stream_key.as_ref(), &[vault_bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.viewer_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        // Update vault tracking and prediction
        ctx.accounts.vault.total_released = ctx
            .accounts
            .vault
            .total_released
            .checked_add(amount)
            .ok_or(CypherCastError::Overflow)?;
        prediction.refunded = true;

        msg!(
            "Refund of {} tokens returned to {}",
            amount,
            prediction.viewer
        );
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct CreateStream<'info> {
    #[account(
        init,
        payer = creator,
        space = Stream::SPACE,
        seeds = [b"stream", creator.key().as_ref(), stream_id.to_le_bytes().as_ref()],
        bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeCommunityVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Minimal DAO authority for now (can be creator)
    pub dao_authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"community_vault"],
        bump,
        payer = creator,
        space = CommunityVault::SPACE
    )]
    pub community_vault: Account<'info, CommunityVault>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = community_vault
    )]
    pub community_vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeTokenVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stream", creator.key().as_ref(), stream.stream_id.to_le_bytes().as_ref()],
        bump = stream.bump,
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        init,
        seeds = [b"vault", stream.key().as_ref()],
        bump,
        payer = creator,
        space = TokenVault::SPACE,
    )]
    pub vault: Account<'info, TokenVault>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinStream<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    #[account(
        init,
        payer = viewer,
        space = Participant::SPACE,
        seeds = [b"participant", stream.key().as_ref(), viewer.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,

    #[account(mut)]
    pub viewer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitPrediction<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    #[account(
        init,
        payer = viewer,
        space = Prediction::SPACE,
        seeds = [b"prediction", stream.key().as_ref(), viewer.key().as_ref()],
        bump
    )]
    pub prediction: Account<'info, Prediction>,

    #[account(
        mut,
        seeds = [b"vault", stream.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, TokenVault>,

    #[account(
        mut,
        constraint = viewer_token_account.owner == viewer.key(),
        constraint = viewer_token_account.mint == vault.mint
    )]
    pub viewer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.token_account,
        constraint = vault_token_account.mint == vault.mint
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub viewer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", stream.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, TokenVault>,

    #[account(
        mut,
        constraint = creator_token_account.owner == creator.key(),
        constraint = creator_token_account.mint == vault.mint
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.token_account,
        constraint = vault_token_account.mint == vault.mint
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ActivateStream<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelStream<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        mut,
        has_one = viewer,
        constraint = prediction.stream == stream.key()
    )]
    pub prediction: Account<'info, Prediction>,

    #[account(mut)]
    pub stream: Account<'info, Stream>,

    #[account(
        mut,
        seeds = [b"vault", stream.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, TokenVault>,

    #[account(
        mut,
        constraint = viewer_token_account.owner == viewer.key(),
        constraint = viewer_token_account.mint == vault.mint
    )]
    pub viewer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.token_account,
        constraint = vault_token_account.mint == vault.mint
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub viewer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EndStream<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    /// Prediction account being claimed. Enforce that the prediction belongs to
    /// the supplied stream and viewer via Anchor constraints.
    #[account(
        mut,
        // ensure the prediction's viewer matches the signer
        has_one = viewer,
        // ensure the prediction's stream matches the provided stream account
        constraint = prediction.stream == stream.key()
    )]
    pub prediction: Account<'info, Prediction>,

    /// The stream that has been resolved. Must match `prediction.stream`.
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    #[account(
        mut,
        seeds = [b"vault", stream.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, TokenVault>,

    #[account(
        mut,
        constraint = viewer_token_account.owner == viewer.key(),
        constraint = viewer_token_account.mint == vault.mint
    )]
    pub viewer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.token_account,
        constraint = vault_token_account.mint == vault.mint
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// The viewer (caller) claiming the reward. Must match `prediction.viewer`.
    pub viewer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Stream {
    pub creator: Pubkey,
    pub stream_id: u64,
    pub title: String,
    pub start_time: i64,
    pub end_time: i64,
    // Phase 2.5 config fields
    pub lock_offset_secs: i64,
    pub grace_period_secs: i64,
    pub tip_bps: u16,  // 0..=10_000
    pub precision: u8, // <= 9
    pub config_hash: [u8; 32],
    // Aggregates
    pub total_stake: u64,
    pub total_by_choice: [u64; 11],
    // Legacy flags (kept for compatibility while introducing state machine)
    pub is_active: bool,
    pub is_resolved: bool,
    pub winning_choice: u8,
    // Phase 2.5 runtime fields
    pub tip_amount: u64,
    pub resolved_at: i64,
    pub canceled_at: i64,
    pub bump: u8,
}

impl Stream {
    pub const SPACE: usize = DISCRIMINATOR +
        32 + // creator
        8 + // stream_id
        4 + 200 + // title (max 200 chars)
        8 + // start_time
        8 + // end_time
        8 + // lock_offset_secs
        8 + // grace_period_secs
        2 + // tip_bps
        1 + // precision
        32 + // config_hash
        8 + // total_stake
        (8 * 11) + // total_by_choice array (11 choices: 0..=10)
        1 + // is_active
        1 + // is_resolved
        1 + // winning_choice (u8)
        8 + // tip_amount
        8 + // resolved_at
        8 + // canceled_at
        1; // bump
}

#[account]
pub struct Participant {
    pub stream: Pubkey,
    pub viewer: Pubkey,
    pub stake_amount: u64,
    pub joined_at: i64,
    pub bump: u8,
}

impl Participant {
    pub const SPACE: usize = DISCRIMINATOR +
        32 + // stream
        32 + // viewer
        8 + // stake_amount
        8 + // joined_at
        1; // bump
}

#[account]
pub struct Prediction {
    pub stream: Pubkey,
    pub viewer: Pubkey,
    pub choice: u8,
    pub stake_amount: u64,
    pub timestamp: i64,
    pub reward_claimed: bool,
    pub refunded: bool,
    pub bump: u8,
}

impl Prediction {
    pub const SPACE: usize = DISCRIMINATOR +
        32 + // stream
        32 + // viewer
        1 + // choice
        8 + // stake_amount
        8 + // timestamp
        1 + // reward_claimed
        1 + // refunded
        1; // bump
}

#[account]
pub struct TokenVault {
    pub stream: Pubkey,
    pub token_account: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
    pub total_deposited: u64,
    pub total_released: u64,
}

#[account]
pub struct CommunityVault {
    pub authority: Pubkey,
    pub token_account: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
    pub total_contributions: u64,
}

impl CommunityVault {
    pub const SPACE: usize = DISCRIMINATOR +
        32 + // authority
        32 + // token_account
        32 + // mint
        1 +  // bump
        8; // total_contributions
}

impl TokenVault {
    pub const SPACE: usize = DISCRIMINATOR +
        32 + // stream
        32 + // token_account
        32 + // mint
        1 + // bump
        8 + // total_deposited
        8; // total_released
}

#[event]
pub struct PredictionSubmitted {
    pub stream: Pubkey,
    pub viewer: Pubkey,
    pub choice: u8,
    pub amount: u64,
}

#[event]
pub struct StreamResolved {
    pub stream: Pubkey,
    pub winning_choice: u8,
    pub tip_amount: u64,
}

#[event]
pub struct RewardClaimed {
    pub stream: Pubkey,
    pub viewer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CommunityVaultInitialized {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub token_account: Pubkey,
}

#[error_code]
pub enum CypherCastError {
    #[msg("Stream is not active")]
    StreamNotActive,
    #[msg("Stream is still active")]
    StreamStillActive,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    #[msg("Invalid choice")]
    InvalidChoice,
    #[msg("Title too long")]
    TitleTooLong,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,
    #[msg("Stream not resolved")]
    NotResolved,
    #[msg("Incorrect prediction")]
    NotWinner,
    #[msg("Stream already resolved")]
    AlreadyResolved,
    #[msg("Math overflow")]
    Overflow,
    #[msg("No winner stake to distribute")]
    NoWinner,
    #[msg("Invalid configuration")]
    InvalidConfig,
    #[msg("Stream is locked")]
    StreamLocked,
    #[msg("Stream has been canceled")]
    Canceled,
    #[msg("Stream already canceled")]
    AlreadyCanceled,
    #[msg("Refund already claimed")]
    RefundAlreadyClaimed,
    #[msg("Stream already activated")]
    AlreadyActivated,
}
