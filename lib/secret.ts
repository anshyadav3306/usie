import { timingSafeEqual } from "node:crypto";

// Compares a received secret with the expected one without leaking timing information.
export function sameSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
