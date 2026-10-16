import { describe, expect, it } from "vitest";
import { DISAPPEAR_OPTIONS, disappearLabel } from "@/lib/disappear";
import { WALLPAPERS, wallpaperClass } from "@/lib/wallpapers";
import { sameSecret } from "@/lib/secret";

describe("disappearing messages", () => {
  it("offers off, 24 hours and 7 days", () => {
    expect(DISAPPEAR_OPTIONS.map((o) => o.value)).toEqual([null, 86400, 604800]);
  });

  it("labels any stored duration", () => {
    expect(disappearLabel(86400)).toBe("24 hours");
    expect(disappearLabel(604800)).toBe("7 days");
    expect(disappearLabel(172800)).toBe("2 days");
    expect(disappearLabel(7200)).toBe("2 hours");
    expect(disappearLabel(300)).toBe("5 minutes");
  });
});

describe("wallpapers", () => {
  it("falls back to hearts for unknown or missing values", () => {
    expect(wallpaperClass(null)).toBe("wp-hearts");
    expect(wallpaperClass("nonsense")).toBe("wp-hearts");
  });

  it("has a class for every option", () => {
    for (const w of WALLPAPERS) expect(wallpaperClass(w.key)).toBe(w.className);
  });
});

describe("webhook secret check", () => {
  it("accepts only the exact secret", () => {
    expect(sameSecret("abc123", "abc123")).toBe(true);
    expect(sameSecret("abc124", "abc123")).toBe(false);
    expect(sameSecret("abc12", "abc123")).toBe(false);
  });

  it("rejects missing values so an unset secret never lets anyone in", () => {
    expect(sameSecret(null, "abc123")).toBe(false);
    expect(sameSecret("abc123", undefined)).toBe(false);
    expect(sameSecret("", "")).toBe(false);
    expect(sameSecret(null, undefined)).toBe(false);
  });
});
