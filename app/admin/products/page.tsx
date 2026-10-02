import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type ProductRow } from "@/lib/supabase/types";
import { Card, Notice, Pill } from "@/components/admin/ui";
import CatalogRowActions from "@/components/admin/CatalogRowActions";
import SetupNotice from "@/components/admin/SetupNotice";
import { describeDbError, isMissingTable } from "../_lib/server";

export const metadata = { title: "Products", robots: { index: false } };

const primaryLink =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/**
 * The studio's own products (client work lives under Projects). Unlike
 * projects there's no built-in list to fall back to: until something is
 * published, /products shows nothing and its nav link stays hidden.
 */
export default async function AdminProductsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, tagline, status, image, published, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const products = (data ?? []) as Pick<
    ProductRow,
    "id" | "slug" | "name" | "tagline" | "status" | "image" | "published" | "sort_order"
  >[];
  const published = products.filter((p) => p.published).length;
  const drafts = products.length - published;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-ink/55">
            {products.length
              ? `${products.length} in the database · ${published} published · ${drafts} draft${drafts === 1 ? "" : "s"}`
              : "The studio's own products — not client work."}
          </p>
        </div>
        {!error && products.length > 0 && (
          <Link href="/admin/products/new" className={primaryLink}>
            New product
          </Link>
        )}
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="The products table isn't set up yet">
            Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code> in the
            Supabase SQL editor (it's safe to run twice), then reload.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load products">
            {describeDbError(error)} The public site is unaffected — it simply shows no products.
          </Notice>
        ))}

      {!error && products.length === 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Add your first product
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink/60">
            Something the studio builds and offers itself. Nothing shows on the public site —
            no Products page, no nav link — until at least one product is published.
          </p>
          <div className="mt-5">
            <Link href="/admin/products/new" className={primaryLink}>
              Add a product
            </Link>
          </div>
        </Card>
      )}

      {!error && products.length > 0 && published === 0 && (
        <Notice tone="warn" title="Nothing is published">
          The Products page and its nav link stay hidden until at least one product is
          published.
        </Notice>
      )}

      {products.length > 0 && (
        <ol className="space-y-3">
          {products.map((p, i) => (
            <li key={p.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div
                    aria-hidden
                    className="hidden h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-mist/70 bg-ink/[0.06] sm:block"
                  >
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover object-top"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="truncate font-medium transition-colors hover:text-accent"
                      >
                        {p.name}
                      </Link>
                      <Pill tone={p.published ? "live" : "draft"}>
                        {p.published ? "Published" : "Draft"}
                      </Pill>
                      {p.status && <Pill>{p.status}</Pill>}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-slatey">
                      /products/{p.slug}
                      {p.tagline ? ` · ${p.tagline}` : ""}
                    </p>
                  </div>

                  <CatalogRowActions
                    kind="product"
                    id={p.id}
                    name={p.name}
                    slug={p.slug}
                    published={p.published}
                    viewable={p.published}
                    isFirst={i === 0}
                    isLast={i === products.length - 1}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
