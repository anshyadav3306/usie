export const MAX_VOICE_MS = 5 * 60 * 1000;
export const MIN_VOICE_MS = 600;

export type VoiceResult = { blob: Blob; mime: string; durationMs: number; waveform: number[] };

export function voiceSupported() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

// Chrome and Firefox record webm/ogg; Safari records mp4. Pick whatever this browser can do.
export function pickVoiceMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function baseMime(mime: string) {
  return mime.split(";")[0] || "audio/webm";
}

export function extForMime(mime: string) {
  const base = baseMime(mime);
  if (base === "audio/mp4") return "m4a";
  if (base === "audio/ogg") return "ogg";
  return "webm";
}

// Turns raw loudness readings into a fixed number of bars (6 to 100) for drawing.
export function downsampleWaveform(samples: number[], bars = 40): number[] {
  if (samples.length === 0) return Array(bars).fill(8);
  const size = samples.length / bars;
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = Math.min(samples.length - 1, Math.floor(i * size));
    const end = Math.max(start + 1, Math.floor((i + 1) * size));
    peaks.push(Math.max(...samples.slice(start, end)));
  }
  const top = Math.max(...peaks) || 1;
  return peaks.map((v) => Math.max(6, Math.round((v / top) * 100)));
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
