"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Trash2 } from "lucide-react";
import { MAX_VOICE_MS, MIN_VOICE_MS, downsampleWaveform, formatDuration, pickVoiceMime, type VoiceResult } from "@/lib/voice";

type Props = {
  onSend: (v: VoiceResult) => void;
  onCancel: () => void;
  onError: (text: string) => void;
};

export default function VoiceRecorder({ onSend, onCancel, onError }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const callbacks = useRef({ onSend, onCancel, onError });
  callbacks.current = { onSend, onCancel, onError };

  const recorder = useRef<MediaRecorder | null>(null);
  const stopWith = useRef<"send" | "cancel">("cancel");

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const chunks: Blob[] = [];
    const samples: number[] = [];
    let startedAt = 0;

    const release = () => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => {});
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (!alive) return release();

        const mime = pickVoiceMime();
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
        recorder.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          release();
          const durationMs = Math.min(Date.now() - startedAt, MAX_VOICE_MS);
          if (stopWith.current !== "send") return callbacks.current.onCancel();
          if (durationMs < MIN_VOICE_MS) {
            callbacks.current.onError("That was too short. Hold on a little longer.");
            return callbacks.current.onCancel();
          }
          const type = rec.mimeType || mime || "audio/webm";
          callbacks.current.onSend({ blob: new Blob(chunks, { type }), mime: type, durationMs, waveform: downsampleWaveform(samples) });
        };

        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new Ctx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);

        startedAt = Date.now();
        rec.start(250);
        timer = setInterval(() => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          const level = peak / 128;
          samples.push(level);
          setLevels((l) => [...l.slice(-31), level]);
          const ms = Date.now() - startedAt;
          setElapsed(ms);
          if (ms >= MAX_VOICE_MS) finish("send");
        }, 100);
      } catch {
        release();
        callbacks.current.onError("Couldn't use the microphone. Allow it in your browser or phone settings and try again.");
        callbacks.current.onCancel();
      }
    })();

    return () => {
      alive = false;
      stopWith.current = "cancel";
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      else release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(kind: "send" | "cancel") {
    stopWith.current = kind;
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else callbacks.current.onCancel();
  }

  return (
    <div className="mb-3 flex items-center gap-2" role="group" aria-label="Recording a voice message">
      <button
        type="button"
        onClick={() => finish("cancel")}
        aria-label="Discard recording"
        className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-card hover:bg-rose-50 dark:border-rose-400/30 dark:bg-white/10"
      >
        <Trash2 size={20} />
      </button>
      <div className="flex min-h-[46px] flex-1 items-center gap-3 rounded-3xl border border-brand-100 bg-white px-4 shadow-card dark:border-white/10 dark:bg-white/10">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" aria-hidden />
        <span className="w-10 shrink-0 text-sm font-bold tabular-nums text-ink dark:text-white" aria-live="off">
          {formatDuration(elapsed)}
        </span>
        <div className="flex h-8 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
          {levels.map((l, i) => (
            <span key={i} className="w-[3px] shrink-0 rounded-full bg-brand-400" style={{ height: `${Math.max(12, Math.round(l * 100))}%` }} />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => finish("send")}
        aria-label="Send voice message"
        className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-brand-500 text-white shadow-soft hover:bg-brand-600"
      >
        <ArrowUp size={22} />
      </button>
    </div>
  );
}
