"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, Plus, X } from "lucide-react";
import type { BucketItem } from "@/lib/types";

export default function BucketTab({
  items,
  setItems,
  conversationId,
  meId,
  supabase,
  onChanged,
  flash,
}: {
  items: BucketItem[];
  setItems: React.Dispatch<React.SetStateAction<BucketItem[]>>;
  conversationId: string;
  meId: string;
  supabase: SupabaseClient;
  onChanged: () => void;
  flash: (t: string) => void;
}) {
  const [text, setText] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = text.trim();
    if (!title) return;
    setText("");
    const { error } = await supabase.from("us_bucket_items").insert({ conversation_id: conversationId, title, created_by: meId });
    if (error) {
      setText(title);
      return flash("Couldn't add that. Try again.");
    }
    onChanged();
  }

  async function toggle(item: BucketItem) {
    const done = !item.done;
    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, done } : x)));
    const { error } = await supabase
      .from("us_bucket_items")
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) {
      flash("Couldn't update that item.");
      onChanged();
    }
  }

  async function remove(item: BucketItem) {
    setItems((p) => p.filter((x) => x.id !== item.id));
    const { error } = await supabase.from("us_bucket_items").delete().eq("id", item.id);
    if (error) {
      flash("Couldn't remove that item.");
      onChanged();
    }
  }

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;

  const renderItem = (item: BucketItem) => (
    <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/80 px-3 py-2.5 shadow-card dark:border-white/10 dark:bg-white/5">
      <button
        onClick={() => toggle(item)}
        role="checkbox"
        aria-checked={item.done}
        aria-label={`${item.title}, ${item.done ? "done" : "not done"}`}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${
          item.done ? "border-brand-500 bg-brand-500 text-white" : "border-brand-300 text-transparent hover:border-brand-500"
        }`}
      >
        <Check size={16} />
      </button>
      <span className={`min-w-0 flex-1 break-words text-[15px] ${item.done ? "text-ink-muted line-through" : "text-ink dark:text-white"}`}>{item.title}</span>
      <button onClick={() => remove(item)} aria-label={`Remove ${item.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10">
        <X size={17} />
      </button>
    </li>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink dark:text-white">Bucket List</h2>
        {items.length > 0 && (
          <span className="text-sm font-semibold text-ink-muted">
            {done.length} of {items.length} done
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-brand-100 dark:bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Bucket list progress">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          placeholder="Something we want to do together…"
          aria-label="New bucket list item"
          className="min-w-0 flex-1 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Add item" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500 text-white shadow-soft hover:bg-brand-600 disabled:opacity-40">
          <Plus size={22} />
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 py-10 text-center dark:border-white/15 dark:bg-white/5">
          <p className="text-4xl">🗺️</p>
          <p className="mt-2 font-bold text-ink dark:text-white">Start your bucket list</p>
          <p className="text-sm text-ink-muted">Trips, dinners, silly challenges. Tick them off together.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">{pending.map(renderItem)}</ul>
          {done.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-bold text-ink-muted">Done 🎉</h3>
              <ul className="space-y-2">{done.map(renderItem)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
