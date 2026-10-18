// The chat screen's outline appears immediately; the messages fill in a moment later.
export default function ChatLoading() {
  const bubble = "animate-pulse rounded-bubble bg-white/80 dark:bg-white/10";
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading chat">
      <div className="safe-top flex items-center gap-3 border-b border-brand-100 bg-white/70 px-3 pb-3 pt-3 dark:border-white/10 dark:bg-[#1b1630]/80">
        <div className="h-[42px] w-[42px] animate-pulse rounded-full bg-brand-100 dark:bg-white/10" />
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded-full bg-brand-100 dark:bg-white/10" />
          <div className="h-3 w-16 animate-pulse rounded-full bg-brand-50 dark:bg-white/5" />
        </div>
      </div>
      <div className="wp-hearts flex min-h-0 flex-1 flex-col justify-end gap-3 px-3 py-4 md:px-6">
        <div className={`${bubble} h-10 w-2/5`} />
        <div className={`${bubble} ml-auto h-14 w-1/2 !bg-brand-200/70 dark:!bg-brand-600/50`} />
        <div className={`${bubble} h-10 w-1/3`} />
        <div className={`${bubble} ml-auto h-10 w-2/5 !bg-brand-200/70 dark:!bg-brand-600/50`} />
      </div>
      <div className="safe-bottom border-t border-brand-100 bg-white/70 px-3 pt-3 dark:border-white/10 dark:bg-[#1b1630]/80">
        <div className="mb-3 h-[46px] animate-pulse rounded-3xl bg-white dark:bg-white/10" />
      </div>
    </div>
  );
}
