"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function choose(next: boolean) {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("usie-theme", next ? "dark" : "light");
    } catch {}
  }

  const base = "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition";
  const on = "bg-brand-500 text-white shadow-soft";
  const off = "text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10";

  return (
    <div className="flex gap-2 rounded-2xl bg-brand-50 p-1.5 dark:bg-white/5" role="group" aria-label="Theme">
      <button type="button" onClick={() => choose(false)} aria-pressed={!dark} className={`${base} ${!dark ? on : off}`}>
        <Sun size={17} /> Light
      </button>
      <button type="button" onClick={() => choose(true)} aria-pressed={dark} className={`${base} ${dark ? on : off}`}>
        <Moon size={17} /> Dark
      </button>
    </div>
  );
}
