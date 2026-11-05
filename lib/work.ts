import type { GalleryShot, ProjectResult } from "@/lib/supabase/types";

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
  /**
   * The server's verdict on whether liveUrl can be framed (the save-time probe,
   * lib/net/embed-probe.ts). `false` = it refuses framing or didn't answer, so
   * the preview shows the screenshot + "Open ↗" instead of an iframe that would
   * only display the browser's refusal page. Undefined = never checked.
   */
  embeddable?: boolean;
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

  // Case-study detail, entered in /admin. All optional: the detail page renders
  // a section only when it has content, so these static entries need none.
  client?: string;
  industry?: string;
  timeline?: string;
  /** what we did — usually service titles */
  services?: string[];
  /** roster names credited on the project */
  team?: string[];
  stack?: string[];
  challenge?: string;
  approach?: string;
  outcome?: string;
  /** real, measured numbers only — never estimates */
  results?: ProjectResult[];
  /** extra screens beyond img/img2 */
  gallery?: GalleryShot[];
  testimonial?: { quote: string; author: string; role?: string };
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

  // Added 2026-11-05 from James Calunsag's portfolio (Portfolio Web v2,
  // server/data/content.json), rewritten in the studio's voice. Credits are
  // kept as the write-ups state them: on team builds the copy says which part
  // was ours. No liveUrl: tests/data-integrity.test.ts keeps them unset until
  // each deployment is checked (see the note on `liveUrl` above).
  {
    slug: "stormfresh-erp",
    name: "Stormfresh",
    category: "Poultry ERP",
    url: "poias.vercel.app",
    year: "’26",
    summary: "From live-bird purchase to invoice, with profit worked out live from the records.",
    description:
      "A role-gated ERP for a Philippine poultry operation. Flock grow-out, commission payroll and monthly P&L used to live in separate spreadsheets, so profit was only known after month-end. Now purchases, dressing output, invoices and staff commissions sit in one system, and gain, balance and trend figures are recomputed from the source rows rather than stored, so they can't drift out of sync.",
    highlights: [
      "Management dashboard with a live gain breakdown",
      "Approvals and deletes enforced in Postgres row-level security",
      "Invitation-only workspace sign-in",
      "Marketing landing page for the farm",
    ],
    img: "/work/stormfresh-dashboard.webp",
    img2: "/work/stormfresh-landing.webp",
    tags: ["Web App", "ERP", "Dashboard"],
    dots: ["#14532d", "#f97316", "#fdf6e3"],
    industry: "Agriculture · Poultry",
    stack: ["Next.js", "React", "Supabase Postgres (RLS)", "Supabase Auth", "Tailwind CSS", "Zustand", "Recharts", "Vitest"],
    challenge:
      "A poultry business bought live birds, dressed them and sold the output, but the money lived in spreadsheets. Flock grow-out, commission payroll and monthly P&L each sat in a separate workbook, several with arithmetic defects nobody had caught. Profit was only knowable after month-end reconciliation, and approving a purchase order meant whoever happened to sign the paper.",
    approach:
      "One of five engineers on the build, we owned the management dashboard and the reporting layer: gain, balance and trend figures recomputed live from source rows rather than stored. The role model was pushed down into Postgres row-level security, so drafts stay private to their author and only Management approves or deletes. The interface language across the app is ours too.",
    outcome:
      "Gain, balance and trend figures are calculated from source records, and management permissions are enforced in the database rather than only in the interface.",
    gallery: [{ src: "/work/stormfresh-login.webp", caption: "Invitation-only workspace sign-in", kind: "desktop" }],
  },
  {
    slug: "flux",
    name: "Flux",
    category: "Islamic Digital Banking",
    url: "fluxpk.co",
    year: "’26",
    summary: "A pre-launch bank that is honest about what isn’t live yet, enforced by its tests.",
    description:
      "The pre-launch site for a Shariah-compliant Pakistani digital bank: a waitlist funnel and the product story, with a companion Expo app. A bank that hasn't opened still has to collect real names and phone numbers without implying a service already exists, so unbuilt products get working screens that state their own blocker, and a contrast suite pins every colour pair in the brand palette.",
    highlights: [
      "Waitlist funnel with the product story",
      "Contrast suite guarding the brand teal",
      "Pre-launch screens that say what isn’t live",
      "Companion Expo app with one floating menu",
    ],
    img: "/work/flux-hero.webp",
    img2: "/work/flux-card.webp",
    tags: ["Web", "Fintech", "Mobile"],
    dots: ["#0f766e", "#5eead4", "#0b1f1d"],
    industry: "Fintech · Islamic banking",
    stack: ["Next.js", "TypeScript", "Tailwind CSS", "React Native (Expo Router)", "Vitest + Testing Library", "Google Sheets API", "Three.js"],
    challenge:
      "A bank that has not opened yet still has to collect real names, phone numbers and emails from the public, and show an earned-wage product it cannot yet run, so every screen risks implying a service already exists. The client also settled a four-colour brand mid-build whose primary teal is light enough that white text on it fails WCAG AA outright.",
    approach:
      "Honesty is enforced mechanically rather than by review. A contrast suite pins every shipping colour pair, with inverted guards that fail if light text lands on the brand teal or teal is used as body copy. Unbuilt products get working, fixture-driven screens that state their own blocker instead of dead-ending, and the companion Expo app swaps a five-slot tab bar for one floating menu across thirteen destinations.",
    outcome:
      "The recorded web suite covers 19 contrast pairs and 235 tests across 35 files, and the mobile interface uses six font sizes instead of sixteen.",
    results: [
      { value: "19", label: "Contrast pairs under test" },
      { value: "235", label: "Web tests across 35 files" },
      { value: "16 → 6", label: "Font sizes in the app" },
    ],
  },
  {
    slug: "aperture",
    name: "Aperture",
    category: "Private AI Journal",
    url: "aperture.run.app",
    year: "’26",
    summary: "Think alongside Gemini, with entries the server and the model can’t read.",
    description:
      "A private journaling companion where you write alongside Gemini. Entries you seal are encrypted in the browser, so neither the server nor the model can read them, and every AI call is logged where you can audit it. Echoes brings an older entry back mid-draft, so what you write doesn't just disappear.",
    highlights: [
      "Sign-in gate that leads with the privacy terms",
      "Four thinking modes: Reflect, Brainstorm, Untangle, Rubber Duck",
      "Sealed entries encrypted in the browser",
      "Sessions grouped by month, with open questions",
    ],
    img: "/work/aperture-home.webp",
    img2: "/work/aperture-signin.webp",
    tags: ["Web App", "AI", "Privacy"],
    dots: ["#ec4899", "#f9a8d4", "#0a0a0a"],
    stack: ["Next.js", "TypeScript", "Firebase Auth", "Cloud Firestore", "Gemini", "Cloud Run + Secret Manager", "WebCrypto (AES-GCM, PBKDF2)", "Tailwind CSS"],
    challenge:
      "Handing a journal to an AI means handing over the most private writing a person does, and most products ask for that trust without offering any way to check what left the device or who could read it. Journals are also write-only: people stop because what they pour in never comes back.",
    approach:
      "Tenancy is the Firestore path itself, so a cross-user leak would need a bug in the path rather than a forgotten filter, and the rules deny client writes outright. Sealed entries are AES-GCM encrypted in the browser under a key that is never stored. Echoes surfaces an older entry mid-draft with the change in mood, gated by consent the server enforces and logged, so the feature that reads unsent text is the most auditable one in the app.",
  },
  {
    slug: "ulat",
    name: "Ulat",
    category: "Disaster Reporting · Offline AI",
    url: "ulat · offline hub",
    year: "’26",
    summary: "Damage reports after a typhoon, with no internet: one laptop, one router, a local model.",
    description:
      "An offline disaster damage reporting kit for Philippine LGUs. One laptop serves the app, the database and a local vision model over its own Wi-Fi, so it works when power and cell service are gone. Families report with a photo, the model suggests a damage class, and responders confirm each one on their phones. Only verified entries count toward the totals.",
    highlights: [
      "Offline damage map on the hub",
      "Responder to-visit list sorted by urgency",
      "Family reporting flow with privacy notes",
      "AI suggestions that a person must confirm",
    ],
    img: "/work/ulat-hub-map.webp",
    img2: "/work/ulat-hub-locked.webp",
    tags: ["Web App", "AI", "Offline"],
    dots: ["#2563eb", "#f9a8d4", "#0f172a"],
    industry: "Government · Disaster response",
    stack: ["Next.js", "TypeScript", "Tailwind CSS + shadcn/ui", "SQLite (Drizzle)", "Ollama (local vision model)", "MapLibre GL (PMTiles)", "Zod", "Caddy + dnsmasq"],
    challenge:
      "After a typhoon or earthquake, an LGU must file its Rapid Damage Assessment within 24 to 72 hours, exactly when power and cell service are gone. Hundreds of house photos can't be uploaded, cloud tools fail, and damage classes decide shelter assistance, so every classification needs a person to confirm it.",
    approach:
      "Built by the four-person ByteSized team; our part was the Responder app, where staff work a to-visit list sorted by urgency and confirm each AI-suggested damage class. Across the kit, the model only reads, SQL does all the counting, and Zod validates every AI output.",
    outcome: "The whole kit runs with the internet port empty.",
    gallery: [
      { src: "/work/ulat-responder-map.webp", caption: "Responder map with a nearby report", kind: "mobile" },
      { src: "/work/ulat-family-send.webp", caption: "A family checks their report before sending", kind: "mobile" },
    ],
  },
  {
    slug: "pavetrack",
    name: "PAVEtrack",
    category: "Civil Engineering · Pavement Design",
    url: "pavetrack · streamlit",
    year: "’26",
    summary: "A week of CCTV vehicle counts in, a recommended pavement thickness out.",
    description:
      "A web dashboard for civil engineers that turns a week of CCTV vehicle counts into AADT, cumulative ESAL and a recommended pavement thickness, replacing hand calculations in spreadsheets. It began as a university thesis for Galas Feeder Port, alongside a vehicle-detection pipeline that counts traffic straight from the footage.",
    highlights: [
      "AADT, ESAL and thickness from one traffic file",
      "Flexible or rigid pavement from CBR",
      "Traffic composition chart",
      "Plain-language input checks and a sample file",
    ],
    img: "/work/pavetrack-dashboard.webp",
    img2: "/work/pavetrack-detection.webp",
    tags: ["Web App", "Engineering", "Data"],
    dots: ["#1d4ed8", "#93c5fd", "#0f172a"],
    industry: "Civil engineering",
    stack: ["Python", "Streamlit", "pandas", "Folium", "Playwright"],
    challenge:
      "Designing a road pavement needs a trustworthy traffic load figure, but engineers get it by hand-counting vehicles from CCTV footage and pushing the totals through separate AADT, ESAL and thickness calculations by hand. That is slow and easy to get wrong.",
    approach:
      "Built as part of a university thesis team: we wrote the calculation engine and the Streamlit interface, while a teammate built the CCTV vehicle-detection pipeline that feeds it. Each design stage is one small Python module: the CSV reader, AADT, the cumulative ESAL growth series, and flexible or rigid thickness from CBR, wrapped with input validation and plain-language errors.",
  },
  {
    slug: "rallys-transfers",
    name: "Rally’s Transfers",
    category: "Chauffeur Dispatch Platform",
    url: "rallys-transfers · admin",
    year: "’26",
    summary: "Dispatch, CRM and partner portals for a chauffeur service, on one backend.",
    description:
      "A chauffeur and limousine platform that joins an admin dispatch portal, passenger and driver mobile apps and partner portals on one Firebase backend, with Stripe payments and Twilio calling. Bookings arrive from hotels, airlines, corporate accounts and walk-ins, each with its own pricing and approval rules. On this team build, we made the admin portal's interface and its CRM.",
    highlights: [
      "Operations dashboard with today’s bookings",
      "Dispatch board for assigning chauffeurs",
      "CRM lead pipeline from new lead to booking",
      "Light and dark modes",
    ],
    img: "/work/rallys-transfers-dispatch.webp",
    img2: "/work/rallys-transfers-dashboard.webp",
    tags: ["Web App", "Dispatch", "CRM"],
    dots: ["#7f1d1d", "#b91c1c", "#0c0a09"],
    industry: "Transport · Chauffeur services",
    stack: ["Next.js", "TypeScript", "Tailwind CSS", "Flutter", "Firebase Cloud Functions", "Cloud Firestore", "Stripe", "Twilio", "Google Maps"],
    challenge:
      "Chauffeur bookings arrive from hotels, airlines, corporate accounts and walk-in customers, each with different pricing, invoicing and approval rules. Dispatchers have to assign drivers, track flights, handle crew transfers and chase compliance paperwork, while passengers expect live tracking and instant confirmations.",
    approach:
      "One Firebase project backs every surface: the Next.js admin portal with dispatch, CRM, pricing and payouts; role-specific portals for hotels, airlines, fleets and corporates; and Flutter apps for passengers and drivers. Our part was the admin portal's interface and its CRM, as one of several owners on the team.",
    gallery: [{ src: "/work/rallys-transfers-crm.webp", caption: "CRM lead pipeline", kind: "desktop" }],
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
