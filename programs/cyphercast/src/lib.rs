use anchor_lang::prelude::*;

declare_id!("5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF");

#[program]
pub mod cyphercast {
    use super::*;

    /// Maximum number of prediction choices supported by the program.
    pub const MAX_CHOICES: u8 = 10;

    pub fn create_stream(
        ctx: Context<CreateStream>,
        stream_id: u64,
        title: String,
        start_time: i64,
    ) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        stream.creator = *ctx.accounts.creator.key;
        stream.stream_id = stream_id;
        stream.title = title.clone();
        stream.start_time = start_time;
        stream.end_time = 0;
        stream.total_stake = 0;
        stream.is_active = true;
        stream.is_resolved = false;
        stream.winning_choice = 0;
        stream.bump = ctx.bumps.stream;

        msg!("Stream created: {} by {}", title, stream.creator);
        Ok(())
    }

    pub fn join_stream(ctx: Context<JoinStream>, stake_amount: u64) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        let participant = &mut ctx.accounts.participant;

        require!(stream.is_active, CypherCastError::StreamNotActive);
        require!(stake_amount > 0, CypherCastError::InvalidStakeAmount);

        stream.total_stake = stream.total_stake.checked_add(stake_amount).unwrap();

        participant.stream = stream.key();
        participant.viewer = *ctx.accounts.viewer.key;
        participant.stake_amount = stake_amount;
        participant.joined_at = Clock::get()?.unix_timestamp;
        participant.bump = ctx.bumps.participant;

        msg!(
            "User {} joined stream {} with stake {}",
            participant.viewer,
            stream.stream_id,
            stake_amount
        );
        Ok(())
    }

    pub fn submit_prediction(
        ctx: Context<SubmitPrediction>,
        choice: u8,
        stake_amount: u64,
    ) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let stream = &ctx.accounts.stream;

        require!(stream.is_active, CypherCastError::StreamNotActive);
        require!(stake_amount > 0, CypherCastError::InvalidStakeAmount);
        require!(choice <= MAX_CHOICES, CypherCastError::InvalidChoice);

        prediction.stream = stream.key();
        prediction.viewer = *ctx.accounts.viewer.key;
        prediction.choice = choice;
        prediction.stake_amount = stake_amount;
        prediction.timestamp = Clock::get()?.unix_timestamp;
        prediction.reward_claimed = false;
        prediction.bump = ctx.bumps.prediction;

        msg!(
            "Prediction submitted: choice {} with stake {} by {}",
            choice,
            stake_amount,
            prediction.viewer
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
        require!(
            !stream.is_active,
            CypherCastError::StreamStillActive
        );
        // The stream cannot be resolved more than once.
        require!(
            !stream.is_resolved,
            CypherCastError::AlreadyResolved
        );
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

        stream.is_resolved = true;
        stream.winning_choice = winning_choice;

        msg!(
            "Stream {} resolved with winning choice {}",
            stream.stream_id,
            winning_choice
        );
        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let stream = &ctx.accounts.stream;

        // Ensure the stream has been resolved.
        require!(stream.is_resolved, CypherCastError::NotResolved);
        // Only predictions that match the winning choice can claim rewards.
        require!(
            prediction.choice == stream.winning_choice,
            CypherCastError::NotWinner
        );
        // Prevent double-claiming of rewards.
        require!(
            !prediction.reward_claimed,
            CypherCastError::RewardAlreadyClaimed
        );

        prediction.reward_claimed = true;

        msg!("Reward claimed for prediction by {}", prediction.viewer);
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
    pub stream: Account<'info, Stream>,

    #[account(
        init,
        payer = viewer,
        space = Prediction::SPACE,
        seeds = [b"prediction", stream.key().as_ref(), viewer.key().as_ref()],
        bump
    )]
    pub prediction: Account<'info, Prediction>,

    #[account(mut)]
    pub viewer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndStream<'info> {
    #[account(mut)]
    pub stream: Account<'info, Stream>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
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

    /// The viewer (caller) claiming the reward. Must match `prediction.viewer`.
    pub viewer: Signer<'info>,
}

#[account]
pub struct Stream {
    pub creator: Pubkey,
    pub stream_id: u64,
    pub title: String,
    pub start_time: i64,
    pub end_time: i64,
    pub total_stake: u64,
    pub is_active: bool,
    pub is_resolved: bool,
    pub winning_choice: u8,
    pub bump: u8,
}

impl Stream {
    pub const SPACE: usize = 8 + // discriminator
        32 + // creator
        8 + // stream_id
        4 + 200 + // title (max 200 chars)
        8 + // start_time
        8 + // end_time
        8 + // total_stake
        1 + // is_active
        1 + // is_resolved
        1 + // winning_choice (u8)
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
    pub const SPACE: usize = 8 + // discriminator
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
    pub bump: u8,
}

impl Prediction {
    pub const SPACE: usize = 8 + // discriminator
        32 + // stream
        32 + // viewer
        1 + // choice
        8 + // stake_amount
        8 + // timestamp
        1 + // reward_claimed
        1; // bump
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
}
