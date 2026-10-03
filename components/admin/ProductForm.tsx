"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProduct } from "@/app/admin/catalog-actions";
import { MAX_FEATURES, MAX_PRODUCT_GALLERY, PUBLIC_PATH } from "@/app/admin/_lib/catalog";
import type { ProductRow } from "@/lib/supabase/types";
import ImageField from "./ImageField";
import { GalleryEditor } from "./ProjectCaseStudy";
import { SaveBar, SlugField, useAutoSlug } from "./CatalogFormParts";
import { useAutosave } from "./useAutosave";
import {
  Card,
  CardTitle,
  Field,
  Input,
  Label,
  Textarea,
  Toggle,
  useFormAction,
} from "./ui";

/**
 * One of the studio's OWN products (client work is a project). Mirrors
 * ProjectForm: submits through useFormAction so a failed save keeps every
 * field, autosaves an existing product's fields as you type (useAutosave —
 * slug, visibility and order still need Save), holds saves while an image is
 * uploading, and warns before leaving only while something is unsaved.
 */
export default function ProductForm({
  product,
  justCreated = false,
}: {
  product?: ProductRow;
  /** arrived here straight from the create form */
  justCreated?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(0);
  const slug = useAutoSlug(product?.slug);

  // the action reaches `autosave` through a closure — it only runs on submit,
  // long after both hooks exist
  const { result, pending, formProps } = useFormAction((fd) => autosave.wrapSave(saveProduct)(fd), {
    onSuccess: (r) => {
      // a create lands on the edit page, so a second click can't insert a
      // duplicate and the URL now points at something real
      if (!product && r.id) router.replace(`/admin/products/${r.id}?created=1`);
    },
  });
  const autosave = useAutosave(formProps.ref, {
    entity: "products",
    id: product?.id,
    updatedAt: product?.updated_at,
    paused: uploading > 0,
  });
  const fieldError = autosave.fieldError;

  const onBusy = (busy: boolean) => setUploading((n) => Math.max(0, n + (busy ? 1 : -1)));
  const shown =
    result ??
    (justCreated
      ? { ok: true, message: "Product created. Keep editing, or publish it when it's ready." }
      : null);

  return (
    <form {...formProps} className="space-y-6">
      <Card>
        <CardTitle hint="How the product is introduced on /products and its own page.">
          The basics
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" error={fieldError("name")}>
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={product?.name ?? ""}
              onChange={(e) => slug.follow(e.target.value)}
            />
          </Field>

          <SlugField
            slug={slug.slug}
            onEdit={slug.edit}
            base={PUBLIC_PATH.product}
            saved={product?.slug}
            published={product?.published}
            placeholder="product-name"
            error={fieldError("slug")}
          />

          <Field
            label="Tagline"
            hint="A short line under the name."
            error={fieldError("tagline")}
          >
            <Input name="tagline" maxLength={160} defaultValue={product?.tagline ?? ""} />
          </Field>

          <Field
            label="Status badge (optional)"
            hint="A word or two shown as a chip, e.g. “Beta”, “Coming soon”. Blank shows nothing."
            error={fieldError("status")}
          >
            <Input name="status" maxLength={40} defaultValue={product?.status ?? ""} />
          </Field>

          <Field
            label="Summary"
            hint="One or two lines, used on the index."
            className="sm:col-span-2"
            error={fieldError("summary")}
          >
            <Input name="summary" maxLength={400} defaultValue={product?.summary ?? ""} />
          </Field>

          <Field
            label="Description"
            hint="What it is, who it's for, and why it exists. Leave a blank line between paragraphs."
            className="sm:col-span-2"
            error={fieldError("description")}
          >
            <Textarea
              name="description"
              rows={7}
              maxLength={6000}
              defaultValue={product?.description ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint={`One per line — commas stay part of the text. Up to ${MAX_FEATURES}; duplicates are dropped.`}>
          Features
        </CardTitle>
        <Field label="Features" error={fieldError("features")}>
          <Textarea
            name="features"
            rows={6}
            defaultValue={(product?.features ?? []).join("\n")}
          />
        </Field>
      </Card>

      <Card>
        <CardTitle hint="The product page's main button. Fill in both, or leave both blank for no button.">
          Call to action
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
          <Field label="Button label" error={fieldError("cta_label")}>
            <Input
              name="cta_label"
              maxLength={40}
              defaultValue={product?.cta_label ?? ""}
              placeholder="Try it free"
            />
          </Field>
          <Field
            label="Button link"
            hint="A full https:// address, or a page on this site like /contact. Check an external link actually loads."
            error={fieldError("cta_url")}
          >
            <Input
              name="cta_url"
              maxLength={500}
              defaultValue={product?.cta_url ?? ""}
              placeholder="https://… or /contact"
              spellCheck={false}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Heads the product page and its card on the index.">Main image</CardTitle>
        <div className="max-w-xl">
          <ImageField
            name="image"
            label="Main image"
            defaultValue={product?.image}
            hint="Capture at 1536px wide or more — the site never upscales."
            error={fieldError("image")}
            onBusyChange={onBusy}
            onValueChange={() => autosave.markDirty("image")}
          />
        </div>
      </Card>

      <Card>
        <CardTitle hint="More screens for the product page, in this order. Mobile captures get a phone-shaped frame.">
          Gallery
        </CardTitle>
        <GalleryEditor
          initial={product?.gallery ?? []}
          max={MAX_PRODUCT_GALLERY}
          error={fieldError("gallery")}
          onChange={() => autosave.markDirty("gallery_src")}
          onBusyChange={onBusy}
        />
      </Card>

      <Card>
        <CardTitle>Publishing</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Visibility</Label>
            <Toggle name="published" defaultChecked={product?.published ?? false}>
              Published — visible on the public site
            </Toggle>
          </div>
          {product ? (
            <Field label="Sort order" hint="Lower numbers come first." error={fieldError("sort_order")}>
              <Input
                name="sort_order"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                step={1}
                defaultValue={product.sort_order}
              />
            </Field>
          ) : (
            <p className="self-end text-sm leading-relaxed text-ink/55">
              New products go to the end of the list — reorder them from the Products page.
            </p>
          )}
        </div>
      </Card>

      <input type="hidden" name="id" value={product?.id ?? ""} />
      <input {...autosave.tokenInputProps} />

      <SaveBar
        result={shown}
        pending={pending}
        uploading={uploading}
        autosave={autosave}
        isNew={!product}
        noun="product"
        backHref="/admin/products"
        viewHref={product?.published ? `${PUBLIC_PATH.product}/${product.slug}` : undefined}
      />
    </form>
  );
}
