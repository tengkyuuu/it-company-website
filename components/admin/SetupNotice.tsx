import Link from "next/link";

/** Shown across the panel when the Supabase env vars aren't set yet. */
export default function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-slatey">
        Admin · setup
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl">
        Connect a database to switch the panel on.
      </h1>
      <p className="mt-4 leading-relaxed text-ink/65">
        The public site is running happily on the static content in{" "}
        <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[13px]">
          lib/work.ts
        </code>
        . Three environment variables turn this panel into a live CMS — nothing
        else needs to change.
      </p>

      <ol className="mt-8 space-y-5">
        {[
          {
            title: "Create a free Supabase project",
            body: (
              <>
                Go to{" "}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-dotted underline-offset-4"
                >
                  supabase.com/dashboard
                </a>{" "}
                and create a project.
              </>
            ),
          },
          {
            title: "Run the schema",
            body: (
              <>
                Open the SQL editor and run{" "}
                <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[13px]">
                  supabase/schema.sql
                </code>{" "}
                from this repo. It creates the tables, row-level security and the
                storage bucket for screenshots.
              </>
            ),
          },
          {
            title: "Add the keys",
            body: (
              <>
                Copy them from Project Settings → API into{" "}
                <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[13px]">
                  .env.local
                </code>{" "}
                (and Vercel):
                <pre className="mt-3 overflow-x-auto rounded-xl border border-mist/70 bg-paper p-4 font-mono text-xs leading-relaxed">
                  {`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=`}
                </pre>
              </>
            ),
          },
          {
            title: "Sign up once",
            body: (
              <>
                Restart the dev server and create your account — the very first
                user becomes the <strong>owner</strong> and can invite everyone
                else from Team.
              </>
            ),
          },
        ].map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-mist/70 font-mono text-xs"
            >
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <div className="mt-1 text-sm leading-relaxed text-ink/65">
                {step.body}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-2 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> Back to the site
      </Link>
    </div>
  );
}
