import * as anchor from "@coral-xyz/anchor";
import { Program, Wallet, web3 } from "@coral-xyz/anchor";
import { Govern, IDL as GovernIDL } from "../../target/types/govern";
import {
  SmartWallet,
  IDL as SmartWalletIDL,
} from "../../target/types/smart_wallet";
import { LockedVoter, IDL as LockedVoterIDL } from "../../target/types/locked_voter";

export function createSmartWalletProgram(
  wallet: Wallet,
  programId: web3.PublicKey
) {
  const provider = new anchor.AnchorProvider(
    anchor.AnchorProvider.env().connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  const program = new Program<SmartWallet>(SmartWalletIDL, programId, provider);

  return program;
}

export function createGovernProgram(wallet: Wallet, programId: web3.PublicKey) {
  const provider = new anchor.AnchorProvider(
    anchor.AnchorProvider.env().connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  const program = new Program<Govern>(GovernIDL, programId, provider);

  return program;
}

export function createLockedVoterProgram(wallet: Wallet, programId: web3.PublicKey) {
  const provider = new anchor.AnchorProvider(
    anchor.AnchorProvider.env().connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  const program = new Program<LockedVoter>(LockedVoterIDL, programId, provider);

  return program;
}

export const GOVERN_PROGRAM_ID = new web3.PublicKey(
  "9NwSsrDnRHki6YLJsejccdx2Bu5JUn1fMYdoyPZ1ZtMu"
);

export const LOCKED_VOTER_PROGRAM_ID = new web3.PublicKey(
  "HfPBCZ4QxAXRLkvPBWJL2xtfmLKXcZfbNv7oUagWsxTi"
);

export const SMART_WALLET_PROGRAM_ID = new web3.PublicKey(
  "3V3UUik5YwwVc52cUsEgWKfXPJktcdcoxyFK1tcYLLVt"
);
