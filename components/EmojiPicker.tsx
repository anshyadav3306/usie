"use client";

const EMOJI = [
  "😀","😄","😁","😂","🥹","😊","😍","🥰","😘","😉","😎","🤗","🤭","😴","😅","😭","😢","😮","😡","🥺",
  "❤️","🧡","💛","💚","💙","💜","🩷","💕","💖","💞","💗","💘","💌","💋","💍","🫶","🫂","🥳","😇","🤔",
  "😬","🙈","😏","😋","🤤","✨","🌸","🌷","🌹","🌙","⭐","☀️","🌈","🔥","👍","👏","🙌","🙏","💪","🤝",
  "👋","🎉","🎂","🎁","🍕","🍫","🍦","☕","🍓","🐶","🐱","🐻","🦋","🏡","✈️","📸","🎵","🌃",
];

export default function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Emoji"
        className="absolute bottom-full left-3 z-40 mb-2 w-[min(320px,calc(100vw-1.5rem))] rounded-3xl border border-brand-100 bg-white p-3 shadow-soft dark:border-white/10 dark:bg-[#241d3d]"
      >
        <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onPick(e)}
              className="grid h-9 w-9 place-items-center rounded-xl text-xl hover:bg-brand-50 dark:hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
