import { notFound } from "next/navigation";
import PostForm from "@/components/admin/PostForm";
import { BackLink, UpdatedAt } from "@/components/admin/CatalogParts";
import { Pill } from "@/components/admin/ui";
import { getTeam, manilaToday } from "@/lib/cms";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type PostRow } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";
import { describeDbError, isUuid } from "../../_lib/server";

export const metadata = { title: "Edit post", robots: { index: false } };

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const [{ id }, { created }] = await Promise.all([params, searchParams]);

  // a malformed id is a 404, not a Postgres "invalid input syntax for uuid"
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data, error }, team] = await Promise.all([
    supabase.from("posts").select("*").eq("id", id).maybeSingle(),
    // byline options — falls back to the built-in roster, so never empty
    getTeam(),
  ]);

  // a database failure is NOT "not found" — let the error boundary offer a retry
  if (error) throw new Error(describeDbError(error));
  if (!data) notFound();

  const post = data as PostRow;

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/admin/blog">Blog</BackLink>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{post.title}</h1>
          <Pill tone={post.published ? "live" : "draft"}>
            {post.published ? "Published" : "Draft"}
          </Pill>
        </div>
        <UpdatedAt iso={post.updated_at} />
      </header>
      {/* keyed by id so moving between posts never carries one's edits into the next */}
      <PostForm
        key={post.id}
        post={post}
        roster={team.map((m) => m.name)}
        today={manilaToday()}
        justCreated={created === "1"}
      />
    </div>
  );
}
