import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayLabel, lastSeenText, listTime, summarize } from "@/lib/format";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

const at = (y: number, m: number, d: number, h = 9, min = 41) => new Date(y, m, d, h, min).toISOString();

describe("format", () => {
  it("labels days", () => {
    expect(dayLabel(at(2026, 9, 16))).toBe("Today");
    expect(dayLabel(at(2026, 9, 15))).toBe("Yesterday");
    expect(dayLabel(at(2026, 8, 1))).toMatch(/1/);
  });

  it("shows the time for today and the day label otherwise in the chat list", () => {
    expect(listTime(at(2026, 9, 15))).toBe("Yesterday");
    expect(listTime(at(2026, 9, 16))).not.toBe("Today");
  });

  it("writes last seen in plain words", () => {
    expect(lastSeenText(at(2026, 9, 16))).toMatch(/^Last seen today at /);
    expect(lastSeenText(at(2026, 9, 15))).toMatch(/^Last seen yesterday at /);
    expect(lastSeenText(at(2026, 8, 1))).toMatch(/^Last seen /);
  });

  it("summarises each kind of message", () => {
    expect(summarize({ type: "text", body: "hello", deleted_at: null })).toBe("hello");
    expect(summarize({ type: "image", body: null, deleted_at: null })).toBe("📷 Photo");
    expect(summarize({ type: "voice", body: null, deleted_at: null })).toBe("🎤 Voice message");
    expect(summarize({ type: "text", body: "secret", deleted_at: "2026-10-16" })).toBe("Message deleted");
  });
});
