import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Two jobs:
 *  1. refresh the Supabase auth cookie on every request (server components
 *     can't write cookies, so this is the only place the session gets renewed);
 *  2. gate /admin/** behind a session, bouncing to /admin/login with a ?next.
 *
 * If the Supabase env vars are absent the panel is simply not wired up yet, so
 * we let the request through — /admin/login renders setup instructions instead
 * of the site 500ing.
 */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith("/admin");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() (not getSession()) — it revalidates the token with Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAdmin && !user && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }

  // already signed in? skip the login screen
  if (user && pathname === "/admin/login") {
    const dash = request.nextUrl.clone();
    dash.pathname = "/admin";
    dash.search = "";
    return NextResponse.redirect(dash);
  }

  return response;
}

export const config = {
  matcher: [
    // everything except static assets, images and the public files
    "/((?!_next/static|_next/image|favicon.ico|brand/|work/|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|xml|txt)$).*)",
  ],
};
