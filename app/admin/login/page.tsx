import Link from "next/link";
import Logo from "@/components/Logo";
import LoginForm from "@/components/admin/LoginForm";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // only allow internal redirects — never bounce to an attacker's URL
  const target = next && next.startsWith("/admin") ? next : "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block">
          <Logo label="mykTech() — back to the site" className="h-[26px]" />
        </Link>
        <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight">
          Sign in to the panel
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          Manage projects, the team and the site’s content.
        </p>

        <div className="mt-8 rounded-2xl border border-mist/70 bg-surface p-6">
          <LoginForm next={target} />
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-sm text-ink/50 transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> Back to the site
        </Link>
      </div>
    </div>
  );
}
