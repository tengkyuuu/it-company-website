"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePost } from "@/app/admin/catalog-actions";
import { MAX_POST_TAGS, PUBLIC_PATH, manilaDate } from "@/app/admin/_lib/catalog";
import type { PostRow } from "@/lib/supabase/types";
import ImageField from "./ImageField";
import { SaveBar, SlugField, useAutoSlug } from "./CatalogFormParts";
import { useAutosave } from "./useAutosave";
import {
  Card,
  CardTitle,
  Field,
  Input,
  Label,
  Select,
  Textarea,
  Toggle,
  useFormAction,
} from "./ui";

// a sentinel no roster name will ever be (it never reaches the server)
const SOMEONE_ELSE = "__someone-else__";

/**
 * Byline: pick someone from the public roster (Admin → Roster), or type a
 * name — a guest author, or someone who isn't on the site. The resolved name
 * is what submits, in one hidden `author_name` field — which changes without
 * an input event of its own, hence `onValueChange` (autosave's markDirty).
 */
function AuthorField({
  roster,
  saved,
  error,
  onValueChange,
}: {
  roster: string[];
  saved: string;
  error?: string;
  onValueChange?: () => void;
}) {
  const known = saved === "" || roster.includes(saved);
  const [choice, setChoice] = useState(known ? saved : SOMEONE_ELSE);
  const [other, setOther] = useState(known ? "" : saved);
  const value = choice === SOMEONE_ELSE ? other.trim() : choice;

  return (
    <div className="space-y-4">
      <Field
        label="Author"
        hint={roster.length ? "From the public roster." : "The roster is empty — type a name instead."}
        error={choice === SOMEONE_ELSE ? undefined : error}
      >
        <Select
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            onValueChange?.();
          }}
        >
          <option value="">No byline</option>
          {roster.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={SOMEONE_ELSE}>Someone else…</option>
        </Select>
      </Field>
      {choice === SOMEONE_ELSE && (
        <Field label="Author name" error={error}>
          <Input
            value={other}
            onChange={(e) => {
              setOther(e.target.value);
              onValueChange?.();
            }}
            maxLength={120}
            placeholder="Full name"
          />
        </Field>
      )}
      <input type="hidden" name="author_name" value={value} />
    </div>
  );
}

/** A blog post. The body is markdown, rendered on the server by the public page. */
export default function PostForm({
  post,
  roster,
  today,
  justCreated = false,
}: {
  post?: PostRow;
  /** public roster names, for the byline picker */
  roster: string[];
  /** today in Manila ('YYYY-MM-DD') from the server — the date picker's max */
  today: string;
  justCreated?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(0);
  const slug = useAutoSlug(post?.slug);

  // the action reaches `autosave` through a closure — it only runs on submit
  const { result, pending, formProps } = useFormAction((fd) => autosave.wrapSave(savePost)(fd), {
    onSuccess: (r) => {
      if (!post && r.id) router.replace(`/admin/blog/${r.id}?created=1`);
    },
  });
  // an existing post's fields autosave as you type; slug / visibility need Save
  const autosave = useAutosave(formProps.ref, {
    entity: "posts",
    id: post?.id,
    updatedAt: post?.updated_at,
    paused: uploading > 0,
  });
  const fieldError = autosave.fieldError;

  const onBusy = (busy: boolean) => setUploading((n) => Math.max(0, n + (busy ? 1 : -1)));
  const shown =
    result ??
    (justCreated
      ? { ok: true, message: "Post created. Keep writing, or publish it when it's ready." }
      : null);

  return (
    <form {...formProps} className="space-y-6">
      <Card>
        <CardTitle hint="The excerpt shows on the blog index and in link previews.">
          The post
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" error={fieldError("title")}>
            <Input
              name="title"
              required
              maxLength={160}
              defaultValue={post?.title ?? ""}
              onChange={(e) => slug.follow(e.target.value)}
            />
          </Field>

          <SlugField
            slug={slug.slug}
            onEdit={slug.edit}
            base={PUBLIC_PATH.post}
            saved={post?.slug}
            published={post?.published}
            placeholder="post-title"
            error={fieldError("slug")}
          />

          <Field
            label="Excerpt"
            hint="One or two sentences that make someone want to read on."
            className="sm:col-span-2"
            error={fieldError("excerpt")}
          >
            <Textarea
              name="excerpt"
              rows={2}
              maxLength={400}
              defaultValue={post?.excerpt ?? ""}
            />
          </Field>

          <Field
            label="Body"
            hint="Markdown: **bold**, *italic*, ## headings, - lists, [links](https://…)"
            className="sm:col-span-2"
            error={fieldError("body")}
          >
            <Textarea
              name="body"
              rows={22}
              maxLength={60000}
              defaultValue={post?.body ?? ""}
              spellCheck
              className="font-mono text-[13px]"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Heads the post and its card on the index.">Cover image</CardTitle>
        <div className="max-w-xl">
          <ImageField
            name="cover_image"
            label="Cover image (optional)"
            defaultValue={post?.cover_image}
            error={fieldError("cover_image")}
            onBusyChange={onBusy}
            onValueChange={() => autosave.markDirty("cover_image")}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Byline &amp; tags</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthorField
            roster={roster}
            saved={post?.author_name ?? ""}
            error={fieldError("author_name")}
            onValueChange={() => autosave.markDirty("author_name")}
          />
          <Field
            label="Tags"
            hint={`One per line or comma-separated — up to ${MAX_POST_TAGS}.`}
            error={fieldError("tags")}
          >
            <Textarea
              name="tags"
              rows={3}
              defaultValue={(post?.tags ?? []).join(", ")}
              placeholder="Design, Engineering"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Publishing</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Visibility</Label>
            <Toggle name="published" defaultChecked={post?.published ?? false}>
              Published — visible on the blog
            </Toggle>
          </div>
          <Field
            label="Publish date (optional)"
            hint="Leave blank and it's stamped the moment the post is first published. Set it to backdate a post."
            error={fieldError("published_at")}
          >
            <Input
              name="published_at"
              type="date"
              max={today}
              defaultValue={manilaDate(post?.published_at)}
            />
          </Field>
        </div>
      </Card>

      <input type="hidden" name="id" value={post?.id ?? ""} />
      <input {...autosave.tokenInputProps} />

      <SaveBar
        result={shown}
        pending={pending}
        uploading={uploading}
        autosave={autosave}
        isNew={!post}
        noun="post"
        backHref="/admin/blog"
        viewHref={post?.published ? `${PUBLIC_PATH.post}/${post.slug}` : undefined}
      />
    </form>
  );
}
