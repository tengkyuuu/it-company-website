export type Service = {
  slug: string;
  title: string;
  blurb: string;
  detail: string;
  deliverables: string[];
  icon: IconName;
};

export type IconName =
  | "web"
  | "app"
  | "design"
  | "cloud"
  | "ai"
  | "consult";

export const services: Service[] = [
  {
    slug: "web-development",
    title: "Web Development",
    blurb: "Fast, accessible sites and web apps that feel effortless.",
    detail:
      "From marketing sites to complex dashboards — we build on modern frameworks with performance, SEO, and accessibility baked in from day one.",
    deliverables: ["Next.js / React", "Headless CMS", "Design systems", "Core Web Vitals"],
    icon: "web",
  },
  {
    slug: "app-development",
    title: "App Development",
    blurb: "Native-feeling mobile apps people actually want to open.",
    detail:
      "iOS and Android from a single, maintainable codebase. We sweat onboarding, offline states, and the small interactions that make an app feel premium.",
    deliverables: ["iOS & Android", "React Native", "Offline-first", "App Store launch"],
    icon: "app",
  },
  {
    slug: "ui-ux-design",
    title: "UI/UX Design",
    blurb: "Interfaces with a point of view — clear, warm, and on-brand.",
    detail:
      "Research, flows, prototypes, and pixel-tight UI. We design products that are obvious to use and a pleasure to look at.",
    deliverables: ["User research", "Prototyping", "Design systems", "Brand & identity"],
    icon: "design",
  },
  {
    slug: "cloud-devops",
    title: "Cloud & DevOps",
    blurb: "Infrastructure that scales quietly while you sleep.",
    detail:
      "We set up the pipelines, observability, and cloud architecture so shipping is a non-event and uptime is someone else's worry — ours.",
    deliverables: ["AWS / GCP", "CI/CD", "Containers", "Monitoring"],
    icon: "cloud",
  },
  {
    slug: "ai-automation",
    title: "AI & Automation",
    blurb: "Practical AI that removes busywork, not jobs.",
    detail:
      "Assistants, search, and workflow automation grounded in your data. We focus on the use-cases that pay for themselves.",
    deliverables: ["LLM features", "RAG & search", "Workflow bots", "Integrations"],
    icon: "ai",
  },
  {
    slug: "it-consulting",
    title: "IT Consulting",
    blurb: "A clear-eyed plan before a single line of code.",
    detail:
      "Architecture reviews, tech strategy, and team augmentation. We help you choose the boring, reliable path — and know when not to.",
    deliverables: ["Tech strategy", "Architecture", "Audits", "Team augmentation"],
    icon: "consult",
  },
];
