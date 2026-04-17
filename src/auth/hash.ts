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
