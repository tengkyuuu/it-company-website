/**
 * `common` namespace — UI chrome that CLIENT components render (nav, chat,
 * contact form, 404/error, landing-section labels).
 *
 * This whole namespace is shipped to the browser once per page (resolved for
 * the page's locale only) via SiteChrome → I18nProvider. Keep it to short UI
 * strings; server-only text belongs in `site.ts`.
 *
 * English is the source of truth: every key added here must also be added to
 * `../fil/common.ts` (tests/i18n.test.ts fails otherwise). Top-level section
 * names must be unique across ALL namespaces — they're merged flat, so
 * `t("nav.home")` works the same everywhere.
 *
 * Editor-written content (projects, services, team, posts) never goes here —
 * it comes from the CMS in whatever language it was written.
 */
const common = {
  nav: {
    home: "Home",
    services: "Services",
    projects: "Projects",
    about: "About",
    location: "Location",
    // shown only while something is published (getPublishedSections)
    products: "Products",
    careers: "Careers",
    blog: "Blog",
    search: "Search the site",
    homeLabel: "R Ally's Tech — home",
    ariaLabel: "Main",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    cta: "Get in touch",
  },
  theme: {
    toDark: "Switch to dark mode",
    toLight: "Switch to light mode",
  },
  lang: {
    label: "Language",
    switchTo: "Read this page in {language}",
  },
  hero: {
    eyebrow: "IT Studio · Dipolog City",
    primaryCta: "Explore our work",
    secondaryCta: "Meet the studio",
    scroll: "Scroll",
  },
  work: {
    sectionLabel: "Selected work",
    eyebrow: "Selected work",
    title: "Things we’re proud to have shipped.",
    cta: "See all projects",
    scrollHint: "Scroll sideways",
    detailLabel: "{name} — project detail",
    shotDetailAlt: "{name} — interface detail",
  },
  galaxy: {
    sectionLabel: "Services",
    eyebrow: "What we do",
    title: "One studio, the whole product journey.",
  },
  process: {
    phase: "Phase {no} — {total}",
  },
  belief: {
    eyebrow: "Our belief",
    signature: "— The R Ally's Tech studio",
  },
  showreel: {
    label: "R Ally's Tech showreel",
    tag: "Inside the studio",
  },
  preview: {
    live: "Live",
    interact: "Interact",
    done: "Done",
    open: "Open ↗",
    screenshot: "Screenshot",
    loading: "Loading live site…",
    blocked: "This site may block embedding — use “Open ↗”",
    interactLabel: "Interact with the live {name} preview",
    frameTitle: "{name} — live preview",
    // the server checked: this site refuses to be shown inside another page
    notEmbeddable: "This site can’t be shown here — open it in a new tab",
  },
  contact: {
    name: "Name",
    namePlaceholder: "Jane Dela Cruz",
    email: "Email",
    emailPlaceholder: "jane@company.com",
    service: "What do you need?",
    servicePlaceholder: "Select a service…",
    message: "Tell us a little more",
    messagePlaceholder: "A sentence or two about what you’re building…",
    submit: "Send message →",
    sending: "Sending…",
    privacy: "We’ll only use your details to reply — never shared.",
    successTitle: "Message on its way.",
    successBody:
      "Thanks for reaching out — a real human from the studio will reply within one business day.",
    sendAnother: "Send another",
    networkError: "Couldn’t reach the server. Please email us directly at {email}.",
  },
  chat: {
    open: "Chat with us",
    close: "Close chat",
    dialogLabel: "Chat with R Ally's Tech",
    title: "Ask us anything",
    badge: "AI assistant",
    greeting:
      "Hi — I can tell you about what we build, our services, or the work we've shipped. What are you after?",
    suggestion1: "What services do you offer?",
    suggestion2: "Can you build a mobile app?",
    suggestion3: "Where are you based?",
    thinking: "Thinking",
    placeholder: "Ask about our services…",
    inputLabel: "Your message",
    send: "Send message",
    disclaimer: "AI answers can be wrong — for anything binding, email us.",
    unavailable: "Chat is unavailable right now.",
    genericError: "Something went wrong.",
    // human takeover (Phase 4) — honest about response times, never "instant"
    badgeHuman: "With the team",
    talkToPerson: "Talk to a person",
    talkToPersonHint: "Someone from the team will reply here when they’re available.",
    requested:
      "We’ve let the team know. Someone will reply here when they’re available — usually during working hours (Philippine time), so it may not be right away. You can keep chatting with the assistant meanwhile, or email us.",
    requestFailed: "Couldn’t reach the team just now — please email us instead.",
    requestLimited: "We’ve already let the team know — they’ll reply here when they can.",
    waiting: "Waiting for someone from the team…",
    joined: "A person from the team joined",
    left: "You’re back with the assistant",
    humanAuthor: "{name} · from the team",
    teamMember: "Someone from the team",
    delivered: "Sent to the team",
    humanDisclaimer: "You’re chatting with a person from the team. Replies may take a while.",
    humanPlaceholder: "Write to the team…",
  },
  notFound: {
    eyebrow: "Error 404",
    titleLead: "Page not",
    titleAccent: "found.",
    body: "The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.",
    cta: "Back to home",
  },
  error: {
    eyebrow: "Something broke",
    titleLead: "An unexpected",
    titleAccent: "error.",
    body: "Sorry — something went wrong on our end. Try again, or head back home.",
    retry: "Try again",
    home: "Back home",
  },
  // Cmd+K palette (components/search). `groups.*` also feed the server index
  // as keywords, so "projects" finds every project.
  search: {
    dialogLabel: "Search the site",
    inputLabel: "Search",
    placeholder: "Search pages, projects, services…",
    close: "Close search",
    resultsLabel: "Results",
    idle: "Jump to",
    noResults: "Nothing matches “{query}”. Try another word.",
    resultCount: "{count} results",
    resultOne: "1 result",
    navigate: "Navigate",
    open: "Open",
    dismiss: "Close",
    groups: {
      page: "Pages",
      project: "Projects",
      service: "Services",
      product: "Products",
      job: "Open roles",
      post: "Blog",
      team: "Team",
    },
  },
};

export default common;
