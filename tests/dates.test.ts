import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, daysTogether, nextOccurrence, relativeDays, toYMD, daysUntil, parseYMD } from "@/lib/dates";

// 16 Oct 2026, midday in whatever time zone the tests run in.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 16, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe("dates", () => {
  it("counts days together", () => {
    expect(daysTogether("2026-10-06")).toBe(10);
    expect(daysTogether("2025-10-16")).toBe(365);
    expect(daysTogether("2026-10-16")).toBe(0);
  });

  it("never shows negative days together for a future date", () => {
    expect(daysTogether("2030-01-01")).toBe(0);
  });

  it("counts days from today in both directions", () => {
    expect(daysFromToday("2026-10-17")).toBe(1);
    expect(daysFromToday("2026-10-15")).toBe(-1);
    expect(daysFromToday("2026-10-16")).toBe(0);
  });

  it("finds the next anniversary", () => {
    expect(toYMD(nextOccurrence("2024-05-20"))).toBe("2027-05-20");
    expect(toYMD(nextOccurrence("2024-12-25"))).toBe("2026-12-25");
  });

  it("treats an anniversary that is today as today, not next year", () => {
    expect(toYMD(nextOccurrence("2020-10-16"))).toBe("2026-10-16");
    expect(daysUntil(nextOccurrence("2020-10-16"))).toBe(0);
  });

  it("round-trips a calendar day", () => {
    expect(toYMD(parseYMD("2024-02-29"))).toBe("2024-02-29");
  });

  it("describes days in plain words", () => {
    expect(relativeDays(0)).toBe("Today 🎉");
    expect(relativeDays(1)).toBe("Tomorrow");
    expect(relativeDays(12)).toBe("In 12 days");
    expect(relativeDays(-1)).toBe("Yesterday");
    expect(relativeDays(-5)).toBe("5 days ago");
  });
});
