export default function Avatar({
  name,
  url,
  size = 44,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-blush-200 to-brand-300 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
