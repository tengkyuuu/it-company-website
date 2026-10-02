import PostForm from "@/components/admin/PostForm";
import { BackLink } from "@/components/admin/CatalogParts";
import { getTeam, manilaToday } from "@/lib/cms";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";

export const metadata = { title: "New post", robots: { index: false } };

export default async function NewPostPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  // byline options — falls back to the built-in roster, so never empty
  const team = await getTeam();

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/admin/blog">Blog</BackLink>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">New post</h1>
        <p className="mt-1 text-sm text-ink/55">
          Save it as a draft first — it only appears on the blog once published.
        </p>
      </header>
      <PostForm roster={team.map((m) => m.name)} today={manilaToday()} />
    </div>
  );
}
