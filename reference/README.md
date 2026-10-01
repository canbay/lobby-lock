# Off-chain reader

`voting_power.ts` is how our backend turns lock accounts into vote weights. It is not deployed and not part of the programs.

- It reads every `Escrow` of one `Locker` with a single `getProgramAccounts` call, filtered by account size `ESCROW_SIZE` and by the locker key at offset 8, taking the byte range `ESCROW_SLICE` of each account.
- `decodeLock` reads the owner, amount, start, end and max-lock flag from that range.
- `decodeLockerParams` reads the multiplier and maximum duration from the `Locker` account.
- `votingPower` applies the same integer formula as `Locker::calculate_voter_power` in `programs/locked-voter/src/locker.rs`.

The on-chain `voting_power` instruction returns the same number for a single escrow, computed by the program itself.
