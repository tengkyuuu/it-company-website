export type Project = {
  /** URL segment for /projects/[slug] */
  slug: string;
  name: string;
  category: string;
  /** the domain shown in the preview's browser chrome (a label, not a link) */
  url: string;
  /**
   * Absolute https URL of the deployed site. Setting this switches on the live
   * iframe preview and the "Open live site" links; leaving it undefined keeps
   * the (crisp) screenshot preview instead.
   *
   * Deliberately unset for now: as of 2026-08-03 none of the domains above
   * resolve — famecrm.app / physiopano.com / rallys-equities.com / coffee.shop
   * are NXDOMAIN and shm.app is a GoDaddy parked "for sale" page. Fill these in
   * as each project goes live; nothing else needs to change.
   */
  liveUrl?: string;
  year: string;
  /** one line, used on the index */
  summary: string;
  /** two or three sentences, used on the detail page */
  description: string;
  /** what is actually visible in the captures — no invented metrics */
  highlights: string[];
  img: string;
  /** optional secondary screenshot layered into the plate for depth */
  img2?: string;
  tags: string[];
  dots: [string, string, string]; // the project's 3 signature colors
};

export const projects: Project[] = [
  {
    slug: "famecrm",
    name: "FameCRM",
    category: "CRM Platform",
    url: "famecrm.app",
    year: "’25",
    summary:
      "The agency operating system — creators, trends and team in one place.",
    description:
      "A CRM built for creator agencies rather than sales teams. The marketing site sells a single promise — one platform to run the agency — and the product behind it puts creator tracking, trend discovery and team management on one dashboard. Seed usage, tracking links and per-account performance all surface on the landing view.",
    highlights: [
      "Marketing site + product in one system",
      "Creator and account dashboard",
      "Usage metering with plan tiers",
      "Viral rankings and tracking links",
    ],
    img: "/work/famecrm-landing.webp",
    img2: "/work/famecrm-dashboard.webp",
    tags: ["Web App", "SaaS", "Dashboard"],
    dots: ["#7c5cff", "#4f46e5", "#15131f"],
  },
  {
    slug: "physiopano",
    name: "PhysioPano",
    category: "Healthcare Platform",
    url: "physiopano.com",
    year: "’25",
    summary:
      "Wearable physiological monitoring that reads stress as it happens.",
    description:
      "A wearable system that fuses heart rate, skin conductance, skin temperature and motion, then uses machine learning to detect stress the moment it happens. We built the public site and the admin surface: live session capture, waveform visualisation and a stress index the clinician can read at a glance.",
    highlights: [
      "Live session capture and waveforms",
      "Multi-sensor fusion readout",
      "Clinician-facing admin",
      "Stress index visualisation",
    ],
    img: "/work/physiopano-admin-landing.webp",
    img2: "/work/physiopano-app.webp",
    tags: ["Web", "Admin", "Health"],
    dots: ["#22c55e", "#10b981", "#0b1f16"],
  },
  {
    slug: "shm-bridge-monitor",
    name: "SHM Bridge Monitor",
    category: "Structural Monitoring · IoT",
    url: "shm.app",
    year: "’24",
    summary:
      "Millimetre-scale bridge movement, streamed live from LoRa sensor nodes.",
    description:
      "Structural health monitoring for bridges. Deflection, velocity and acceleration stream in from LoRa sensor nodes and are visualised in real time, with alert classification the moment movement crosses a safe limit. The interface has to stay legible while several signals move at once — so the charts lead and the chrome gets out of the way.",
    highlights: [
      "Real-time multi-signal charting",
      "LoRa sensor node ingest",
      "Threshold alert classification",
      "Live simulation mode",
    ],
    img: "/work/shm-landing.webp",
    img2: "/work/shm-dashboard.webp",
    tags: ["Web App", "Real-time", "Dashboard"],
    dots: ["#3b82f6", "#60a5fa", "#0f1b2e"],
  },
  {
    slug: "rallys-equities",
    name: "Rally’s Equities",
    category: "Fintech · Equities",
    url: "rallys-equities.com",
    year: "’24",
    summary:
      "A regulated Pakistani brokerage, with the market moving on the homepage.",
    description:
      "A licensed TREC brokerage on the Pakistan Stock Exchange needed a site that earns trust in the first screen. A live ticker and the KSE-100 index sit above the fold beside the pitch, with per-company prices and movement below — so the market itself is the proof, not a claim about it.",
    highlights: [
      "Live market ticker",
      "KSE-100 index chart with ranges",
      "Per-company price and movement table",
      "Bilingual headline treatment",
    ],
    img: "/work/rallys-equities.png",
    tags: ["Web", "Finance", "Charts"],
    dots: ["#16a34a", "#eab308", "#0f1a14"],
  },
  {
    slug: "coffeeshop",
    name: "CoffeeShop",
    category: "Ordering Experience",
    url: "coffee.shop",
    year: "’24",
    summary: "Scan the QR on the table, order in seconds, skip the queue.",
    description:
      "QR-code ordering for cafés. The whole product is one idea — your next coffee is one scan away — so the site is built around it: warm photography, a short path to ordering, and a separate track for café owners who want it on their own tables.",
    highlights: [
      "QR-to-order customer flow",
      "Separate track for café owners",
      "Account and sign-in flow",
      "Warm editorial art direction",
    ],
    img: "/work/coffee-shop.png",
    img2: "/work/coffee-shop-login.png",
    tags: ["Web", "Ordering", "UX"],
    dots: ["#b45309", "#f59e0b", "#3b2417"],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/** previous / next for the detail page footer, wrapping around */
export function projectNeighbours(slug: string) {
  const i = projects.findIndex((p) => p.slug === slug);
  if (i < 0) return { prev: undefined, next: undefined };
  return {
    prev: projects[(i - 1 + projects.length) % projects.length],
    next: projects[(i + 1) % projects.length],
  };
}
