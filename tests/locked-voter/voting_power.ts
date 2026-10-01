import * as anchor from "@coral-xyz/anchor";
import { BN, Wallet, web3 } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, createMint, mintTo } from "@solana/spl-token";
import { expect } from "chai";
import {
  GOVERN_PROGRAM_ID,
  LOCKED_VOTER_PROGRAM_ID,
  SMART_WALLET_PROGRAM_ID,
  createAndFundWallet,
  createGovernProgram,
  createGovernor,
  createLockedVoterProgram,
  createLocker,
  createSmartWallet,
  createSmartWalletProgram,
  deriveEscrow,
  deriveGovern,
  deriveLocker,
  deriveSmartWallet,
  getOnChainTime,
  getOrCreateATA,
  sleep,
} from "../utils";

const provider = anchor.AnchorProvider.env();
const amount = new BN(1_000_000);
const maxStakeDuration = new BN(100);
const minStakeDuration = new BN(10);

describe("Voting power", () => {
  let mint: web3.PublicKey;
  let locker: web3.PublicKey;
  let otherLocker: web3.PublicKey;
  let escrow: web3.PublicKey;
  let user: web3.Keypair;
  let program: ReturnType<typeof createLockedVoterProgram>;

  async function newLocker(): Promise<web3.PublicKey> {
    const { keypair, wallet } = await createAndFundWallet(provider.connection);
    const [governor] = deriveGovern(keypair.publicKey);
    const [smartWallet] = deriveSmartWallet(keypair.publicKey);
    await createSmartWallet(
      [governor, wallet.publicKey],
      2,
      new BN(0),
      new BN(1),
      keypair,
      createSmartWalletProgram(wallet, SMART_WALLET_PROGRAM_ID)
    );
    await createGovernor(
      new BN(0),
      new BN(10),
      new BN(2),
      new BN(0),
      keypair,
      smartWallet,
      createGovernProgram(wallet, GOVERN_PROGRAM_ID),
      LOCKED_VOTER_PROGRAM_ID
    );
    await createLocker(
      maxStakeDuration,
      1,
      minStakeDuration,
      new BN(2),
      keypair,
      mint,
      governor,
      createLockedVoterProgram(wallet, LOCKED_VOTER_PROGRAM_ID)
    );
    return deriveLocker(keypair.publicKey, LOCKED_VOTER_PROGRAM_ID)[0];
  }

  const power = (lockerKey = locker): Promise<BN> =>
    program.methods.votingPower().accounts({ locker: lockerKey, escrow }).view();

  const expected = (end: BN, now: number): BN =>
    end.lte(new BN(now))
      ? new BN(0)
      : amount.mul(BN.min(end.sub(new BN(now)), maxStakeDuration)).div(maxStakeDuration);

  before(async () => {
    const admin = await createAndFundWallet(provider.connection);
    mint = await createMint(provider.connection, admin.keypair, admin.keypair.publicKey, null, 6);
    locker = await newLocker();
    otherLocker = await newLocker();

    const created = await createAndFundWallet(provider.connection);
    user = created.keypair;
    program = createLockedVoterProgram(created.wallet, LOCKED_VOTER_PROGRAM_ID);
    escrow = deriveEscrow(locker, user.publicKey, LOCKED_VOTER_PROGRAM_ID)[0];

    const userTokens = await getOrCreateATA(mint, user.publicKey, user, provider.connection);
    await mintTo(provider.connection, admin.keypair, mint, userTokens, admin.keypair.publicKey, amount.toNumber());
    await program.methods
      .newEscrow()
      .accounts({
        locker,
        escrow,
        escrowOwner: user.publicKey,
        payer: user.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("is zero for an empty escrow", async () => {
    expect((await power()).toString()).to.equal("0");
  });

  it("matches the formula for a timed lock", async () => {
    const escrowTokens = await getOrCreateATA(mint, escrow, user, provider.connection);
    const sourceTokens = await getOrCreateATA(mint, user.publicKey, user, provider.connection);
    await program.methods
      .extendLockDuration(minStakeDuration.addn(5))
      .accounts({ locker, escrow, escrowOwner: user.publicKey })
      .rpc();
    await program.methods
      .increaseLockedAmount(amount)
      .accounts({
        locker,
        escrow,
        escrowTokens,
        payer: user.publicKey,
        sourceTokens,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const { escrowEndsAt } = await program.account.escrow.fetch(escrow);
    const before = await getOnChainTime(provider.connection);
    const result = await power();
    const after = await getOnChainTime(provider.connection);

    expect(result.gtn(0)).to.be.true;
    expect(result.lte(expected(escrowEndsAt, before))).to.be.true;
    expect(result.gte(expected(escrowEndsAt, after))).to.be.true;
  });

  it("is rejected for a locker that does not own the escrow", async () => {
    let error = null;
    try {
      await power(otherLocker);
    } catch (err) {
      error = err;
    }
    expect(error).not.null;
  });

  it("is zero once the lock has expired", async () => {
    const { escrowEndsAt } = await program.account.escrow.fetch(escrow);
    while ((await getOnChainTime(provider.connection)) < escrowEndsAt.toNumber()) {
      await sleep(1000);
    }
    expect((await power()).toString()).to.equal("0");
  });

  it("is the full amount while max lock is on", async () => {
    await program.methods
      .toggleMaxLock(true)
      .accounts({ locker, escrow, escrowOwner: user.publicKey })
      .rpc();
    expect((await power()).toString()).to.equal(amount.toString());
  });
});
