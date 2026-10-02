import { SectionNotFound } from "@/components/admin/CatalogParts";

/** A product deleted in another tab, or a mistyped id. */
export default function ProductNotFound() {
  return <SectionNotFound href="/admin/products" label="All products" />;
}
