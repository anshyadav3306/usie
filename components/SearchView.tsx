"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dayLabel, formatTime } from "@/lib/format";
import type { Message } from "@/lib/types";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function snippet(text: string, term: string) {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0 || text.length <= 140) return text;
  const start = Math.max(0, i - 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + 140)}${start + 140 < text.length ? "…" : ""}`;
}

function Highlight({ text, term }: { text: string; term: string }) {
  const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-brand-200 px-0.5 text-ink dark:bg-brand-600/60 dark:text-white">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function SearchView({
  conversationId,
  meId,
  partnerName,
}: {
  conversationId: string | null;
  meId: string;
  partnerName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!conversationId || term.length < 2) {
      setResults([]);
      setSearched("");
      setFailed(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .ilike("body", `%${escaped}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setFailed(!!error);
      setResults((data ?? []) as Message[]);
      setSearched(term);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, conversationId, supabase]);

  return (
    <div className="safe-top h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 pb-10 pt-5">
        <h1 className="text-2xl font-extrabold text-ink dark:text-white">Search</h1>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/80 px-4 py-3 shadow-card focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200 dark:border-white/10 dark:bg-white/10">
          <SearchIcon size={18} className="shrink-0 text-brand-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your messages…"
            aria-label="Search messages"
            className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none dark:text-white"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="text-ink-muted hover:text-brand-600">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="mt-5" aria-live="polite">
          {!conversationId && <p className="text-center text-sm text-ink-muted">Search works once you and your person are both in.</p>}
          {conversationId && q.trim().length < 2 && <p className="text-center text-sm text-ink-muted">Type at least 2 letters to search your chat.</p>}
          {loading && <p className="text-center text-sm text-ink-muted">Searching…</p>}
          {failed && <p className="rounded-xl bg-blush-100 px-4 py-2.5 text-sm text-rose-700">Search failed. Check your connection and try again.</p>}
          {!loading && !failed && searched && results.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-3xl">🔍</p>
              <p className="mt-2 font-bold text-ink dark:text-white">Nothing found for &ldquo;{searched}&rdquo;</p>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <>
            <p className="mb-2 mt-1 text-sm font-semibold text-ink-muted">
              {results.length}
              {results.length === 50 ? "+" : ""} {results.length === 1 ? "message" : "messages"}
            </p>
            <ul className="space-y-2">
              {results.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/chats/${conversationId}?m=${m.id}`}
                    className="block rounded-2xl border border-brand-100 bg-white/70 px-4 py-3 shadow-card transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-bold text-brand-700 dark:text-brand-200">{m.sender_id === meId ? "You" : partnerName}</span>
                      <span suppressHydrationWarning className="text-ink-muted">
                        {dayLabel(m.created_at)}, {formatTime(m.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-[15px] text-ink dark:text-white">
                      <Highlight text={snippet(m.body ?? "", searched)} term={searched} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
