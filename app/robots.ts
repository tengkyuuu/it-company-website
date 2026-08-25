import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // the admin panel is noindex'd via metadata too; keep it out of crawls
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/admin/"] },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
