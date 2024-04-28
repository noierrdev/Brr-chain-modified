use anchor_client::{
    solana_sdk::{pubkey::Pubkey, signer::Signer},
    Program,
};
use anyhow::Result;
use spl_associated_token_account::{create_associated_token_account, get_associated_token_address};
use std::ops::Deref;

pub struct UserPDA {
    pub user: (Pubkey, u8),
}

pub fn get_user_pda(pool: &Pubkey, owner: &Pubkey, program_id: &Pubkey) -> UserPDA {
    let seeds = [owner.as_ref(), pool.as_ref()];
    let (user_pubkey, user_bump) = Pubkey::find_program_address(&seeds, &program_id);
    UserPDA {
        user: (user_pubkey, user_bump),
    }
}

pub fn get_or_create_ata<C: Deref<Target = impl Signer> + Clone>(
    program: &Program<C>,
    wallet_address: &Pubkey,
    token_mint: &Pubkey,
) -> Result<Pubkey> {
    let ata_account = get_associated_token_address(&program.payer(), token_mint);
    let ata_account_info = program.rpc().get_account(&ata_account);
    if ata_account_info.is_err() {
        println!("Create ATA {:?} for Mint {:?}", ata_account, token_mint);
        let builder = program
            .request()
            .instruction(create_associated_token_account(
                &program.payer(),
                &wallet_address,
                &token_mint,
            ));
        let tx_signature = builder.send()?;
        println!("Signature {:?}", tx_signature);
    }
    Ok(ata_account)
}

pub struct PoolPDA {
    pub pubkey: Pubkey,
    pub bump: u8,
}

pub fn get_pool_pda<C: Deref<Target = impl Signer> + Clone>(
    program: &Program<C>,
    reward_duration: u64,
    staking_mint: &Pubkey,
    reward_a_mint: &Pubkey,
    // reward_b_mint: &Pubkey,
    base: &Pubkey,
) -> Result<PoolPDA> {
    let reward_duration = reward_duration.to_be_bytes();
    let seeds = [
        reward_duration.as_ref(),
        staking_mint.as_ref(),
        reward_a_mint.as_ref(),
        // reward_b_mint.as_ref(),
        base.as_ref(),
    ];
    let (pool_pubkey, pool_bump) = Pubkey::find_program_address(&seeds, &program.id());
    Ok(PoolPDA {
        pubkey: pool_pubkey,
        bump: pool_bump,
    })
}

pub fn get_pool<C: Deref<Target = impl Signer> + Clone>(
    program: &Program<C>,
    pool_pubkey: Pubkey,
) -> Result<farming::pool::Pool> {
    Ok(program.account(pool_pubkey)?)
}

pub fn get_user<C: Deref<Target = impl Signer> + Clone>(
    program: &Program<C>,
    user_pubkey: Pubkey,
) -> Result<farming::pool::User> {
    Ok(program.account(user_pubkey)?)
}

pub struct VaultPDAs {
    pub staking_vault: (Pubkey, u8),
    pub reward_a_vault: (Pubkey, u8),
    // pub reward_b_vault: (Pubkey, u8),
}

pub fn get_vault_pdas(program_id: &Pubkey, pool_pubkey: &Pubkey) -> VaultPDAs {
    let seeds = [b"staking", pool_pubkey.as_ref()];
    let (staking_vault_pubkey, staking_vault_bump) =
        Pubkey::find_program_address(&seeds, &program_id);
    let seeds = [b"reward_a", pool_pubkey.as_ref()];
    let (reward_a_vault_pubkey, reward_a_vault_bump) =
        Pubkey::find_program_address(&seeds, &program_id);
    let seeds = [b"reward_b", pool_pubkey.as_ref()];
    // let (reward_b_vault_pubkey, reward_b_vault_bump) =
    //     Pubkey::find_program_address(&seeds, &program_id);
    VaultPDAs {
        staking_vault: (staking_vault_pubkey, staking_vault_bump),
        reward_a_vault: (reward_a_vault_pubkey, reward_a_vault_bump),
        // reward_b_vault: (reward_b_vault_pubkey, reward_b_vault_bump),
    }
}
