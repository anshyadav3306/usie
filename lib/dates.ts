// Dates on the Us page are plain calendar days ("2024-05-20"), compared in the viewer's own time zone.
export function parseYMD(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function toYMD(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Positive = in the future, negative = in the past.
export function daysFromToday(s: string) {
  return Math.round((parseYMD(s).getTime() - todayStart().getTime()) / 86_400_000);
}

export function daysTogether(s: string) {
  return Math.max(0, -daysFromToday(s));
}

export function nextOccurrence(s: string) {
  const d = parseYMD(s);
  const t = todayStart();
  let n = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (n < t) n = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  return n;
}

export function daysUntil(d: Date) {
  return Math.round((d.getTime() - todayStart().getTime()) / 86_400_000);
}

export function formatYMD(s: string) {
  return parseYMD(s).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(d: Date) {
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function relativeDays(n: number) {
  if (n === 0) return "Today 🎉";
  if (n === 1) return "Tomorrow";
  if (n > 1) return `In ${n} days`;
  if (n === -1) return "Yesterday";
  return `${-n} days ago`;
}
