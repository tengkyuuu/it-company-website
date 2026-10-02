/**
 * `site` namespace — chrome rendered by SERVER components only (footer, page
 * section eyebrows / short titles, metadata titles). Never shipped to the
 * browser as a dictionary; only the rendered text reaches the HTML.
 *
 * Scope (client decision, 2026-10-02): UI chrome — labels, eyebrows, short
 * section titles, CTAs, aria text. NOT long-form marketing body copy (section
 * intros, value/engagement descriptions stay English) and NOT editor-written
 * CMS content.
 *
 * Titles with a gradient word are split into parts (`…Line1`, `…Line2`,
 * `…Accent`) so each language can put the accent on its own natural last word.
 *
 * Every key here must exist in `../fil/site.ts` (tests/i18n.test.ts).
 */
const site = {
  meta: {
    siteTitle: "R Ally's Tech — Software, designed with intent",
    about: "About",
    services: "Services",
    projects: "Projects",
    location: "Location & Contact",
    projectNotFound: "Project not found",
  },
  footer: {
    ctaLine1: "Let’s build something",
    ctaLine2: "worth",
    ctaAccent: "shipping.",
    cta: "Start a project",
    status: "Studio status:",
    colSitemap: "Sitemap",
    colServices: "Services",
    colContact: "Say hello",
    copyright: "© {year} {name} Studio. All rights reserved.",
    designedIn: "Designed in Dipolog ✦",
    developedBy: "Developed by",
    developedFor: "for",
    backToTop: "Back to top",
    opensInNewTab: "(opens in a new tab)",
  },
  home: {
    stackEyebrow: "The stack we build on",
    processEyebrow: "How we work",
    processTitle: "A calm, predictable way to ship.",
  },
  about: {
    eyebrow: "About R Ally's Tech",
    titleLine1: "A small studio that",
    titleLine2: "sweats the",
    titleAccent: "details.",
    imageAlt: "R Ally's Tech brand identity on business cards",
    valuesEyebrow: "What we value",
    valuesTitle: "Four things we won’t compromise on.",
    teamEyebrow: "The people",
    teamTitle: "Faces, not stock photos.",
    cta: "Work with us",
  },
  services: {
    eyebrow: "Services",
    titleLine1: "Everything it takes to go from",
    titleLine2: "idea to",
    titleAccent: "in production.",
    engagementsEyebrow: "Ways to work together",
    engagementsTitle: "Pick the shape that fits.",
    engagementProject: "Project",
    engagementRetainer: "Retainer",
    engagementSprint: "Sprint",
    cta: "Tell us about your project",
  },
  projects: {
    eyebrow: "Projects",
    titleLead: "Real products, in real hands —",
    titleAccent: "see them running.",
    count: "{count} projects",
    detailLabel: "{name} — project detail",
    view: "View project",
    closingTitle: "Yours could be next on this page.",
    closingCta: "Start a project",
  },
  project: {
    back: "All projects",
    openLive: "Open live site",
    ask: "Ask about this build",
    client: "Client",
    industry: "Industry",
    category: "Category",
    year: "Year",
    timeline: "Timeline",
    site: "Site",
    services: "What we did",
    scope: "Scope",
    team: "Team",
    stack: "Tech stack",
    livePreview: "Live preview",
    preview: "Preview",
    liveCaption: "Rendered at desktop width · click Interact to explore",
    shotCaption: "Captured from the shipped build",
    story: "The story",
    challenge: "The challenge",
    approach: "Our approach",
    outcome: "The outcome",
    results: "Results",
    screens: "Screens",
    screenAlt: "{name} — screen {n}",
    mobileScreenAlt: "{name} — mobile screen {n}",
    prev: "← Previous",
    next: "Next →",
  },
  location: {
    eyebrow: "Location & Contact",
    titleLine1: "Let’s talk about",
    titleLine2: "what you’re",
    titleAccent: "building.",
    localTime: "Studio time now",
    studio: "Studio",
    phone: "Phone",
    hours: "Hours",
    mapTitle: "R Ally's Tech studio location — Dipolog City",
    follow: "Follow along",
  },
};

export default site;
