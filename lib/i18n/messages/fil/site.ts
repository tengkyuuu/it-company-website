/**
 * Filipino — `site` namespace (server-rendered chrome).
 *
 * ⚠️ DRAFT TRANSLATIONS — have a native speaker review before launch.
 *
 * Same register as `common.ts`: contemporary Tagalog-based Filipino, friendly
 * "mo/kami", Taglish where the English term is what readers actually say
 * (Sitemap, Timeline, Tech stack, production, Retainer, Sprint).
 */
import type en from "../en/site";
import type { DeepPartial } from "../../translate";

const site: DeepPartial<typeof en> = {
  meta: {
    siteTitle: "R Ally's Tech — Software na may maingat na disenyo",
    about: "Tungkol sa Amin",
    services: "Mga Serbisyo",
    projects: "Mga Proyekto",
    location: "Lokasyon at Contact",
    projectNotFound: "Hindi mahanap ang proyekto",
  },
  footer: {
    ctaLine1: "Gumawa tayo ng produktong",
    ctaLine2: "sulit",
    ctaAccent: "ilunsad.",
    cta: "Magsimula ng proyekto",
    status: "Status ng studio:",
    colSitemap: "Sitemap",
    colServices: "Mga serbisyo",
    colContact: "Kumustahin kami",
    copyright: "© {year} {name} Studio. Nakalaan ang lahat ng karapatan.",
    designedIn: "Dinisenyo sa Dipolog ✦",
    developedBy: "Binuo ng",
    developedFor: "para sa",
    backToTop: "Bumalik sa itaas",
    opensInNewTab: "(magbubukas sa bagong tab)",
  },
  home: {
    stackEyebrow: "Ang mga teknolohiyang gamit namin",
    processEyebrow: "Paano kami magtrabaho",
    processTitle: "Kalmado at maaasahang paraan ng paglulunsad.",
  },
  about: {
    eyebrow: "Tungkol sa R Ally's Tech",
    titleLine1: "Isang maliit na studio na",
    titleLine2: "masinsin sa bawat",
    titleAccent: "detalye.",
    imageAlt: "Brand identity ng R Ally's Tech sa mga business card",
    valuesEyebrow: "Ang aming pinahahalagahan",
    valuesTitle: "Apat na prinsipyong hindi namin isinasantabi.",
    teamEyebrow: "Ang mga tao",
    teamTitle: "Totoong mukha, hindi stock photo.",
    cta: "Makipagtulungan sa amin",
  },
  services: {
    eyebrow: "Mga Serbisyo",
    titleLine1: "Lahat ng kailangan, mula",
    titleLine2: "ideya hanggang",
    titleAccent: "production.",
    engagementsEyebrow: "Mga paraan ng pagtutulungan",
    engagementsTitle: "Piliin ang akma sa iyo.",
    engagementProject: "Proyekto",
    engagementRetainer: "Retainer",
    engagementSprint: "Sprint",
    cta: "Ikuwento ang iyong proyekto",
  },
  projects: {
    eyebrow: "Mga Proyekto",
    titleLead: "Totoong produkto, ginagamit ng totoong tao —",
    titleAccent: "silipin ang mga ito.",
    count: "{count} proyekto",
    detailLabel: "{name} — detalye ng proyekto",
    view: "Tingnan ang proyekto",
    closingTitle: "Baka ang proyekto mo na ang susunod dito.",
    closingCta: "Magsimula ng proyekto",
  },
  project: {
    back: "Lahat ng proyekto",
    openLive: "Buksan ang live site",
    ask: "Magtanong tungkol sa proyektong ito",
    client: "Kliyente",
    industry: "Industriya",
    category: "Kategorya",
    year: "Taon",
    timeline: "Timeline",
    site: "Site",
    services: "Ang ginawa namin",
    scope: "Saklaw",
    team: "Team",
    stack: "Tech stack",
    livePreview: "Live preview",
    preview: "Preview",
    liveCaption: "Naka-render sa desktop width · i-click ang Subukan para mag-explore",
    shotCaption: "Kinuha mula sa nailunsad na build",
    story: "Ang kuwento",
    challenge: "Ang hamon",
    approach: "Ang aming diskarte",
    outcome: "Ang kinalabasan",
    results: "Mga resulta",
    screens: "Mga screen",
    screenAlt: "{name} — screen {n}",
    mobileScreenAlt: "{name} — mobile screen {n}",
    prev: "← Nakaraan",
    next: "Susunod →",
  },
  location: {
    eyebrow: "Lokasyon at Contact",
    titleLine1: "Pag-usapan natin",
    titleLine2: "ang iyong",
    titleAccent: "binubuo.",
    localTime: "Oras sa studio ngayon",
    studio: "Studio",
    phone: "Telepono",
    hours: "Oras",
    mapTitle: "Lokasyon ng studio ng R Ally's Tech — Dipolog City",
    follow: "Sundan kami",
  },
};

export default site;
