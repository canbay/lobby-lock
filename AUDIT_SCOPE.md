# Diff audit scope: lobby token lock

**Status: draft. Not yet frozen for review.** See section 9 for what is still open.

## 1. What we are asking for

A **diff audit**. The subject of the review is what changed since the code Offside Labs audited in March 2024.

We are not asking for an independent re-audit of that baseline.
We do expect you to read as much of it as you need: to confirm it is what we say it is, and to judge how the changes interact with it.

There are two separate asks.

| Ask | What it covers | Written by | Files | Changed lines | Lines of code |
|---|---|---|---|---|---|
| **A** | Upstream fixes made after the Offside audit findings, ie changes between `344cc209165eadc52a4c8dd9a0e681b6a659a890` and `fd36cc25b99848a02476156e8f7fcad8589e83de` inclusively | Jupiter's team | 6 | 60 (54 added, 6 removed) | 47 |
| **B** | Our changes on top | Us | 6 | 25 (20 added, 5 removed) | 22 |
| | Both together | | 11 | 85 (74 added, 11 removed) | 69 |

"Changed lines" is what `git diff` reports. "Lines of code" leaves out comments and blank lines.
The audited baseline is 3,339 lines of code.

Ask A is upstream code that we inherit and did not write. One of its five commits has no prior review that we know of.
Ask B is the only code we wrote. It adds one read-only instruction and fixes one bug in `withdraw` that ask A introduced.

## 2. The commits

| Point | Commit | What it is |
|---|---|---|
| **Baseline** | `344cc209165eadc52a4c8dd9a0e681b6a659a890` | Upstream code audited by Offside Labs, 7 to 15 March 2024. Report in `audits/` |
| **Fork point** | `fd36cc25b99848a02476156e8f7fcad8589e83de` | Upstream, 25 March 2024. The baseline plus the five commits of ask A |
| **Review target** | The tip of `main` | The fork point plus ask B. It will be tagged `audit-1` when frozen |

Upstream is https://github.com/TeamRaccoons/WAGMI, the lock programs behind Jupiter's DAO. This repository is a GitHub fork of it.

The diffs, limited to the code in scope:

```sh
# Ask A
git diff 344cc209 fd36cc25 -- programs/locked-voter programs/govern programs/smart-wallet libs/vipers
# Ask B
git diff fd36cc25 main -- programs/locked-voter programs/govern programs/smart-wallet libs/vipers
```

## 3. Ask A: upstream fixes after the audit

Five upstream commits, 6 files.

| Commit | Upstream PR | Change | Referenced in the Offside report |
|---|---|---|---|
| `d0367fd` | #46 | `govern`: corrects the proposal state check in `claim_reward` | **No** |
| `fd36cc2` | #47 | `locked-voter`: minimum remaining duration enforced in `increase_locked_amount` | Yes, finding 01 |
| `1e2f997` | #48 | `smart-wallet`: threshold handling in `set_owners` | Yes, finding 02 |
| `8520613` | #49 | `locked-voter`: comment on voting power timing in `cast_vote` | Yes, finding 03 |
| `f744c77` | #50 | `locked-voter`: close the escrow token account on `withdraw` | Yes, finding 04 |

`d0367fd` is not mentioned in the report's mitigation log.

`f744c77` introduced a bug: it made `withdraw` fail whenever the escrow's token account held more than the escrow's recorded amount. Ask B fixes it. See "The withdraw fix" in section 4.

