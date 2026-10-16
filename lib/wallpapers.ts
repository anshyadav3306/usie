export const WALLPAPERS = [
  { key: "hearts", label: "Hearts", className: "wp-hearts" },
  { key: "blossom", label: "Blossom", className: "wp-blossom" },
  { key: "stars", label: "Stars", className: "wp-stars" },
  { key: "clouds", label: "Clouds", className: "wp-clouds" },
  { key: "sunset", label: "Sunset", className: "wp-sunset" },
  { key: "plain", label: "Plain", className: "wp-plain" },
] as const;

export function wallpaperClass(key?: string | null) {
  return WALLPAPERS.find((w) => w.key === key)?.className ?? "wp-hearts";
}
