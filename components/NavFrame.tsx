"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, MessageCircle, Search, Settings } from "lucide-react";
import HeartLogo from "./HeartLogo";

const items = [
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/us", label: "Us", icon: Heart },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function NavFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inChat = /^\/chats\/[^/]+/.test(pathname);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <nav className="safe-top hidden w-[76px] shrink-0 flex-col items-center gap-2 border-r border-brand-100 bg-white/50 py-5 backdrop-blur dark:border-white/10 dark:bg-black/20 md:flex">
        <HeartLogo size={44} />
        <div className="mt-6 flex flex-col gap-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`grid h-12 w-12 place-items-center rounded-2xl transition ${
                  active
                    ? "bg-brand-100 text-brand-600 dark:bg-brand-600/30 dark:text-brand-200"
                    : "text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10"
                }`}
              >
                <Icon size={22} />
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">{children}</div>
        {!inChat && (
          <nav className="safe-bottom flex border-t border-brand-100 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#1b1630]/90 md:hidden">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold ${
                    active ? "text-brand-600 dark:text-brand-200" : "text-ink-muted"
                  }`}
                >
                  <Icon size={22} />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
