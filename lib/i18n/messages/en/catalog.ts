/**
 * `catalog` namespace — the Products, Careers and Blog pages (wave B).
 * Server-only: it is NOT in CLIENT_NAMESPACES, so it never ships to the
 * browser as a dictionary. The one client component that needs strings (the
 * apply form) receives them already rendered, as props.
 *
 * Use with `getDictionary(lang).t("products.eyebrow")`. Keys must be string
 * literals at the call site (tests/i18n.test.ts can't check a dynamic key) —
 * that's why the employment types are separate keys, not `job.type.${x}`.
 *
 * Rules (enforced by tests/i18n.test.ts):
 *  - every key must also exist in `../fil/catalog.ts`, with the same
 *    {placeholders};
 *  - top-level section names must not collide with `common` / `site`
 *    (taken: nav, theme, lang, hero, work, galaxy, process, belief, showreel,
 *    preview, contact, chat, notFound, error, meta, footer, home, about,
 *    services, projects, project, location — and `search`, wave B).
 *
 * Scope note: these are UI chrome — labels, eyebrows, empty states, form
 * copy. Product names, roles and posts are CMS content and render as written.
 */
const catalog = {
  /* -------------------------------------------------------------- products */
  products: {
    metaTitle: "Products",
    metaDescription:
      "Software R Ally's Tech designs, builds and looks after under its own name.",
    eyebrow: "Products",
    titleLead: "Software we make",
    titleAccent: "under our own name.",
    intro:
      "Alongside client work, we design, build and look after products of our own. Here’s what’s on the shelf.",
    countOne: "{count} product",
    countMany: "{count} products",
    sheetNo: "No. {n}",
    features: "What it does",
    featureCount: "{count} features",
    moreFeatures: "+ {count} more on the product page",
    details: "Product details",
    detailLabel: "{name} — product details",
    imageAlt: "{name} — product screenshot",
    emptyTitle: "Our first products are on the way.",
    emptyBody:
      "Nothing’s on the shelf just yet. In the meantime, we’d love to hear about what you’re building.",
    emptyCta: "Get in touch",
    closingTitle: "Need something like this, built around you?",
    closingBody: "Tell us what you’re building and we’ll tell you how we’d ship it.",
    closingCta: "Start a project",
  },
  product: {
    back: "All products",
    eyebrow: "Product",
    features: "Features",
    preview: "A closer look",
    screens: "Screens",
    screenAlt: "{name} — screen {n}",
    mobileScreenAlt: "{name} — mobile screen {n}",
    ask: "Ask about {name}",
    more: "More products",
    notFound: "Product not found",
  },

  /* --------------------------------------------------------------- careers */
  careers: {
    metaTitle: "Careers",
    metaDescription:
      "Open roles at R Ally's Tech, a small, senior software studio in Dipolog City.",
    eyebrow: "Careers",
    titleLead: "Help us build software",
    titleAccent: "with taste.",
    intro:
      "We’re a small, senior studio in Dipolog City. If you care about the details as much as we do, have a look at what’s open.",
    countOne: "{count} open role",
    countMany: "{count} open roles",
    colRole: "Role",
    colTeam: "Team",
    colLocation: "Location",
    colType: "Type",
    colWorkplace: "Workplace",
    closesOn: "Applications close {date}",
    emptyTitle: "No open roles right now",
    emptyBody:
      "We still like hearing from good people. Tell us what you do best and what you’d love to work on.",
    emptyCta: "Say hello",
    speculativeTitle: "Don’t see your role?",
    speculativeBody:
      "We still like hearing from good people. Tell us what you do best and what you’d love to work on.",
    speculativeCta: "Get in touch",
  },
  job: {
    back: "All roles",
    team: "Team",
    location: "Location",
    type: "Type",
    workplace: "Workplace",
    closes: "Applications close",
    openEnded: "Open until filled",
    fullTime: "Full-time",
    partTime: "Part-time",
    contract: "Contract",
    internship: "Internship",
    onsite: "On-site",
    hybrid: "Hybrid",
    remote: "Remote",
    about: "About the role",
    responsibilities: "What you’ll do",
    requirements: "What you’ll bring",
    applyNow: "Apply for this role",
    closedBadge: "Closed",
    closedTitle: "This role has closed",
    closedBody:
      "We’re no longer taking applications for this one. Have a look at what’s open now — or say hello anyway.",
    closedOn: "Applications closed {date}.",
    closedCta: "See open roles",
    closedContact: "Get in touch",
    notFound: "Role not found",
  },
  apply: {
    eyebrow: "Apply",
    title: "Apply for this role",
    intro: "A short note and a few links is all we need.",
    noUploads:
      "No file uploads — share your CV, portfolio or LinkedIn as links instead.",
    name: "Name",
    namePlaceholder: "Jane Dela Cruz",
    email: "Email",
    emailPlaceholder: "jane@email.com",
    phone: "Phone",
    optional: "optional",
    phonePlaceholder: "+63 9XX XXX XXXX",
    links: "Links",
    linksHint:
      "Up to 3 https:// links, one per line — CV, portfolio, LinkedIn. We don’t take file uploads.",
    linksPlaceholder: "https://",
    message: "Cover note",
    messagePlaceholder: "Why this role, and what you’d bring to it…",
    submit: "Send application →",
    sending: "Sending…",
    privacy: "We’ll only use your details to consider your application.",
    successTitle: "Application received.",
    successBody: "Thanks for applying for {role} — it’s landed safely in our inbox.",
    errName: "Please enter your name.",
    errEmail: "Enter a valid email address.",
    errPhone: "That doesn’t look like a phone number — or leave it blank.",
    errLinks: "Use up to 3 links, each starting with https://.",
    errMessage: "Tell us a little more (20–4,000 characters).",
    errRequest: "Something about that request didn’t look right. Please reload the page and try again.",
    errRate: "You’ve sent a few applications in a short time. Please wait a few minutes and try again.",
    errBusy:
      "We’re receiving an unusual number of applications right now. Please try again later, or email us at {email}.",
    errClosed: "This role is no longer accepting applications.",
    errServer:
      "Something went wrong on our end and your application wasn’t sent. Please email it to us at {email}.",
    errNetwork: "Couldn’t reach the server. Please email us directly at {email}.",
  },

  /* ------------------------------------------------------------------ blog */
  blog: {
    metaTitle: "Blog",
    metaDescription:
      "Notes from R Ally's Tech on how we design and build software.",
    eyebrow: "Blog",
    titleLead: "Notes from",
    titleAccent: "the studio.",
    intro: "How we design and build software — the decisions, the process, and what we learn along the way.",
    countOne: "{count} post",
    countMany: "{count} posts",
    latest: "Latest",
    archive: "Earlier posts",
    readingTime: "{minutes} min read",
    by: "By {author}",
    readPost: "Read the post",
    postLabel: "{title} — read the post",
    coverAlt: "{title} — cover image",
    emptyTitle: "Nothing published yet.",
    emptyBody:
      "The first posts are being written. Until they land, we’re always happy to talk shop directly.",
    emptyCta: "Get in touch",
  },
  post: {
    back: "All posts",
    published: "Published",
    updated: "Updated {date}",
    tags: "Tags",
    more: "Keep reading",
    closingTitle: "Building something? Let’s talk.",
    closingCta: "Start a project",
    notFound: "Post not found",
  },
};

export default catalog;
