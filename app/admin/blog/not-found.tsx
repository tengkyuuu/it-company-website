import { SectionNotFound } from "@/components/admin/CatalogParts";

/** A post deleted in another tab, or a mistyped id. */
export default function PostNotFound() {
  return <SectionNotFound href="/admin/blog" label="All posts" />;
}
