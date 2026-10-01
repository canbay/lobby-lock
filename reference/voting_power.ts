const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const ESCROW_SIZE = 322;
export const ESCROW_SLICE = { offset: 40, length: 122 };

export interface Lock {
  owner: string;
  amount: bigint;
  start: bigint;
  end: bigint;
  maxLock: boolean;
}

export interface LockParams {
  multiplier: bigint;
  maxDuration: bigint;
}

export function base58(bytes: Uint8Array): string {
  let out = "";
  for (let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`); n > 0n; n /= 58n) out = ALPHABET[Number(n % 58n)] + out;
  for (const byte of bytes) {
    if (byte) break;
    out = `1${out}`;
  }
  return out;
}

export function decodeLockerParams(locker: Buffer): LockParams {
  return { multiplier: BigInt(locker[121]!), maxDuration: locker.readBigUInt64LE(130) };
}

export function decodeLock(slice: Buffer): Lock {
  return {
    owner: base58(slice.subarray(0, 32)),
    amount: slice.readBigUInt64LE(65),
    start: slice.readBigInt64LE(73),
    end: slice.readBigInt64LE(81),
    maxLock: slice[121] === 1,
  };
}

export function votingPower(lock: Lock, params: LockParams, now: bigint): bigint {
  const full = lock.amount * params.multiplier;
  if (lock.maxLock) return full;
  if (lock.start === 0n || now < lock.start || now >= lock.end) return 0n;
  const left = lock.end - now;
  return (full * (left < params.maxDuration ? left : params.maxDuration)) / params.maxDuration;
}
