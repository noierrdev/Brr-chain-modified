import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import assert from "assert";
import { Farming } from "../../target/types/farming";
import {
  getPoolPda,
  getRewardAVaultPda,
  // getRewardBVaultPda,
  getStakingVaultPda,
  getUserPda,
  REWARD_DURATION,
} from "./utils";
import { describe } from "mocha";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.Farming as Program<Farming>;

const BASE_KEYPAIR = anchor.web3.Keypair.generate();
const ADMIN_KEYPAIR = anchor.web3.Keypair.generate();
const USER_KEYPAIR = anchor.web3.Keypair.generate();
const OTHER_USER_KEYPAIR = anchor.web3.Keypair.generate();
const FUNDER_KEYPAIR = anchor.web3.Keypair.generate();
const TOKEN_DECIMAL = 6;
const TOKEN_MULTIPLIER = 10 ** TOKEN_DECIMAL;

function sleep(ms: number) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}
describe("dual-farming with single reward", () => {
  let stakingMint: anchor.web3.PublicKey = null;
  let rewardMint: anchor.web3.PublicKey = null;

  let stakingToken: Token = null;
  let rewardToken: Token = null;

  let userStakingATA: anchor.web3.PublicKey = null;
  let userRewardATA: anchor.web3.PublicKey = null;

  let otheruserStakingATA: anchor.web3.PublicKey = null;
  let otheruserRewardATA: anchor.web3.PublicKey = null;

  let adminStakingATA: anchor.web3.PublicKey = null;
  let adminRewardATA: anchor.web3.PublicKey = null;

  before(async () => {
    let sig = await program.provider.connection.requestAirdrop(
      ADMIN_KEYPAIR.publicKey,
      100 * LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(sig);

    sleep(1000)

    sig = await program.provider.connection.requestAirdrop(
      USER_KEYPAIR.publicKey,
      100 * LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(sig);

    sleep(1000)

    sig = await program.provider.connection.requestAirdrop(
      OTHER_USER_KEYPAIR.publicKey,
      100 * LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(sig);

    // sleep(1000)

    // sig = await program.provider.connection.requestAirdrop(
    //   USER_KEYPAIR.publicKey,
    //   100 * LAMPORTS_PER_SOL
    // );
    // await program.provider.connection.confirmTransaction(sig);

    stakingToken = await Token.createMint(
      program.provider.connection,
      ADMIN_KEYPAIR,
      ADMIN_KEYPAIR.publicKey,
      null,
      TOKEN_DECIMAL,
      TOKEN_PROGRAM_ID
    );
    stakingMint = stakingToken.publicKey;
    userStakingATA = await stakingToken.createAssociatedTokenAccount(
      USER_KEYPAIR.publicKey
    );
    otheruserStakingATA = await stakingToken.createAssociatedTokenAccount(
      OTHER_USER_KEYPAIR.publicKey
    );
    adminStakingATA = await stakingToken.createAssociatedTokenAccount(
      ADMIN_KEYPAIR.publicKey
    );

    rewardToken = await Token.createMint(
      program.provider.connection,
      ADMIN_KEYPAIR,
      ADMIN_KEYPAIR.publicKey,
      null,
      TOKEN_DECIMAL,
      TOKEN_PROGRAM_ID
    );
    rewardMint = rewardToken.publicKey;
    userRewardATA = await rewardToken.createAssociatedTokenAccount(
      USER_KEYPAIR.publicKey
    );
    otheruserRewardATA = await rewardToken.createAssociatedTokenAccount(
      OTHER_USER_KEYPAIR.publicKey
    );
    adminRewardATA = await rewardToken.createAssociatedTokenAccount(
      ADMIN_KEYPAIR.publicKey
    );

    console.log("Program ID: ", program.programId.toString());
    console.log("Wallet: ", provider.wallet.publicKey.toString());
  });

  // Use same reward mint for `rewardAMint` and `rewardBMint` in accounts param

  it("should initialize dual-farming with single reward pool", async () => {
    const [farmingPoolAddress, _farmingPoolBump] = await getPoolPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );
    const [stakingVaultAddress, _stakingVaultBump] = await getStakingVaultPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );
    const [rewardAVaultAddress, _rewardAVaultBump] = await getRewardAVaultPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );
    // const [rewardBVaultAddress, _rewardBVaultBump] = await getRewardBVaultPda(
    //   program,
    //   stakingMint,
    //   rewardMint,
    //   rewardMint,
    //   BASE_KEYPAIR.publicKey
    // );
    await program.methods
      .initializePool(REWARD_DURATION)
      .accounts({
        authority: ADMIN_KEYPAIR.publicKey,
        base: BASE_KEYPAIR.publicKey,
        pool: farmingPoolAddress,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        rewardAMint: rewardMint,
        // rewardBMint: rewardMint,
        rewardAVault: rewardAVaultAddress,
        // rewardBVault: rewardBVaultAddress,
        stakingMint,
        stakingVault: stakingVaultAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([BASE_KEYPAIR, ADMIN_KEYPAIR])
      .rpc();
  });

  it("should create new user", async () => {
    const [farmingPoolAddress, _farmingPoolBump] = await getPoolPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );
    const [userStakingAddress, _userStakingAddressBump] = await getUserPda(
      program,
      farmingPoolAddress,
      USER_KEYPAIR.publicKey
    );

    await program.methods
      .createUser()
      .accounts({
        owner: USER_KEYPAIR.publicKey,
        pool: farmingPoolAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
        user: userStakingAddress,
      })
      .signers([USER_KEYPAIR])
      .rpc();
  });

  it("should create another user", async () => {
    const [farmingPoolAddress, _farmingPoolBump] = await getPoolPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );
    const [userStakingAddress, _userStakingAddressBump] = await getUserPda(
      program,
      farmingPoolAddress,
      OTHER_USER_KEYPAIR.publicKey
    );

    await program.methods
      .createUser()
      .accounts({
        owner: OTHER_USER_KEYPAIR.publicKey,
        pool: farmingPoolAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
        user: userStakingAddress,
      })
      .signers([OTHER_USER_KEYPAIR])
      .rpc();
  });

  it("should stake to the pool", async () => {
    const DEPOSIT_AMOUNT = new anchor.BN(500 * TOKEN_MULTIPLIER);

    await stakingToken.mintTo(
      userStakingATA,
      ADMIN_KEYPAIR,
      [],
      1000 * TOKEN_MULTIPLIER
    );

    const [farmingPoolAddress, _farmingPoolBump] = await getPoolPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );

    const [userStakingAddress, _userStakingAddressBump] = await getUserPda(
      program,
      farmingPoolAddress,
      USER_KEYPAIR.publicKey
    );
    
    const poolAccount = await program.account.pool.fetch(farmingPoolAddress);
    await program.methods
      .deposit(DEPOSIT_AMOUNT)
      .accounts({
        owner: USER_KEYPAIR.publicKey,
        pool: farmingPoolAddress,
        stakeFromAccount: userStakingATA,
        stakingVault: poolAccount.stakingVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: userStakingAddress,
      })
      .signers([USER_KEYPAIR])
      .rpc();
  });

  it("should fund the pool reward A only", async () => {
    const FUND_AMOUNT = new anchor.BN(20_000 * TOKEN_MULTIPLIER);

    const [farmingPoolAddress, _farmingPoolBump] = await getPoolPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );

    const poolAccount = await program.account.pool.fetch(farmingPoolAddress);

    await rewardToken.mintTo(
      adminRewardATA,
      ADMIN_KEYPAIR,
      [],
      100_000 * TOKEN_MULTIPLIER
    );

    await program.methods
      .fund(FUND_AMOUNT)
      .accounts({
        fromA: adminRewardATA,
        funder: ADMIN_KEYPAIR.publicKey,
        pool: farmingPoolAddress,
        rewardAVault: poolAccount.rewardAVault,
        // rewardBVault: poolAccount.rewardBVault,
        stakingVault: poolAccount.stakingVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ADMIN_KEYPAIR])
      .rpc();

    let poolRewardABalance = await provider.connection.getTokenAccountBalance(
      poolAccount.rewardAVault
    );
    assert.strictEqual(poolRewardABalance.value.amount, FUND_AMOUNT.toString());
  });

  it("Other user should stake to the pool", async () => {
    const DEPOSIT_AMOUNT = new anchor.BN(500 * TOKEN_MULTIPLIER);

    await stakingToken.mintTo(
      otheruserStakingATA,
      ADMIN_KEYPAIR,
      [],
      1000 * TOKEN_MULTIPLIER
    );

    const [farmingPoolAddress, _farmingPoolBump] = await getPoolPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );

    const [userStakingAddress, _userStakingAddressBump] = await getUserPda(
      program,
      farmingPoolAddress,
      OTHER_USER_KEYPAIR.publicKey
    );
    
    const poolAccount = await program.account.pool.fetch(farmingPoolAddress);
    await program.methods
      .deposit(DEPOSIT_AMOUNT)
      .accounts({
        owner: OTHER_USER_KEYPAIR.publicKey,
        pool: farmingPoolAddress,
        stakeFromAccount: otheruserStakingATA,
        stakingVault: poolAccount.stakingVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: userStakingAddress,
      })
      .signers([OTHER_USER_KEYPAIR])
      .rpc();
  });

  it("should claim reward from the pool", async () => {
    await sleep(1000);
    const [farmingPoolAddress, _farmingPoolBump] = await getPoolPda(
      program,
      stakingMint,
      rewardMint,
      BASE_KEYPAIR.publicKey
    );

    const [userStakingAddress, _userStakingAddressBump] = await getUserPda(
      program,
      farmingPoolAddress,
      USER_KEYPAIR.publicKey
    );

    const beforeBalance = await provider.connection.getTokenAccountBalance(
      userRewardATA
    );

    

    const poolAccount = await program.account.pool.fetch(farmingPoolAddress);
    await program.methods
      .claim()
      .accounts({
        owner: USER_KEYPAIR.publicKey,
        pool: farmingPoolAddress,
        rewardAAccount: userRewardATA,
        // rewardBAccount: userRewardATA,
        rewardAVault: poolAccount.rewardAVault,
        // rewardBVault: poolAccount.rewardBVault,
        stakingVault: poolAccount.stakingVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: userStakingAddress,
      })
      .signers([USER_KEYPAIR])
      .rpc();
    const afterBalance = await provider.connection.getTokenAccountBalance(
      userRewardATA
    );

    const isRewardClaimed = new anchor.BN(afterBalance.value.amount).gt(
      new anchor.BN(beforeBalance.value.amount)
    );

    assert.deepStrictEqual(isRewardClaimed, true);
  });
});
