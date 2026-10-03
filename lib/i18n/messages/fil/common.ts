/**
 * Filipino — `common` namespace.
 *
 * ⚠️ DRAFT TRANSLATIONS — have a native speaker review before launch.
 *
 * Register: contemporary, Tagalog-based Filipino as used in Philippine tech and
 * marketing — friendly "mo/kami", not stiff textbook Tagalog. Taglish is used
 * where Filipino readers would naturally say the English term (Home, dark mode,
 * live site, screenshot, AI assistant). Brand and place names stay as-is.
 *
 * Shape is checked against English at compile time (no extra/misspelled keys),
 * and tests/i18n.test.ts fails if a key is missing. A missing key would fall
 * back to English at runtime, never to a raw key.
 */
import type en from "../en/common";
import type { DeepPartial } from "../../translate";

const common: DeepPartial<typeof en> = {
  nav: {
    home: "Home",
    services: "Serbisyo",
    projects: "Proyekto",
    about: "Tungkol",
    location: "Lokasyon",
    products: "Produkto",
    careers: "Trabaho",
    blog: "Blog",
    search: "Maghanap sa site",
    homeLabel: "R Ally's Tech — pumunta sa home",
    ariaLabel: "Pangunahin",
    openMenu: "Buksan ang menu",
    closeMenu: "Isara ang menu",
    cta: "Kausapin kami",
  },
  theme: {
    toDark: "Lumipat sa dark mode",
    toLight: "Lumipat sa light mode",
  },
  lang: {
    label: "Wika",
    switchTo: "Basahin ang pahinang ito sa {language}",
  },
  hero: {
    eyebrow: "IT Studio sa Dipolog City",
    primaryCta: "Tingnan ang aming gawa",
    secondaryCta: "Kilalanin ang studio",
    scroll: "Mag-scroll",
  },
  work: {
    sectionLabel: "Mga piling gawa",
    eyebrow: "Mga piling gawa",
    title: "Mga proyektong ipinagmamalaki naming nailunsad.",
    cta: "Tingnan lahat ng proyekto",
    scrollHint: "Mag-scroll patagilid",
    detailLabel: "{name} — detalye ng proyekto",
    shotDetailAlt: "{name} — detalye ng interface",
  },
  galaxy: {
    sectionLabel: "Mga serbisyo",
    eyebrow: "Ang aming ginagawa",
    title: "Iisang studio, buong proseso ng produkto.",
  },
  process: {
    phase: "Yugto {no} — {total}",
  },
  belief: {
    eyebrow: "Ang aming paniniwala",
    signature: "— Ang studio ng R Ally's Tech",
  },
  showreel: {
    label: "Showreel ng R Ally's Tech",
    tag: "Sa loob ng studio",
  },
  preview: {
    live: "Live",
    interact: "Subukan",
    done: "Tapos na",
    open: "Buksan ↗",
    screenshot: "Screenshot",
    loading: "Nilo-load ang live site…",
    blocked: "Maaaring hindi pinapayagan ng site na ito ang pag-embed — gamitin ang “Buksan ↗”",
    interactLabel: "Subukan ang live preview ng {name}",
    frameTitle: "{name} — live preview",
    notEmbeddable: "Hindi maipapakita rito ang site na ito — buksan ito sa bagong tab",
  },
  contact: {
    name: "Pangalan",
    namePlaceholder: "Juan Dela Cruz",
    email: "Email",
    emailPlaceholder: "juan@kumpanya.com",
    service: "Ano ang kailangan mo?",
    servicePlaceholder: "Pumili ng serbisyo…",
    message: "Ikuwento pa nang kaunti",
    messagePlaceholder: "Isa o dalawang pangungusap tungkol sa binubuo mo…",
    submit: "Ipadala ang mensahe →",
    sending: "Ipinapadala…",
    privacy: "Gagamitin lang namin ang detalye mo para sumagot — hindi namin ito ibabahagi.",
    successTitle: "Papunta na ang mensahe mo.",
    successBody:
      "Salamat sa pakikipag-ugnayan — isang totoong tao mula sa studio ang sasagot sa loob ng isang araw ng trabaho.",
    sendAnother: "Magpadala ulit",
    networkError: "Hindi maabot ang server. Mag-email na lang sa amin sa {email}.",
  },
  chat: {
    open: "Makipag-chat sa amin",
    close: "Isara ang chat",
    dialogLabel: "Makipag-chat sa R Ally's Tech",
    title: "Magtanong ka lang",
    badge: "AI assistant",
    greeting:
      "Hi! Puwede kitang kuwentuhan tungkol sa mga binubuo namin, sa aming mga serbisyo, o sa mga proyektong nailunsad na namin. Ano ang hanap mo?",
    suggestion1: "Anong mga serbisyo ang inaalok ninyo?",
    suggestion2: "Kaya ba ninyong gumawa ng mobile app?",
    suggestion3: "Saan kayo matatagpuan?",
    thinking: "Nag-iisip",
    placeholder: "Magtanong tungkol sa aming serbisyo…",
    inputLabel: "Ang mensahe mo",
    send: "Ipadala ang mensahe",
    disclaimer: "Puwedeng magkamali ang AI — para sa anumang pormal na usapan, mag-email sa amin.",
    unavailable: "Hindi available ang chat sa ngayon.",
    genericError: "May nangyaring mali.",
    // human takeover (Phase 4) — DRAFT, ipa-review sa native speaker
    badgeHuman: "Kasama ang team",
    talkToPerson: "Makipag-usap sa tao",
    talkToPersonHint: "May sasagot dito mula sa team kapag available sila.",
    requested:
      "Naabisuhan na namin ang team. May sasagot dito kapag available sila — kadalasan sa oras ng trabaho (oras sa Pilipinas), kaya baka hindi agad-agad. Puwede kang magpatuloy sa assistant habang naghihintay, o mag-email sa amin.",
    requestFailed: "Hindi maabot ang team sa ngayon — mag-email na lang sa amin.",
    requestLimited: "Naabisuhan na namin ang team — sasagot sila dito kapag kaya na nila.",
    waiting: "Naghihintay ng sasagot mula sa team…",
    joined: "May sumali mula sa team",
    left: "Bumalik ka na sa assistant",
    humanAuthor: "{name} · mula sa team",
    teamMember: "Isang tao mula sa team",
    delivered: "Naipadala sa team",
    humanDisclaimer: "Tao mula sa team ang kausap mo. Baka matagalan ang sagot.",
    humanPlaceholder: "Sumulat sa team…",
  },
  notFound: {
    eyebrow: "Error 404",
    titleLead: "Hindi mahanap ang",
    titleAccent: "pahina.",
    body: "Wala ang pahinang hinahanap mo, o baka nailipat na ito. Ibalik ka natin sa tamang daan.",
    cta: "Bumalik sa home",
  },
  error: {
    eyebrow: "May nasira",
    titleLead: "Isang hindi inaasahang",
    titleAccent: "error.",
    body: "Pasensya na — nagkaproblema sa aming panig. Subukan ulit, o bumalik sa home.",
    retry: "Subukan ulit",
    home: "Bumalik sa home",
  },
  search: {
    dialogLabel: "Maghanap sa site",
    inputLabel: "Maghanap",
    placeholder: "Maghanap ng page, proyekto, serbisyo…",
    close: "Isara ang search",
    resultsLabel: "Mga resulta",
    idle: "Pumunta sa",
    noResults: "Walang tumugma sa “{query}”. Subukan ang ibang salita.",
    resultCount: "{count} resulta",
    resultOne: "1 resulta",
    navigate: "Lumipat",
    open: "Buksan",
    dismiss: "Isara",
    groups: {
      page: "Mga page",
      project: "Mga proyekto",
      service: "Mga serbisyo",
      product: "Mga produkto",
      job: "Bukas na posisyon",
      post: "Blog",
      team: "Ang team",
    },
  },
};

export default common;
