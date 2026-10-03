# lobby token lock

A vote-escrow lock for Solana: lock a token for a chosen duration, get voting power that decays linearly to zero at expiry. This is the model of Curve's veCRV.

This repository is a fork of https://github.com/TeamRaccoons/WAGMI, the lock programs behind Jupiter's DAO, at commit `fd36cc25b99848a02476156e8f7fcad8589e83de`.

> **We are preparing a diff audit of this fork.** [`AUDIT_SCOPE.md`](./AUDIT_SCOPE.md) describes it.

## What is different from upstream

- **Program IDs.** Our own, in the three programs.
- **A read-only `voting_power` instruction** on `locked-voter`. It takes a locker and an escrow and returns the escrow's current voting power. It reuses the program's existing formula and writes nothing.
- **A fix to `withdraw`.** It transfers the escrow token account's real balance, so tokens sent to that account by a third party can no longer block a withdrawal.
- **Unused code removed.** The upstream programs, tools and CI that we do not deploy are deleted.

Apart from the `withdraw` fix, the lock's behaviour is unchanged.

## Layout

| Path | What it is |
|---|---|
| `programs/locked-voter` | The lock. Holds tokens, defines voting power |
| `programs/govern` | Governor, required by a locker |
| `programs/smart-wallet` | Multisig, admin of the locker's parameters |
| `libs/vipers` | Assertion macros compiled into all three |
| `tests/` | Upstream's test suites for the three programs, plus `tests/locked-voter/voting_power.ts` |
| `reference/` | The off-chain code we use to read voting power. Not deployed |
| `audits/` | The Offside Labs audit of the upstream code, March 2024 |
| `AUDIT_SCOPE.md` | Scope of the diff audit |

## Program IDs

| Program | ID |
|---|---|
| `locked-voter` | `HfPBCZ4QxAXRLkvPBWJL2xtfmLKXcZfbNv7oUagWsxTi` |
| `govern` | `9NwSsrDnRHki6YLJsejccdx2Bu5JUn1fMYdoyPZ1ZtMu` |
| `smart-wallet` | `3V3UUik5YwwVc52cUsEgWKfXPJktcdcoxyFK1tcYLLVt` |

## Build and test

The toolchain is the one upstream pins: Solana CLI 1.16.12 and Anchor 0.28.0.

```sh
./build.sh
```

```sh
npm install --no-package-lock
anchor test --run ./tests/locked-voter
anchor test --run ./tests/govern
anchor test --run ./tests/smartwallet
```

The test scripts call `yarn`, and were run here on Node 20. Upstream's `package-lock.json` does not match its `package.json`, which is why the install skips it.

## Calling `voting_power`

Simulate a transaction with the instruction and read the return data as a little-endian `u64`.
The RPC trims trailing zero bytes from return data, so pad the value to 8 bytes before decoding.

## Licence

GNU Affero General Public License v3. See [`LICENSE`](./LICENSE), and [`NOTICE`](./NOTICE) for the origin of the code.
