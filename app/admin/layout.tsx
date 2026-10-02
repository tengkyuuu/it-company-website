import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import AdminNav from "@/components/admin/AdminNav";
import SetupNotice from "@/components/admin/SetupNotice";
import { signOut } from "./actions";
import { headers } from "next/headers";
import AuthNoAccess from "@/components/admin/AuthNoAccess";
import { getAccess } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Admin",
  // keep the panel out of search results and out of the sitemap
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  // /admin/auth/* (the invite / reset link landing) renders bare and does its
  // own gating: an invitee has no account at all until they submit that form.
  // The header is stamped by middleware.ts on every /admin request.
  const pathname = (await headers()).get("x-admin-pathname") ?? "";
  if (pathname.startsWith("/admin/auth/")) return <>{children}</>;

  const access = await getAccess();

  // Signed out (i.e. the login screen) — render it bare, no shell.
  if (access.state === "signed-out") return <>{children}</>;
  // Signed in, but not let in: no profile, disabled, or a revoked session.
  if (access.state === "no-access") {
    return <AuthNoAccess email={access.email} reason={access.reason} error={access.error} />;
  }
  const profile = access.profile;

  return (
    <div className="min-h-screen overflow-x-clip bg-paper">
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-sm text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-mist/70 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3.5 sm:gap-4">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
          >
            <Logo label="R Ally's Tech — admin home" className="h-[22px]" />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-slatey sm:inline">
              Admin
            </span>
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded text-sm text-ink/60 transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 sm:inline"
            >
              View site ↗
            </a>
            <ThemeToggle />
            <div className="hidden min-w-0 text-right md:block">
              <p className="max-w-[14rem] truncate text-sm leading-tight">
                {profile.full_name || profile.email}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slatey">
                {profile.role}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-full border border-mist/70 px-3.5 py-1.5 text-xs transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* minmax(0,1fr): an auto/1fr track grows to its widest child, which let
          the mobile tab strip push the page into horizontal scroll at 390px */}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 md:py-12">
        <aside className="min-w-0 md:sticky md:top-24 md:self-start">
          <AdminNav />
        </aside>
        <main id="admin-main" tabIndex={-1} className="min-w-0 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
