"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatDuration } from "@/lib/voice";

// Only one voice message plays at a time.
let current: HTMLAudioElement | null = null;

export default function VoiceBubble({
  url,
  durationMs,
  waveform,
}: {
  url: string | null;
  durationMs: number;
  waveform: number[] | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);

  const bars = waveform && waveform.length ? waveform : Array(40).fill(30);

  const total = () => {
    const a = audioRef.current;
    // Browser-recorded files often report no duration, so fall back to the one we stored.
    return a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 : durationMs || 1;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTimeMs(a.currentTime * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setTimeMs(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      if (current === a) current = null;
    };
  }, [url]);

  function toggle() {
    const a = audioRef.current;
    if (!a || !url) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !url) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = (fraction * total()) / 1000;
    setTimeMs(fraction * total());
  }

  const progress = Math.min(1, timeMs / total());

  return (
    <div className="flex w-[min(230px,64vw)] items-center gap-3 py-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-white shadow-soft hover:bg-brand-600 disabled:opacity-50"
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
      </button>
      <div className="min-w-0 flex-1">
        <div onClick={seek} className="flex h-8 cursor-pointer items-center gap-[2px]" role="slider" aria-label="Voice message position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          {bars.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full ${i / bars.length < progress ? "bg-brand-600 dark:bg-brand-200" : "bg-brand-400/40 dark:bg-white/30"}`}
              style={{ height: `${Math.max(12, h)}%` }}
            />
          ))}
        </div>
        <p className="text-[11px] tabular-nums text-ink-muted dark:text-white/60">{formatDuration(playing || timeMs > 0 ? timeMs : durationMs)}</p>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={url ?? undefined} preload="metadata" />
    </div>
  );
}
