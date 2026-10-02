import ProductForm from "@/components/admin/ProductForm";
import { BackLink } from "@/components/admin/CatalogParts";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";

export const metadata = { title: "New product", robots: { index: false } };

export default function NewProductPage() {
  // the layout shows the setup notice too; this keeps the page from rendering
  // a form that could never save
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/admin/products">Products</BackLink>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-ink/55">
          Save it as a draft first — it only appears on the site once published.
        </p>
      </header>
      <ProductForm />
    </div>
  );
}
