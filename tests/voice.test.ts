import { describe, expect, it } from "vitest";
import { baseMime, downsampleWaveform, extForMime, formatDuration } from "@/lib/voice";

describe("voice waveform", () => {
  it("always returns the requested number of bars", () => {
    expect(downsampleWaveform([0.1, 0.5, 0.9], 40)).toHaveLength(40);
    expect(downsampleWaveform(Array.from({ length: 1000 }, (_, i) => (i % 10) / 10), 40)).toHaveLength(40);
  });

  it("scales the loudest bar to 100 and keeps quiet bars visible", () => {
    const bars = downsampleWaveform([0, 0.2, 1, 0.1], 4);
    expect(Math.max(...bars)).toBe(100);
    expect(Math.min(...bars)).toBeGreaterThanOrEqual(6);
  });

  it("handles an empty or silent recording", () => {
    expect(downsampleWaveform([], 5)).toEqual([8, 8, 8, 8, 8]);
    const silent = downsampleWaveform([0, 0, 0, 0], 4);
    expect(silent.every((v) => v >= 6 && v <= 100)).toBe(true);
  });
});

describe("voice formats", () => {
  it("formats durations as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5400)).toBe("0:05");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(-10)).toBe("0:00");
  });

  it("maps recorder types to a clean content type and file ending", () => {
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(extForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extForMime("audio/mp4")).toBe("m4a");
    expect(extForMime("audio/ogg;codecs=opus")).toBe("ogg");
  });
});
