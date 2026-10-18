import { afterEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { configStatus, explainSendFailure, subjectOk, vapidKeysMatch } from "@/lib/push-server";
import { describePushError, keyToBytes, sameKey } from "@/lib/push";

const pair = webpush.generateVAPIDKeys();
const other = webpush.generateVAPIDKeys();

describe("VAPID keys", () => {
  it("accepts a matching pair", () => {
    expect(vapidKeysMatch(pair.publicKey, pair.privateKey)).toBe(true);
  });

  it("rejects a public key that belongs to a different private key", () => {
    expect(vapidKeysMatch(other.publicKey, pair.privateKey)).toBe(false);
  });

  it("rejects missing, damaged or quoted values", () => {
    expect(vapidKeysMatch(undefined, pair.privateKey)).toBe(false);
    expect(vapidKeysMatch(pair.publicKey, "not-a-key")).toBe(false);
    expect(vapidKeysMatch(`"${pair.publicKey}"`, pair.privateKey)).toBe(false);
  });

  it("ignores spaces and new lines pasted around a key", () => {
    expect(vapidKeysMatch(` ${pair.publicKey}\n`, `${pair.privateKey}\r\n`)).toBe(true);
  });

  it("checks the contact address", () => {
    expect(subjectOk("mailto:me@example.com")).toBe(true);
    expect(subjectOk("https://usie.example.com")).toBe(true);
    expect(subjectOk("me@example.com")).toBe(false);
    expect(subjectOk("")).toBe(false);
    expect(subjectOk(undefined)).toBe(false);
  });
});

describe("server setup report", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lists every missing setting by name, never by value", () => {
    for (const n of ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "SUPABASE_SERVICE_ROLE_KEY", "WEBHOOK_SECRET", "CRON_SECRET"]) vi.stubEnv(n, "");
    const s = configStatus();
    expect(s.problems.some((p) => p.includes("SUPABASE_SERVICE_ROLE_KEY"))).toBe(true);
    expect(s.problems.some((p) => p.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY"))).toBe(true);
    expect(JSON.stringify(s)).not.toContain(pair.privateKey);
  });

  it("flags keys that do not belong together", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", other.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", pair.privateKey);
    expect(configStatus().problems.join(" ")).toMatch(/matching pair/);
  });

  it("reports no problems when everything is set correctly", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", pair.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", pair.privateKey);
    vi.stubEnv("VAPID_SUBJECT", "mailto:me@example.com");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "x");
    vi.stubEnv("WEBHOOK_SECRET", "x");
    vi.stubEnv("CRON_SECRET", "x");
    expect(configStatus().problems).toEqual([]);
  });

  it("explains push-service rejections in plain words", () => {
    expect(explainSendFailure({ status: 403 })).toMatch(/older key/);
    expect(explainSendFailure({ status: 410 })).toMatch(/expired/);
    expect(explainSendFailure({ status: 429 })).toMatch(/Wait a minute/);
    expect(explainSendFailure(null)).toMatch(/did not accept/);
  });
});

describe("browser push errors", () => {
  it("tells people what to do for each kind of failure", async () => {
    expect(await describePushError({ name: "NotAllowedError", message: "x" })).toMatch(/blocked/);
    expect(await describePushError({ name: "AbortError", message: "Registration failed - push service error" })).toMatch(/push service refused/);
    expect(await describePushError({ name: "InvalidAccessError", message: "bad applicationServerKey" })).toMatch(/not valid/);
    expect(await describePushError(new Error("Saving this device failed: permission denied"))).toBe("Saving this device failed: permission denied");
  });

  it("gives Brave users the exact setting to change", async () => {
    vi.stubGlobal("navigator", { brave: { isBrave: async () => true } });
    expect(await describePushError({ name: "AbortError", message: "Registration failed - push service error" })).toMatch(/Use Google services for push messaging/);
    vi.unstubAllGlobals();
  });

  it("compares push keys byte for byte", () => {
    const a = keyToBytes(pair.publicKey);
    expect(sameKey(a.buffer as ArrayBuffer, a)).toBe(true);
    expect(sameKey(keyToBytes(other.publicKey).buffer as ArrayBuffer, a)).toBe(false);
    expect(sameKey(null, a)).toBe(false);
  });
});
