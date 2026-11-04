# Content plan: what goes on each page

*Planned 2026-11-04 with `/impeccable shape`. Product truth is in [`PRODUCT.md`](../PRODUCT.md)
and the look is in [`DESIGN.md`](../DESIGN.md). This file decides **what** each page says.
The material we need from the team is listed in [`content-request.md`](content-request.md).*

---

## 1. The problem today

The site says the same few things over and over and leaves out what a visitor actually
needs to decide.

| Content | Where it appears now | Times |
|---|---|---|
| The 5 project screenshots | Hero reel · Home "Selected Work" · Projects index · each case study | **4** |
| Full service descriptions + deliverable chips | Home Services section · Services page accordion · footer list | **3** |
| "Get in touch" closing call to action | A row at the end of each page **and** the footer band right after it | **2 per page** |
| Dipolog + live clock | Hero corner · Location page · footer | **3** |
| Decorative marquee | Home tech stack · About outline words | 2 |

What's **missing** entirely:

- **"Is this for me?"** Three different audiences arrive, and nothing speaks to them.
- **What happened on each project.** Case studies are screenshots only, with no problem,
  approach or outcome.
- **Who's behind it.** The team is names only. About's big image is the **old MYKT business
  card** (`public/brand/card-mockup.png`), which is wrong-brand artwork.
- **Answers to the obvious questions:** how long, how pricing works, who owns the code,
  working across countries, what happens after launch.
- **What happens after I hit send.** The contact page doesn't say.

## 2. The rule that fixes it

**Every fact has one home.** Other pages give a one-line taste and link to that home.

| Fact | Its one home | Elsewhere only as… |
|---|---|---|
| Project screenshots and stories | **Work** (index + case studies) | the hero reel (motion only, no text) |
| Service detail, deliverables, FAQ | **Services** | one line per service on Home, names in the footer |
| How we work (4 steps) | **Home** (Process deck) | — |
| Engagement models | **Services** | — |
| Who we are, values, team, story | **About** | — |
| Form, hours, map, what happens next | **Contact** | the footer band button |
| Closing call to action | **Footer band** (every page) | — (per-page CTA rows removed) |

## 3. Navigation

`Home · Services · Work · About · Contact`

- **Projects → "Work".** It's shorter and reads as a portfolio. The URL can stay `/projects`.
- **Location → "Contact"**, at `/contact`, with `/location` redirecting. The page is mostly
  the form, and with no street address "Location" promises something it can't give.

---

## 4. Page by page

Legend: **KEEP** · **CHANGE** · **ADD** · **REMOVE** · ⏳ waits on material from the team.

### Home: "Who are you, what do you build, is it real, how do I start?"

| # | Section | Decision |
|---|---|---|
| 1 | **Hero** (headline + curved screenshot reel + gold keycap) | **KEEP.** This is the *only* place screenshots appear on Home. **CHANGE** the second button from "Meet the studio" to **"Start a project"** (→ Contact); the first stays "See our work" (→ Work). |
| 2 | Tech stack marquee | **KEEP.** It's concrete and matters to overseas clients. Logos stay monochrome. |
| 3 | **Who we build for** | **ADD.** Three short columns: *Local businesses* · *Teams abroad* · *Founders with an idea*. One honest sentence each on what we do for them, plus the engagement model that usually fits. This answers "is this for me?" before the visitor scrolls past the services. *(I can draft the copy; the team approves it.)* |
| 4 | **Services macropad** | **CHANGE.** Keep the six keys. Each row shrinks to **title + one line**; the long description and deliverable chips move to Services only. Add one "All services →" link. |
| 5 | Selected Work gallery | **REMOVE.** It's the 2nd of 4 showings of the same screenshots. |
| 6 | **Proof band** | **ADD ⏳.** The client names we have permission to use, set as type rather than logos, plus **one** real quote. Stays hidden until the names and quotes arrive. |
| 7 | Process deck (Discover → Design → Build → Grow) | **KEEP.** This is its only home. |
| 8 | Belief band | **KEEP.** It's the last beat before the footer's call to action. |

### Services: "Can you do what I need, how do you work, what will it cost me?"

| # | Section | Decision |
|---|---|---|
| 1 | Header + self-pressing keycap | **KEEP.** |
| 2 | Service accordion (6) | **KEEP.** This is the single home for service detail. **ADD ⏳** a "Seen in" line per service linking to the case studies that used it (once the case studies list their services). |
| 3 | Engagement models (Project · Retainer · Sprint) | **KEEP.** **ADD** a "Good for…" line on each that ties back to the three audiences. |
| 4 | **FAQ** | **ADD ⏳.** About 6 questions: timeline, how pricing works (no figures), code ownership, working with clients abroad (time zones, payments), support after launch, taking over an existing system. **The team writes the answers**; we never guess terms. |
| 5 | Closing "get in touch" row | **REMOVE.** The footer band does this. |

