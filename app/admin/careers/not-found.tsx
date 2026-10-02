import { SectionNotFound } from "@/components/admin/CatalogParts";

/** A role deleted in another tab, or a mistyped id. */
export default function JobNotFound() {
  return <SectionNotFound href="/admin/careers" label="All roles" />;
}
