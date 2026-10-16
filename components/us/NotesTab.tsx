"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Plus, Trash2, X } from "lucide-react";
import { dayLabel, formatTime } from "@/lib/format";
import type { Note } from "@/lib/types";

type Draft = { id: string | null; title: string; body: string };

export default function NotesTab({
  notes,
  meId,
  partnerName,
  conversationId,
  supabase,
  onChanged,
  flash,
}: {
  notes: Note[];
  meId: string;
  partnerName: string;
  conversationId: string;
  supabase: SupabaseClient;
  onChanged: () => void;
  flash: (t: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title && !body) return setDraft(null);
    setSaving(true);
    const { error } = draft.id
      ? await supabase.from("us_notes").update({ title, body, updated_by: meId }).eq("id", draft.id)
      : await supabase.from("us_notes").insert({ conversation_id: conversationId, title, body, author_id: meId, updated_by: meId });
    setSaving(false);
    if (error) return flash("Couldn't save the note. Try again.");
    setDraft(null);
    onChanged();
  }

  async function remove() {
    if (!draft?.id || !window.confirm("Delete this note for both of you?")) return;
    const { error } = await supabase.from("us_notes").delete().eq("id", draft.id);
    if (error) return flash("Couldn't delete the note.");
    setDraft(null);
    onChanged();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink dark:text-white">Our Notes</h2>
        <button
          onClick={() => setDraft({ id: null, title: "", body: "" })}
          className="flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-brand-600"
        >
          <Plus size={17} /> New note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 py-10 text-center dark:border-white/15 dark:bg-white/5">
          <p className="text-4xl">📝</p>
          <p className="mt-2 font-bold text-ink dark:text-white">No notes yet</p>
          <p className="text-sm text-ink-muted">Date ideas, little reminders, things to tell each other. Both of you can edit them.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setDraft({ id: n.id, title: n.title, body: n.body })}
                className="block h-full w-full rounded-3xl border border-brand-100 bg-white/80 p-4 text-left shadow-card transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <p className="truncate font-bold text-ink dark:text-white">{n.title || n.body.split("\n")[0]}</p>
                {n.title && n.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-ink-soft dark:text-white/70">{n.body}</p>}
                <p suppressHydrationWarning className="mt-3 text-xs text-ink-muted">
                  {n.updated_by && n.updated_by !== n.author_id ? `Edited by ${n.updated_by === meId ? "you" : partnerName}` : n.author_id === meId ? "By you" : `By ${partnerName}`}
                  {" · "}
                  {dayLabel(n.updated_at)}, {formatTime(n.updated_at)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => setDraft(null)} role="dialog" aria-label={draft.id ? "Edit note" : "New note"}>
          <div className="safe-bottom flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white p-5 shadow-soft dark:bg-[#1b1630] sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-ink dark:text-white">{draft.id ? "Edit note" : "New note"}</h3>
              <button onClick={() => setDraft(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={120}
              placeholder="Title"
              aria-label="Note title"
              className="mb-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 font-bold text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
            />
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              maxLength={10000}
              rows={8}
              placeholder="Write something sweet…"
              aria-label="Note text"
              className="min-h-[160px] flex-1 resize-none rounded-2xl border border-brand-100 bg-white px-4 py-3 text-[15px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
            />
            <div className="mt-4 flex gap-2">
              {draft.id && (
                <button onClick={remove} aria-label="Delete note" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-400/30 dark:hover:bg-rose-500/10">
                  <Trash2 size={19} />
                </button>
              )}
              <button onClick={save} disabled={saving} className="h-12 flex-1 rounded-2xl bg-brand-500 font-bold text-white shadow-soft hover:bg-brand-600 disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
