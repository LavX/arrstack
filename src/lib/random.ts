import { randomBytes } from "crypto";

export function generateApiKey(): string {
  return randomBytes(16).toString("hex");
}

export function generatePassword(): string {
  // Charset excludes confusable characters: 0, O, 1, l, I
  const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const segments = Array.from({ length: 4 }, () => {
    let seg = "";
    while (seg.length < 4) {
      const byte = randomBytes(1)[0];
      // Rejection sampling to avoid modulo bias
      if (byte < Math.floor(256 / charset.length) * charset.length) {
        seg += charset[byte % charset.length];
      }
    }
    return seg;
  });
  return segments.join("-");
}
