import type { Metadata } from "next";
import Link from "next/link";
import DocumentShell from "@/components/DocumentShell";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import AdminNav from "@/components/admin/AdminNav";
import SetupNotice from "@/components/admin/SetupNotice";
import { signOut } from "./actions";
import { headers } from "next/headers";
import AuthNoAccess from "@/components/admin/AuthNoAccess";
import { getAccess } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  // This is a ROOT layout now (there's no app/layout.tsx — the public site's
  // root is app/[lang]/layout.tsx), so it carries what it used to inherit: the
  // base URL and the "· MykTech" title template.
  metadataBase: new URL(site.url),
  title: { default: "Admin · MykTech", template: "%s · MykTech" },
  // keep the panel out of search results and out of the sitemap
  robots: { index: false, follow: false },
};

/**
 * Root layout of the admin panel: English-only, and none of the marketing
 * chrome (no SiteChrome, preloader, Lenis or chat). The <html>/<body>, fonts,
 * theme script and analytics come from DocumentShell, shared with the public
 * root layout so the two can't drift.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocumentShell lang="en">
      <div className="admin-shell">
        <AdminLayout>{children}</AdminLayout>
      </div>
    </DocumentShell>
  );
}

async function AdminLayout({
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

      <header className="sticky top-0 z-30 border-b border-mist bg-paper">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3.5 sm:gap-4">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-3 rounded-lg"
          >
            <Logo accent label="MykTech() — admin home" className="w-44" />
            <span className="hidden border border-mist px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slatey sm:inline">
              Admin
            </span>
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded text-sm text-ink/60 transition-colors hover:text-ink sm:inline"
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
                className="whitespace-nowrap rounded-full border border-mist px-3.5 py-1.5 text-xs transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-paper"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* minmax(0,1fr): an auto/1fr track grows to its widest child, which let
          the mobile tab strip push the page into horizontal scroll at 390px */}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 md:grid-cols-[216px_minmax(0,1fr)] md:gap-12 md:py-12">
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
