import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import AdminNav from "@/components/admin/AdminNav";
import SetupNotice from "@/components/admin/SetupNotice";
import { signOut } from "./actions";
import { getProfile } from "@/lib/supabase/server";
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

  const profile = await getProfile();

  // Signed out (i.e. the login screen) — render it bare, no shell.
  if (!profile) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-mist/70 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3.5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Logo label="mykTech() — admin home" className="h-[22px]" />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-slatey sm:inline">
              Admin
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="hidden text-sm text-ink/60 transition-colors hover:text-ink sm:inline"
            >
              View site ↗
            </Link>
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight">
                {profile.full_name || profile.email}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slatey">
                {profile.role}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-mist/70 px-3.5 py-1.5 text-xs transition-colors hover:border-mist"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:grid-cols-[200px_1fr] md:gap-10 md:py-12">
        <aside className="md:sticky md:top-24 md:self-start">
          <AdminNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
