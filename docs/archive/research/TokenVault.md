โครงสร้างที่แนะนำ: PDA เป็น “vault authority” คุม ATA ของตนเอง, สถานะเก็บใน VaultState, โอนเข้า-ออกผ่าน SPL Token ด้วย signer seeds, ตรวจ mint, owner, และสถานะเสมอ

```rust
// Anchor.toml: ใช้ spl-token 2022 ถ้าต้องการ features เพิ่มเติมได้ แต่ตัวอย่างใช้มาตรฐาน
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("VaulT111111111111111111111111111111111111111");

#[program]
pub mod token_vault {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, bump_auth: u8, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 1_000, VaultError::FeeTooHigh); // <=10%
        let st = &mut ctx.accounts.vault_state;
        st.authority = ctx.accounts.admin.key();
        st.mint = ctx.accounts.mint.key();
        st.vault_auth_bump = bump_auth;
        st.fee_bps = fee_bps;
        st.total_deposited = 0;
        st.total_released = 0;
        st.frozen = false;
        emit!(VaultInitialized { mint: st.mint, admin: st.authority });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let st = &ctx.accounts.vault_state;
        require!(!st.frozen, VaultError::Frozen);
        // โยกจาก ATA ผู้ใช้ -> ATA ของ vault_auth
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_ata.to_account_info(),
                to: ctx.accounts.vault_ata.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        );
        token::transfer(cpi, amount)?;
        // บันทึก
        let st_mut = &mut ctx.accounts.vault_state;
        st_mut.total_deposited = st_mut.total_deposited.checked_add(amount).ok_or(VaultError::Overflow)?;
        emit!(Deposited { user: ctx.accounts.depositor.key(), amount });
        Ok(())
    }

    pub fn release_to(ctx: Context<ReleaseTo>, amount: u64, memo: [u8; 32]) -> Result<()> {
        let st = &ctx.accounts.vault_state;
        require!(!st.frozen, VaultError::Frozen);
        // คำนวณค่าธรรมเนียม
        let fee = amount.saturating_mul(st.fee_bps as u64) / 10_000;
        let to_user = amount.saturating_sub(fee);

        // seeds สำหรับเซ็นจาก vault_auth PDA
        let seeds: &[&[u8]] = &[
            b"vault_auth",
            st.mint.as_ref(),
            ctx.accounts.vault_state.key().as_ref(),
            &[st.vault_auth_bump],
        ];
        let signer = &[seeds];

        // โอนให้ผู้รับ
        let cpi1 = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_ata.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: ctx.accounts.vault_auth.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi1, to_user)?;

        // โอนค่าธรรมเนียมไปยัง fee_ata (ถ้า > 0)
        if fee > 0 {
            let cpi2 = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_ata.to_account_info(),
                    to: ctx.accounts.fee_ata.to_account_info(),
                    authority: ctx.accounts.vault_auth.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi2, fee)?;
        }

        let st_mut = &mut ctx.accounts.vault_state;
        st_mut.total_released = st_mut.total_released.checked_add(amount).ok_or(VaultError::Overflow)?;
        emit!(Released { to: ctx.accounts.recipient.key(), amount, fee, memo });
        Ok(())
    }

    pub fn freeze(ctx: Context<AdminOnly>, v: bool) -> Result<()> {
        ctx.accounts.vault_state.frozen = v;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub mint: Account<'info, Mint>,

    /// PDA ที่จะเป็นเจ้าของ ATA ของ vault
    /// seeds = ["vault_auth", mint, vault_state]
    /// CHECK: PDA only, no data
    #[account(seeds = [b"vault_auth", mint.key().as_ref(), vault_state.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    /// ATA ของ vault_auth สำหรับ mint นี้
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = vault_auth
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = admin,
        space = 8 + VaultState::SIZE
    )]
    pub vault_state: Account<'info, VaultState>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut, constraint = user_ata.owner == depositor.key(), constraint = user_ata.mint == vault_state.mint)]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(seeds = [b"vault_auth", mint.key().as_ref(), vault_state.key().as_ref()], bump = vault_state.vault_auth_bump)]
    /// CHECK: PDA only
    pub vault_auth: UncheckedAccount<'info>,

    #[account(mut, constraint = vault_ata.owner == vault_auth.key(), constraint = vault_ata.mint == vault_state.mint)]
    pub vault_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(has_one = mint)]
    pub vault_state: Account<'info, VaultState>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReleaseTo<'info> {
    /// ผู้มีสิทธิ์สั่งจ่าย อาจเป็น admin หรือโปรแกรมตัดสินผล (เช่น oracle/authority PDA) ตามนโยบายของคุณ
    pub authority: Signer<'info>,

    #[account(mut, has_one = mint, constraint = vault_state.authority == authority.key())]
    pub vault_state: Account<'info, VaultState>,

    pub mint: Account<'info, Mint>,

    #[account(seeds = [b"vault_auth", mint.key().as_ref(), vault_state.key().as_ref()], bump = vault_state.vault_auth_bump)]
    /// CHECK:
    pub vault_auth: UncheckedAccount<'info>,

    #[account(mut, constraint = vault_ata.owner == vault_auth.key(), constraint = vault_ata.mint == mint.key())]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(mut, constraint = recipient_ata.owner == recipient.key(), constraint = recipient_ata.mint == mint.key())]
    pub recipient_ata: Account<'info, TokenAccount>,
    /// CHECK: recipient wallet
    pub recipient: UncheckedAccount<'info>,

    #[account(mut, constraint = fee_ata.owner == fee_receiver.key(), constraint = fee_ata.mint == mint.key())]
    pub fee_ata: Account<'info, TokenAccount>,
    /// CHECK:
    pub fee_receiver: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,
    #[account(mut, constraint = vault_state.authority == admin.key())]
    pub vault_state: Account<'info, VaultState>,
}

#[account]
pub struct VaultState {
    pub authority: Pubkey,       // ผู้มีสิทธิบริหาร vault (หรือ authority PDA)
    pub mint: Pubkey,            // โทเค็นที่รองรับ
    pub vault_auth_bump: u8,     // bump ของ PDA
    pub fee_bps: u16,            // ค่าธรรมเนียม basis points
    pub frozen: bool,            // emergency switch
    pub total_deposited: u64,
    pub total_released: u64,
}
impl VaultState {
    pub const SIZE: usize = 32 + 32 + 1 + 2 + 1 + 8 + 8;
}

#[error_code]
pub enum VaultError {
    #[msg("Fee too high")]
    FeeTooHigh,
    #[msg("Vault is frozen")]
    Frozen,
    #[msg("Math overflow")]
    Overflow,
}

#[event]
pub struct VaultInitialized {
    pub mint: Pubkey,
    pub admin: Pubkey,
}
#[event]
pub struct Deposited {
    pub user: Pubkey,
    pub amount: u64,
}
#[event]
pub struct Released {
    pub to: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub memo: [u8; 32],
}
```

