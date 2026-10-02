/**
 * Filipino — `catalog` namespace (wave B: products, careers, blog).
 *
 * ⚠️ DRAFT TRANSLATIONS — have a native speaker review before launch.
 *
 * Same register as `common.ts`: contemporary, Tagalog-based Filipino as used
 * in Philippine tech — friendly "mo/kami", Taglish where people naturally say
 * the English term (full-time, hybrid, remote, CV, portfolio, link, blog,
 * features). Brand and place names stay as-is.
 *
 * Mirror every key in `../en/catalog.ts` (same {placeholders}).
 */
import type en from "../en/catalog";
import type { DeepPartial } from "../../translate";

const catalog: DeepPartial<typeof en> = {
  /* -------------------------------------------------------------- products */
  products: {
    metaTitle: "Mga Produkto",
    metaDescription:
      "Software na dinidisenyo, binubuo at inaalagaan ng R Ally's Tech sa sarili nitong pangalan.",
    eyebrow: "Mga Produkto",
    titleLead: "Software na gawa namin",
    titleAccent: "sa sarili naming pangalan.",
    intro:
      "Bukod sa trabaho para sa mga kliyente, may sarili rin kaming mga produktong dinidisenyo, binubuo at inaalagaan. Ito ang mga iyon.",
    countOne: "{count} produkto",
    countMany: "{count} produkto",
    sheetNo: "Blg. {n}",
    features: "Ano ang kaya nito",
    featureCount: "{count} features",
    moreFeatures: "+ {count} pa sa page ng produkto",
    details: "Detalye ng produkto",
    detailLabel: "{name} — detalye ng produkto",
    imageAlt: "{name} — screenshot ng produkto",
    emptyTitle: "Parating na ang mga una naming produkto.",
    emptyBody:
      "Wala pa kaming maipapakita sa ngayon. Habang hinihintay mo, gusto naming marinig ang tungkol sa binubuo mo.",
    emptyCta: "Kausapin kami",
    closingTitle: "Kailangan mo ba ng ganito, na gawa para sa iyo?",
    closingBody: "Ikuwento mo ang binubuo mo at sasabihin namin kung paano namin ito ilulunsad.",
    closingCta: "Magsimula ng proyekto",
  },
  product: {
    back: "Lahat ng produkto",
    eyebrow: "Produkto",
    features: "Mga feature",
    preview: "Mas malapitang tingin",
    screens: "Mga screen",
    screenAlt: "{name} — screen {n}",
    mobileScreenAlt: "{name} — mobile screen {n}",
    ask: "Magtanong tungkol sa {name}",
    more: "Iba pang produkto",
    notFound: "Hindi nahanap ang produkto",
  },

  /* --------------------------------------------------------------- careers */
  careers: {
    metaTitle: "Trabaho",
    metaDescription:
      "Mga bakanteng posisyon sa R Ally's Tech, isang maliit at senior na software studio sa Dipolog City.",
    eyebrow: "Trabaho",
    titleLead: "Tulungan kaming bumuo ng software",
    titleAccent: "na may panlasa.",
    intro:
      "Maliit at senior na studio kami sa Dipolog City. Kung mahalaga rin sa iyo ang mga detalye gaya namin, silipin mo ang mga bakante.",
    countOne: "{count} bakanteng posisyon",
    countMany: "{count} bakanteng posisyon",
    colRole: "Posisyon",
    colTeam: "Team",
    colLocation: "Lokasyon",
    colType: "Uri",
    colWorkplace: "Setup",
    closesOn: "Hanggang {date} ang aplikasyon",
    emptyTitle: "Walang bakanteng posisyon ngayon",
    emptyBody:
      "Pero gusto pa rin naming makakilala ng mahuhusay na tao. Ikuwento mo kung saan ka magaling at ano ang gusto mong gawin.",
    emptyCta: "Mag-hello",
    speculativeTitle: "Wala rito ang posisyong hanap mo?",
    speculativeBody:
      "Gusto pa rin naming makakilala ng mahuhusay na tao. Ikuwento mo kung saan ka magaling at ano ang gusto mong gawin.",
    speculativeCta: "Kausapin kami",
  },
  job: {
    back: "Lahat ng posisyon",
    team: "Team",
    location: "Lokasyon",
    type: "Uri",
    workplace: "Setup",
    closes: "Huling araw ng aplikasyon",
    openEnded: "Bukas hangga’t walang napipili",
    fullTime: "Full-time",
    partTime: "Part-time",
    contract: "Kontrata",
    internship: "Internship",
    onsite: "On-site",
    hybrid: "Hybrid",
    remote: "Remote",
    about: "Tungkol sa posisyon",
    responsibilities: "Ang gagawin mo",
    requirements: "Ang hinahanap namin",
    applyNow: "Mag-apply sa posisyong ito",
    closedBadge: "Sarado na",
    closedTitle: "Sarado na ang posisyong ito",
    closedBody:
      "Hindi na kami tumatanggap ng aplikasyon para rito. Silipin mo ang mga bakante ngayon — o mag-hello ka pa rin.",
    closedOn: "Nagsara ang aplikasyon noong {date}.",
    closedCta: "Tingnan ang mga bakante",
    closedContact: "Kausapin kami",
    notFound: "Hindi nahanap ang posisyon",
  },
  apply: {
    eyebrow: "Mag-apply",
    title: "Mag-apply sa posisyong ito",
    intro: "Maikling mensahe at ilang link lang ang kailangan namin.",
    noUploads:
      "Walang file upload — ibahagi ang CV, portfolio o LinkedIn mo bilang link.",
    name: "Pangalan",
    namePlaceholder: "Jane Dela Cruz",
    email: "Email",
    emailPlaceholder: "jane@email.com",
    phone: "Telepono",
    optional: "opsyonal",
    phonePlaceholder: "+63 9XX XXX XXXX",
    links: "Mga link",
    linksHint:
      "Hanggang 3 link na nagsisimula sa https://, isa bawat linya — CV, portfolio, LinkedIn. Hindi kami tumatanggap ng file upload.",
    linksPlaceholder: "https://",
    message: "Mensahe",
    messagePlaceholder: "Bakit ang posisyong ito, at ano ang maiaambag mo…",
    submit: "Ipadala ang aplikasyon →",
    sending: "Ipinapadala…",
    privacy: "Gagamitin lang namin ang detalye mo para suriin ang aplikasyon mo.",
    successTitle: "Natanggap na ang aplikasyon mo.",
    successBody: "Salamat sa pag-apply bilang {role} — ligtas na itong nakarating sa inbox namin.",
    errName: "Pakilagay ang pangalan mo.",
    errEmail: "Maglagay ng tamang email address.",
    errPhone: "Mukhang hindi ito numero ng telepono — o iwanan na lang itong blangko.",
    errLinks: "Hanggang 3 link lang, at bawat isa ay dapat nagsisimula sa https://.",
    errMessage: "Magkuwento pa nang kaunti (20–4,000 character).",
    errRequest: "May mali sa request. Paki-reload ang page at subukan ulit.",
    errRate: "Medyo marami ka nang naipadala sa maikling oras. Maghintay ng ilang minuto at subukan ulit.",
    errBusy:
      "Napakaraming aplikasyon ang dumarating ngayon. Subukan ulit mamaya, o i-email kami sa {email}.",
    errClosed: "Hindi na tumatanggap ng aplikasyon ang posisyong ito.",
    errServer:
      "Nagkaproblema sa amin at hindi naipadala ang aplikasyon mo. Paki-email na lang ito sa {email}.",
    errNetwork: "Hindi maabot ang server. Mag-email na lang sa {email}.",
  },

  /* ------------------------------------------------------------------ blog */
  blog: {
    metaTitle: "Blog",
    metaDescription:
      "Mga tala ng R Ally's Tech tungkol sa kung paano kami nagdidisenyo at bumubuo ng software.",
    eyebrow: "Blog",
    titleLead: "Mga tala mula sa",
    titleAccent: "studio.",
    intro:
      "Kung paano kami nagdidisenyo at bumubuo ng software — ang mga desisyon, ang proseso, at ang mga natututunan namin.",
    countOne: "{count} post",
    countMany: "{count} post",
    latest: "Pinakabago",
    archive: "Mga naunang post",
    readingTime: "{minutes} minutong basa",
    by: "Ni {author}",
    readPost: "Basahin ang post",
    postLabel: "{title} — basahin ang post",
    coverAlt: "{title} — cover image",
    emptyTitle: "Wala pang nailalathala.",
    emptyBody:
      "Isinusulat pa ang mga unang post. Habang wala pa, masaya kaming makipagkuwentuhan nang direkta.",
    emptyCta: "Kausapin kami",
  },
  post: {
    back: "Lahat ng post",
    published: "Nailathala",
    updated: "In-update noong {date}",
    tags: "Mga tag",
    more: "Magbasa pa",
    closingTitle: "May binubuo ka? Mag-usap tayo.",
    closingCta: "Magsimula ng proyekto",
    notFound: "Hindi nahanap ang post",
  },
};

export default catalog;
