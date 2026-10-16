export const DISAPPEAR_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Off" },
  { value: 86400, label: "24 hours" },
  { value: 604800, label: "7 days" },
];

export function disappearLabel(seconds: number) {
  const hit = DISAPPEAR_OPTIONS.find((o) => o.value === seconds);
  if (hit) return hit.label;
  if (seconds % 86400 === 0) return `${seconds / 86400} days`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hours`;
  return `${Math.round(seconds / 60)} minutes`;
}
