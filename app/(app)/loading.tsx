// Shown instantly while a page's data is on its way, so a tap never feels frozen.
export default function Loading() {
  return (
    <div className="safe-top h-full px-5 pt-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-40 animate-pulse rounded-full bg-brand-100 dark:bg-white/10" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-brand-100 dark:bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-brand-100 dark:bg-white/10" />
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-brand-50 dark:bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
