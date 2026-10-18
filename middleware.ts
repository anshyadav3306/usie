import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Pass the verified user id to pages. A copy sent by a visitor is always thrown away first.
  const forwarded = new Headers(request.headers);
  forwarded.delete("x-usie-user");
  if (user) forwarded.set("x-usie-user", user.id);
  const withUser = () => {
    const next = NextResponse.next({ request: { headers: forwarded } });
    response.cookies.getAll().forEach((c) => next.cookies.set(c));
    return next;
  };

  // The database webhook has no browser session; it proves itself with a secret header instead.
  if (path.startsWith("/api/push/notify") || path.startsWith("/api/cron/")) return withUser();
  // Email links (password reset) must work whether or not someone is signed in.
  if (path.startsWith("/auth/")) return withUser();
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/forgot-password");

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/chats";
    return NextResponse.redirect(url);
  }
  return withUser();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|webp|ico|js|html|webmanifest)$).*)"],
};
