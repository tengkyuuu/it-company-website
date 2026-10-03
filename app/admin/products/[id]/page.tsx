import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import HistoryPanel from "@/components/admin/HistoryPanel";
import { BackLink, UpdatedAt } from "@/components/admin/CatalogParts";
import { Pill } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type ProductRow } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";
import { describeDbError, isUuid } from "../../_lib/server";

export const metadata = { title: "Edit product", robots: { index: false } };

export default async function EditProductPage({
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
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

  // a database failure is NOT "not found" — let the error boundary offer a retry
  if (error) throw new Error(describeDbError(error));
  if (!data) notFound();

  const product = data as ProductRow;

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/admin/products">Products</BackLink>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{product.name}</h1>
          <Pill tone={product.published ? "live" : "draft"}>
            {product.published ? "Published" : "Draft"}
          </Pill>
        </div>
        <UpdatedAt iso={product.updated_at} />
      </header>
      {/* keyed by id so moving between products never carries one's edits into the next */}
      <ProductForm key={product.id} product={product} justCreated={created === "1"} />
      <HistoryPanel entityType="products" entityId={product.id} noun="product" />
    </div>
  );
}