TypeScript ฝั่ง client ที่ปลอดภัยและสั้น

```ts
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

export function deriveVaultAuth(
  mint: PublicKey,
  vaultState: PublicKey,
  programId: PublicKey
) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_auth"), mint.toBuffer(), vaultState.toBuffer()],
    programId
  );
  return { pda, bump };
}

export function deriveVaultAta(mint: PublicKey, vaultAuth: PublicKey) {
  return getAssociatedTokenAddressSync(mint, vaultAuth, true); // owner เป็น PDA
}
```

แนวทาง “production” ที่ควรยึด:

- ผูกทุกบัญชีกับเงื่อนไข `has_one`, `constraint` ตรวจ `mint`, `owner`, และ PDA seeds ทุกครั้ง
- ใช้ PDA เป็น **authority** ของ ATA แทนการถือ token account โดยโปรแกรมโดยตรง
- มี emergency `freeze` สำหรับปิดจ่ายในเหตุขัดข้อง
- บันทึก event ทุกการเคลื่อนไหวเพื่อ audit
- จำกัดค่าธรรมเนียมด้วย upper bound
- ใช้ `checked_add` ป้องกัน overflow
- ออกแบบ authority ให้ปรับได้: admin → multisig/DAO PDA ในภายหลัง
- แยก vault ต่อ mint หรือ ต่อ use-case (เช่น per-stream) เพื่อจำกัด blast radius
- เขียน test: success paths, invalid mint, wrong ATA owner, insufficient funds, freeze, fee calc, edge cases amount=0

เชื่อมกับ CypherCast:

- ใช้ `vault_state` ต่อ `stream_id` (รวมใน seeds ของ `vault_state` PDA)
- ให้โปรแกรม “oracle/result” เป็น `authority` ของ `release_to` แทนผู้คนเดียว
- จ่ายรางวัลเป็นชุดเดียวกับการสรุปผล live prediction แล้ว emit memo = stream_id หรือ hash ของรอบเกม เพื่ออ้างอิงภายนอกได้

ต้องการเวอร์ชัน “per-stream vault” พร้อมโค้ด seeds ที่รวม `stream_id` และตัวอย่าง test ไหม?
