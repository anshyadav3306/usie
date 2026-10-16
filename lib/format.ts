export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function listTime(iso: string) {
  const label = dayLabel(iso);
  return label === "Today" ? formatTime(iso) : label;
}

export function lastSeenText(iso: string) {
  const label = dayLabel(iso);
  if (label === "Today") return `Last seen today at ${formatTime(iso)}`;
  if (label === "Yesterday") return `Last seen yesterday at ${formatTime(iso)}`;
  return `Last seen ${label}`;
}

export function summarize(m: { type: string; body: string | null; deleted_at: string | null }) {
  if (m.deleted_at) return "Message deleted";
  if (m.type === "image") return "📷 Photo";
  if (m.type === "voice") return "🎤 Voice message";
  return m.body ?? "";
}
