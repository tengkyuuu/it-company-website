import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveLocaleRoute } from "@/lib/i18n/route";

/**
 * Two unrelated jobs, split by path:
 *
 * PUBLIC pages — locale routing, PATH-ONLY. No database, no cookies, no
 * headers read; the decision lives in lib/i18n/route.ts (unit-tested):
 *   /fil, /fil/*  → served as-is
 *   /en, /en/*    → 308 to the unprefixed URL (one canonical English address)
 *   anything else → rewritten to /en/… (the URL bar keeps /projects)
 * No Accept-Language redirect: it can't be cached and hides pages from crawlers.
 *
 * /admin/** ONLY — the Supabase session:
 *  1. refresh the Supabase auth cookie (server components can't write cookies,
 *     so this is the only place the session gets renewed);
 *  2. gate the panel behind a session, bouncing to /admin/login with a ?next.
 *
 * ⚠️ Keep every Supabase call inside the admin branch. Nothing public reads the
 * session, and getUser() is a network round-trip to Supabase for anyone holding
 * a session cookie — running it on marketing pages made every page view by a
 * signed-in teammate wait on it (and, with the project unreachable, on
 * auth-js's retries too). That's why the matcher used to be /admin only; it is
 * wider now purely for the path-only locale logic.
 *
 * If the Supabase env vars are absent the panel is simply not wired up yet, so
 * we let the request through — /admin/login renders setup instructions instead
 * of the site 500ing.
 */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return adminMiddleware(request);
  }

  const route = resolveLocaleRoute(pathname);
  switch (route.action) {
    case "redirect": {
      const url = request.nextUrl.clone();
      url.pathname = route.to;
      return NextResponse.redirect(url, 308);
    }
    case "rewrite": {
      const url = request.nextUrl.clone();
      url.pathname = route.to;
      return NextResponse.rewrite(url);
    }
    default:
      return NextResponse.next();
  }
}

async function adminMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  // Layouts aren't told their pathname, but the admin layout has to render
  // /admin/auth/* (the invite / reset link page) bare — outside the panel shell
  // and its access gate. Always overwritten here, so a client can't spoof it.
  // It rides on `request`, which every NextResponse.next({ request }) below
  // forwards.
  request.headers.set("x-admin-pathname", pathname);

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

  if (!user && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
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
    // the panel — `:path*` is zero-or-more segments, so /admin itself too
    "/admin/:path*",
    "/",
    // public pages: everything except API routes, Next/Vercel internals and
    // anything with a file extension (public/ assets, /robots.txt,
    // /sitemap.xml, /icon.png). Extension-less metadata routes such as
    // /opengraph-image still pass through here and are skipped in code.
    "/((?!api/|api$|_next|__next|_vercel|.*\\..*).*)",
  ],
};
