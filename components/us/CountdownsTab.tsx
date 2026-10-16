"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Plus, X } from "lucide-react";
import { daysFromToday, formatYMD, relativeDays, toYMD } from "@/lib/dates";
import type { Countdown } from "@/lib/types";

export default function CountdownsTab({
  countdowns,
  mounted,
  conversationId,
  supabase,
  onChanged,
  flash,
}: {
  countdowns: Countdown[];
  mounted: boolean;
  conversationId: string;
  supabase: SupabaseClient;
  onChanged: () => void;
  flash: (t: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !date) return;
    const { error } = await supabase.from("us_countdowns").insert({ conversation_id: conversationId, title: t, target_date: date });
    if (error) return flash("Couldn't add that countdown. Try again.");
    setTitle("");
    setDate("");
    onChanged();
  }

  async function remove(c: Countdown) {
    if (!window.confirm(`Delete "${c.title}"?`)) return;
    const { error } = await supabase.from("us_countdowns").delete().eq("id", c.id);
    if (error) return flash("Couldn't delete that countdown.");
    onChanged();
  }

  const withDays = mounted ? countdowns.map((c) => ({ c, days: daysFromToday(c.target_date) })) : [];
  const upcoming = withDays.filter((x) => x.days >= 0).sort((a, b) => a.days - b.days);
  const past = withDays.filter((x) => x.days < 0).sort((a, b) => b.days - a.days);

  const renderRow = ({ c, days }: { c: Countdown; days: number }) => (
    <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/80 px-4 py-3 shadow-card dark:border-white/10 dark:bg-white/5">
      <div className="min-w-0 flex-1">
        <p className={`truncate font-bold ${days < 0 ? "text-ink-muted" : "text-ink dark:text-white"}`}>{c.title}</p>
        <p suppressHydrationWarning className="text-sm text-ink-muted">
          {formatYMD(c.target_date)}
        </p>
      </div>
      <span suppressHydrationWarning className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${days < 0 ? "bg-brand-50 text-ink-muted dark:bg-white/10" : "bg-brand-100 text-brand-700 dark:bg-brand-600/30 dark:text-brand-100"}`}>
        {relativeDays(days)}
      </span>
      <button onClick={() => remove(c)} aria-label={`Delete ${c.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10">
        <X size={17} />
      </button>
    </li>
  );

  return (
    <div>
      <h2 className="mb-3 text-lg font-extrabold text-ink dark:text-white">Countdowns</h2>

      <form onSubmit={add} className="mb-4 space-y-2 rounded-3xl border border-brand-100 bg-white/70 p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="What are you counting down to?"
          aria-label="Countdown name"
          className="w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            min={mounted ? toYMD(new Date()) : undefined}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Countdown date"
            className="min-w-0 flex-1 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-[15px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
          <button type="submit" disabled={!title.trim() || !date} className="flex shrink-0 items-center gap-2 rounded-2xl bg-brand-500 px-5 font-bold text-white shadow-soft hover:bg-brand-600 disabled:opacity-40">
            <Plus size={18} /> Add
          </button>
        </div>
      </form>

      {countdowns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 py-10 text-center dark:border-white/15 dark:bg-white/5">
          <p className="text-4xl">⏳</p>
          <p className="mt-2 font-bold text-ink dark:text-white">Nothing to count down to yet</p>
          <p className="text-sm text-ink-muted">Birthdays, trips, the day you meet next.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">{upcoming.map(renderRow)}</ul>
          {past.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-bold text-ink-muted">Past</h3>
              <ul className="space-y-2">{past.map(renderRow)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
