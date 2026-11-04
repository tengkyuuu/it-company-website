# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Confirmed 2026-11-04. The site has to convince three audiences, in this order of weight:

1. **Local businesses** in Dipolog, Mindanao and the wider Philippines that need a website,
   app or internal system built.
2. **Overseas clients** outsourcing to a Philippine team (one shipped project, Rally's
   Equities, is for a Pakistan-focused fintech).
3. **Startups and founders** with an idea who need a team to build the first version.

Job seekers are **not** a target audience right now. Careers stays CMS-gated and dormant.

## Product Purpose

The marketing site for **R Ally's Tech**, an IT studio in Dipolog City. It has to
answer four questions quickly: who you are, what you build, whether it's real, and how to
start. Success is a visitor sending the contact form (there is no public email or phone yet).

## Positioning

A small, senior team in Dipolog that designs **and** engineers. The people who scope a
project are the people who build it. The proof is five real shipped platforms across very
different domains (CRM, healthcare, structural monitoring, fintech, retail), which a
template agency site cannot truthfully claim.
*(Inferred from the existing site copy. Refine when the client writes the About story.)*

## Operating Context

- The CMS (Supabase `/admin`) is **off** since 2026-10-19, so content lives in code
  (`lib/work.ts`, `lib/services.ts`, `lib/team.ts`, `lib/site.ts`) until it is turned back on.
- No domain yet; production is `rallys-tech.vercel.app`. Contact goes through the form only.
- English and Filipino routes both exist; the language switcher was removed (2026-11-04).

## Capabilities and Constraints

- Services (six): Web Development, App Development, UI/UX Design, Cloud & DevOps,
  AI & Automation, IT Consulting.
- Engagement models: fixed-scope project, monthly retainer, 2-week sprint.
- **No published prices.** The project domains are placeholders and must never be linked.
- Products / Careers / Blog pages exist but render only when CMS content is published.

## Brand Commitments

- Name: R Ally's Tech; the logo lockup is generated (`components/Logo.tsx`).
- The **keycap** is the brand's signature object and must survive every redesign.
- Visual system: see DESIGN.md (black / white / gold).

## Evidence on Hand

- Five projects with real screenshots (`public/work/`, data in `lib/work.ts`): FameCRM,
  PhysioPano, SHM bridge monitor, Rally's Equities, Coffee Shop.
- Six real team members with roles (`lib/team.ts`).
- **Promised by the client (2026-11-04), not yet received:** case-study write-ups per
  project, team/workspace photos, client names and quotes with permission.
- **Absent, and must not be invented:** prices, metrics, testimonials, client logos, office
  street address, public email and phone.

## Product Principles

1. **Every fact has one home.** Other pages link to it instead of restating it.
2. **Proof over adjectives.** Show the shipped work and the people. Don't describe ourselves.
3. **Speak to all three audiences without three websites.** The same pages, with the
   "is this for me?" answered early.
4. **Nothing invented.** A section without real material stays hidden until it has some.
