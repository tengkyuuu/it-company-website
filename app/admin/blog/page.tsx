import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type PostRow } from "@/lib/supabase/types";
import { Card, Notice, Pill } from "@/components/admin/ui";
import CatalogRowActions from "@/components/admin/CatalogRowActions";
import SetupNotice from "@/components/admin/SetupNotice";
import RecentlyDeleted from "@/components/admin/RecentlyDeleted";
import { loadRecentlyDeleted } from "../_lib/history";
import { describeDbError, isMissingTable } from "../_lib/server";
import { formatDay, manilaDate } from "../_lib/catalog";

export const metadata = { title: "Blog", robots: { index: false } };

const primaryLink =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/**
 * Blog posts, in the order the public index shows them: newest published
 * first, drafts (never published) after. No manual reordering — a post's
 * place is its date.
 */
export default async function AdminBlogPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const [{ data, error }, deleted] = await Promise.all([
    supabase
      .from("posts")
      .select("id, slug, title, cover_image, author_name, tags, published, published_at, updated_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    loadRecentlyDeleted("posts"),
  ]);

  const posts = (data ?? []) as Pick<
    PostRow,
    | "id"
    | "slug"
    | "title"
    | "cover_image"
    | "author_name"
    | "tags"
    | "published"
    | "published_at"
    | "updated_at"
  >[];
  const published = posts.filter((p) => p.published).length;
  const drafts = posts.length - published;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="mt-1 text-sm text-ink/55">
            {posts.length
              ? `${posts.length} post${posts.length === 1 ? "" : "s"} · ${published} published · ${drafts} draft${drafts === 1 ? "" : "s"}`
              : "Notes, launches and lessons from the studio."}
          </p>
        </div>
        {!error && posts.length > 0 && (
          <Link href="/admin/blog/new" className={primaryLink}>
            New post
          </Link>
        )}
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="The posts table isn't set up yet">
            Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code> in the
            Supabase SQL editor (it's safe to run twice), then reload.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load posts">
            {describeDbError(error)} The public site is unaffected — it simply shows no posts.
          </Notice>
        ))}

      {!error && posts.length === 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold tracking-tight">Write your first post</h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink/60">
            Posts are written in Markdown and can sit as drafts as long as you like. There’s no
            Blog page or nav link on the site until one is published.
          </p>
          <div className="mt-5">
            <Link href="/admin/blog/new" className={primaryLink}>
              Write a post
            </Link>
          </div>
        </Card>
      )}

      {!error && posts.length > 0 && published === 0 && (
        <Notice tone="warn" title="Nothing is published">
          The Blog page and its nav link stay hidden until at least one post is published.
        </Notice>
      )}

      {posts.length > 0 && (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div
                    aria-hidden
                    className="hidden h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-mist/70 bg-ink/[0.06] sm:block"
                  >
                    {p.cover_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.cover_image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/blog/${p.id}`}
                        className="truncate font-medium transition-colors hover:text-accent"
                      >
                        {p.title}
                      </Link>
                      <Pill tone={p.published ? "live" : "draft"}>
                        {p.published ? "Published" : "Draft"}
                      </Pill>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-slatey">
                      {[
                        `/blog/${p.slug}`,
                        p.published_at
                          ? formatDay(manilaDate(p.published_at))
                          : "not published yet",
                        p.author_name || null,
                        p.tags?.length ? p.tags.join(", ") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <CatalogRowActions
                    kind="post"
                    id={p.id}
                    name={p.title}
                    slug={p.slug}
                    published={p.published}
                    viewable={p.published}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!error && <RecentlyDeleted items={deleted} noun="post" />}
    </div>
  );
}