Upstream later added partial unstaking (PR #51, commit `806e9d8`). It is **not** in this repository.

## 4. Ask B: our changes

| File | Change | Added | Removed |
|---|---|---|---|
| `programs/govern/src/lib.rs` | `declare_id!` | 1 | 1 |
| `programs/smart-wallet/src/lib.rs` | `declare_id!` | 1 | 1 |
| `programs/locked-voter/src/lib.rs` | `declare_id!` and the `voting_power` handler | 6 | 1 |
| `programs/locked-voter/src/instructions/voting_power.rs` | New file, the accounts for `voting_power` | 8 | 0 |
| `programs/locked-voter/src/instructions/mod.rs` | Module export | 2 | 0 |
| `programs/locked-voter/src/instructions/withdraw.rs` | Transfer the vault's real balance | 2 | 2 |

`govern`, `smart-wallet` and `libs/vipers` change only by program ID.

### Program IDs

| Program | Upstream ID | Our ID |
|---|---|---|
| `locked-voter` | `voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj` | `HfPBCZ4QxAXRLkvPBWJL2xtfmLKXcZfbNv7oUagWsxTi` |
| `govern` | `GovaE4iu227srtG2s3tZzB4RmWBzw8sTwrCLZz7kN7rY` | `9NwSsrDnRHki6YLJsejccdx2Bu5JUn1fMYdoyPZ1ZtMu` |
| `smart-wallet` | `smaK3fwkA7ubbxEhsimp1iqPTzfS4MBsNL77QLABZP6` | `3V3UUik5YwwVc52cUsEgWKfXPJktcdcoxyFK1tcYLLVt` |

### The `voting_power` instruction

- Accounts: `locker` and `escrow`, with `has_one = locker` on the escrow. No signer, nothing writable.
- It returns `Escrow::voting_power(&locker)` as a `u64` through Solana return data. That function is upstream code and was already used by `activate_proposal`.
- It writes nothing and moves nothing. It is meant to be called by simulation, or by another program through CPI.
- The RPC trims trailing zero bytes from return data, so callers pad the value to 8 bytes.

### The withdraw fix

**The bug, reported during review.** `withdraw` transferred `escrow.amount` out of the escrow's token account and then closed that account. SPL Token refuses to close an account that still holds tokens. The account's address is public, so anyone could send it one base unit directly. From then on the transfer left that unit behind, the close failed, and every `withdraw` reverted. The owner's tokens were stuck for good, at a cost to the attacker of one base unit and a fee.

It was introduced by upstream commit `f744c77` (PR #50), the fix for Offside finding 04, which added the close. Upstream later removed the close again in PR #51.

**The fix.** `withdraw` now transfers the token account's real balance, `escrow_tokens.amount`, where it used to transfer `escrow.amount`. Two lines change.

- The token account always ends up empty, so the close succeeds. Offside finding 04 stays fixed.
- Anything sent to the account directly goes to the owner along with their own tokens.
- Accounting is unchanged. `locked_supply` still goes down by `escrow.amount`, and the event still reports `escrow.amount`.

`tests/locked-voter/locked_voter.ts` has a test for it: a third party sends one base unit to a locked escrow's token account, and after expiry the owner withdraws successfully, receives the locked amount plus that unit, and both accounts are closed. Before the fix the same withdraw failed with SPL Token error `0xb`.

Apart from this fix, no existing instruction, account layout or formula is changed.

### Changes outside the code in scope

| What | Change |
|---|---|
| `programs/met-voter`, `programs/merkle-distributor`, `cli/`, `.github/` | Deleted. We do not build or deploy them |
| `Cargo.toml` | The five `cli/*` workspace members removed |
| `Cargo.lock` | Entries used only by the deleted members pruned, 532 packages down to 270. No package added or changed version |
| `Anchor.toml` | Our three program IDs. Entries for the two deleted programs removed |
| `tests/` | Tests and helpers for the deleted programs removed. Program IDs updated. Two calls reordered in each of the two governor reward tests. `tests/locked-voter/voting_power.ts` added |
| Added | `AUDIT_SCOPE.md`, `README.md`, `LICENSE`, `NOTICE`, `licenses/`, `build.sh`, `reference/`, `audits/` |

In one build environment, before ask B's code changes were made, this trimmed workspace and the full upstream tree with only the program IDs changed built to byte-identical binaries.

## 5. Questions for the review

1. **Identity.** Is the review target exactly the baseline plus asks A and B in the four folders in scope, with nothing else changed?
2. **Ask A.** Are the five upstream commits correct and safe? Please give particular attention to `d0367fd`.
3. **Ask B.** Are the account constraints and return value of `voting_power` correct and safe, including when called through CPI? Is the `withdraw` fix complete, and does anything else in the programs depend on a token account's balance matching recorded amounts?
4. **Prior findings.** What is the status at the review target of the five Offside findings, including the two that were acknowledged and not fixed: finding 03, voting power timing, and finding 05, transactions that cannot be closed?
5. **Binary identity.** Are the binaries we deploy built from the review target?
6. **Configuration.** Are the deployment parameters and key setup in section 7 safe?
7. **Toolchain.** See section 8.

## 6. Tests and builds

Run on a local validator with the binaries built from this tree:

| Suite | Result |
|---|---|
| `tests/locked-voter/locked_voter.ts`, upstream plus our withdraw test | 15 passing |
| `tests/locked-voter/voting_power.ts`, ours | 5 passing |
| `tests/smartwallet`, upstream | 15 passing, see the note on startup below |
| `tests/govern`, upstream, two tests reordered | 16 passing |

The upstream lock suite covers locking, extending, the minimum and maximum duration checks, vote delegation, max lock, and withdrawing after expiry.
Our suite covers `voting_power` for an empty escrow, a timed lock against the formula, an expired lock, a max lock, and a locker that does not own the escrow.

Three things about these runs that you should know:

- **Two upstream governor tests were stale.** `claimReward.ts` and `claimRewardOptionProposal.ts` added tokens to an escrow before setting its duration. Upstream's own fix for Offside finding 01 made that order invalid, and upstream never updated the tests, so they fail on upstream's code at the fork point. We swapped the two calls in each file. Nothing else in those files changed.
- **The multisig suite races the test validator at startup.** Run through `anchor test`, its setup hooks sometimes fail with "invalid account data for instruction", because the suite's first transactions arrive before the programs loaded at genesis are callable. The other suites begin with airdrops and do not hit this. Against a validator that had been up for 6 seconds, all 15 tests passed in 3 runs out of 3. `smart-wallet` differs from upstream only by its program ID.
- **Environment.** Node 20 on macOS. Upstream's `package-lock.json` does not match its `package.json`, so dependencies were installed without it and resolved to current versions.

```sh
./build.sh
```

Hashes of our local builds, on macOS:

| Binary | SHA-256 |
|---|---|
| `locked_voter.so` | `115fc383eedb7194cec6abdb10eb837b59f25750a376e61c80337d6724e07667` |
| `govern.so` | `d1f2b2e3f25cd0df695b1440c07a5cd1bb33deec449ab2854ca03787e3ccd175` |
| `smart_wallet.so` | `642c6c7cb7a2edba698fe9623399624100c063ff0b22ef874fb2ae146dbd74ed` |

**These are not reproducible hashes.** A local build embeds paths from the build machine. The `govern.so` and `smart_wallet.so` hashes above differ from an earlier draft of this document although their source did not change, only because the toolchain was reinstalled in a different folder. Hashes from a pinned verifiable-build container will replace them before the review starts.

## 7. Deployment configuration and trust model

One locker, governor and smart wallet are created, all derived from a single base key.

| Item | Value |
|---|---|
| Locked token | Classic SPL Token mint, no freeze authority. **Address to be set** |
| `max_stake_duration` | Proposed 126,144,000 s, 4 years. **To be set** |
| `min_stake_duration` | Proposed 604,800 s, 1 week. **To be set** |
| `max_stake_vote_multiplier` | 1 |
| `proposal_activation_min_votes` | Set high. Proposals are not used |
| Governor voting parameters | Quorum set high. Proposals are not used |
| Smart wallet owners and threshold | Team signers plus the governor. Threshold below the owner count. **To be set** |
| Program upgrade authority | A multisig. **To be set** |

| Key | Can | Cannot |
|---|---|---|
| Program upgrade authority | Replace any of the three programs | n/a |
| Smart wallet | Change locker parameters, execute governor transactions | Move or unlock a user's tokens |
| Escrow owner | Add tokens, extend, toggle max lock, set a vote delegate, withdraw after expiry | Withdraw before expiry, shorten a lock |
| Anyone | Create an escrow for any owner, add tokens to any escrow, read any escrow's voting power | Anything else |

Points we want you to know about:

- **Why `govern` and `smart-wallet` are deployed.** A locker cannot be created without a governor, and a governor cannot be created without a smart wallet. We do not plan to use proposals. The smart wallet is the only way to change locker parameters.
- **Anyone can add tokens to anyone's escrow.** This is upstream behaviour, as in Curve's `deposit_for`. It raises the owner's voting power at the depositor's expense. The depositor cannot get the tokens back.
- **How voting power is used.** Our backend reads every escrow of the locker and computes each owner's voting power off-chain with the program's formula. That code is in `reference/`. It is not deployed. Reviewing it against the program is an optional extension of this scope.

## 8. Toolchain

The programs are built with the versions upstream pins and the Offside audit used: Anchor 0.28.0 and Solana CLI 1.16.12. Both are old.

We kept them on purpose. Upgrading would touch every file in the three programs and turn a small diff into a rewrite of audited code.

Please tell us before the review starts if you see known issues in these versions that affect the programs, or if you would require an upgrade. That changes the scope, and we would rather know first.

## 9. Open before the review starts

This document is a draft until every item below is closed.

- [ ] Final values for every "to be set" row in section 7.
- [ ] Confirmation that the program IDs in section 4 are final. If they are regenerated, only the three `declare_id!` lines and the ID entries in `Anchor.toml` and the test helper change.
- [ ] Reproducible hashes from a verifiable-build container, replacing the local hashes in section 6.
- [ ] The review target tagged `audit-1`, with a statement that this exact tree is what we deploy.

## 10. Licence

This repository is distributed under AGPL-3.0. `NOTICE` explains why: upstream states Apache-2.0, but three of the four components descend from AGPL-3.0 projects, Tribeca and Goki.

## 11. Deliverable

A diff audit report that names the baseline commit, the review target commit and the binary hashes, states that its scope is asks A and B, and answers the questions in section 5.
