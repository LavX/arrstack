import bcrypt from "bcryptjs";
import { pbkdf2Sync, randomBytes } from "crypto";

export async function bcryptHash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function bcryptVerify(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function qbitPbkdf2Hash(password: string): string {
  const salt = randomBytes(16);
  const key = pbkdf2Sync(password, salt, 100000, 64, "sha512");
  return `@ByteArray(${salt.toString("base64")}:${key.toString("base64")})`;
}

// Bazarr+ password hash format: pbkdf2:<salt_hex>:<hash_hex>
// See /home/lavx/bazarr/bazarr/utilities/helper.py:17-20
// SHA-256, 600k iterations, 16-byte random salt, hex encoding.
export function bazarrPbkdf2Hash(password: string): string {
  const salt = randomBytes(16);
  const key = pbkdf2Sync(password, salt, 600_000, 32, "sha256");
  return `pbkdf2:${salt.toString("hex")}:${key.toString("hex")}`;
}
