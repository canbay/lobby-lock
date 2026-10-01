#!/bin/sh
set -e
cd "$(dirname "$0")"
for p in smart-wallet govern locked-voter; do
  cargo build-sbf --manifest-path programs/$p/Cargo.toml
done
shasum -a 256 target/deploy/smart_wallet.so target/deploy/govern.so target/deploy/locked_voter.so