### Work (`/projects`): "Have you built something like mine, and did it work?"

| # | Section | Decision |
|---|---|---|
| 1 | Header | **KEEP**, with the intro rewritten to be factual. |
| 2 | Alternating project rows | **KEEP** the layout. **CHANGE ⏳**: each row gains *client · industry · year* and a **one-line outcome** from the write-up, and the whole row links to its case study. |
| 3 | Closing call to action | **REMOVE.** The footer covers it. |

**Case study (`/projects/[slug]`):** the structure is already built (story, results,
testimonial, screens, prev/next). Every section stays hidden until it has content, so the
work here is **filling it ⏳** from the write-ups. **ADD** links from "Services used" to their
rows on the Services page.

### About: "Who are these people, and can I trust them with my project?"

| # | Section | Decision |
|---|---|---|
| 1 | Header + story | **CHANGE ⏳.** Replace the generic paragraph with the team's real story: how it started, why Dipolog, what they care about. |
| 2 | Outline-word marquee | **REMOVE.** Decorative filler; Home already has a marquee. |
| 3 | Big image | **REMOVE now** (old MYKT business cards). **ADD ⏳** a real team/workspace photo when it arrives. |
| 4 | Values (4) | **KEEP.** |
| 5 | Team roster | **KEEP**, and **ADD ⏳** real photos. The cursor-following circle can show each person's face. |
| 6 | **Based in Dipolog, working everywhere** | **ADD.** A short block on the time zone (PHT), working hours, how remote collaboration runs, and the fact that overseas clients already work with us. It moves the "location story" here, where it builds trust. |
| 7 | Closing call to action | **REMOVE.** The footer covers it. |

### Contact (was Location): "How do I start, and what happens after I do?"

| # | Section | Decision |
|---|---|---|
| 1 | Header: "Start a project" + reply promise | **CHANGE.** Keep "back within one business day" **only if the team confirms it is true**. |
| 2 | **The form** | **CHANGE: move it to the top**, side by side with the header on desktop. Today it sits below a giant city name and a map. |
| 3 | **What happens next** | **ADD.** Three steps: we reply → a short call → a written proposal. *(The team confirms the real steps.)* |
| 4 | Details: Dipolog City, hours + live clock, map | **KEEP**, smaller. The giant typographic city name is **REMOVED**; it was filling the space a missing email address left. |

### Footer (every page)

- **KEEP** the call-to-action band. It becomes the **one** closing call to action site-wide.
- **KEEP** the columns and the giant wordmark.
- **REMOVE** the "Developed by R Ally's Tech · for R Ally's Tech" line. It reads like
  leftover template text.
- **CHANGE** the service names in the footer to link to their rows on Services.

### Products · Careers · Blog

**No change.** They stay hidden until the CMS is back on and something is published. Job
seekers aren't a target audience right now.

---

## 5. Keycaps: every one gets a job

Today, small decorative keys sit beside buttons on most pages. With the per-page call-to-
action rows removed, those disappear on their own. Instead, the keycaps do things:

| Where | Key | Job |
|---|---|---|
| Hero | gold | the signature; pressing it goes to Contact |
| Home services | 6-key macropad | shows which service you're reading; click to jump |
| Services header | onyx | cycles through the six service icons |
| **Contact form** | gold | **ADD:** the **Send** button is a keycap: press to send |
| Footer band | ivory | "Start a project" → Contact |

That keeps keycaps on every page while removing the purely decorative ones.

## 6. Build order

**A. No material needed — ✅ DONE 2026-11-04** (branch `redesign-v2`): remove Selected Work, About's marquee and the
MYKT image, the per-page call-to-action rows and the "Developed by" line. Shrink the Home
services to one line each. Rename Location → Contact with a redirect and put the form first.
Rename Projects → Work in the nav. Change the hero's second button. Give the keycaps their
jobs (§5).

**B. Copy I draft, the team approves — ✅ DONE 2026-11-04** (see `part-b-copy.md`): Who we build for · the "Good for…" lines on the
engagement models · Based in Dipolog · What happens next.

**C. Waits on the team's material ⏳:** the case studies (feeds Work rows, case study pages,
"Seen in" links and the Proof band), team and workspace photos, the About story and the FAQ
answers.

## 7. Open decisions

1. **Filipino pages.** The switcher is gone, but `/fil/...` still exists and nothing links to it.
   *Recommendation:* leave it in place for now; it costs nothing, and we can decide when the
   content settles.
2. **Nav labels:** "Work" and "Contact". *Recommended above, confirm.*
3. **Keycap jobs (§5)**, especially the keycap Send button on the form.
