# AI UGC Content Tool — Competitive Research & Build Brief

Research date: 2026-07-01. Subject: Yorby (yorby.ai / YK Labs Inc.). Purpose:
inform a new Yorby-style AI UGC content tool, built as a standalone marketing
page (`/remixly`) in this repo.

> **Access constraint:** this environment's network egress policy blocks
> direct requests to `yorby.ai` and `web.archive.org` (confirmed via direct
> `curl`, 403 from the policy proxy — not the site itself). Everything below
> comes from search-engine result snippets and third-party pages that
> reference Yorby, not from the live HTML. Treat quoted phrases as
> search-summarized paraphrases unless marked as a direct quote, and
> re-verify before relying on any figure below.

---

## 1. TL;DR

- **Yorby pivoted products.** It launched as an AI mock-interview / hiring-
  screening tool, then repositioned as an AI UGC (user-generated content)
  video tool for marketers — current homepage title tag: **"Go Viral on
  Social Media."** This brief targets the current, live product.
- **Core loop:** upload a product demo video + an avatar photo → AI produces
  a ready-to-post UGC-style script/video in minutes, no creators or film
  crew required.
- **Open contradiction to flag:** one third-party review describes Yorby as
  "a research and scripting tool, not a video editor" — i.e. it may generate
  scripts/hooks rather than a finished video file, contradicting the
  marketing framing. Build the clone around the scripting/remix engine,
  which is corroborated by multiple sources, and treat full video synthesis
  as an unconfirmed stretch claim.
- **Named features (repeated across 3+ sources):** AI Content Remixer,
  Viral Database, Competitor Tracking, AI Content Coach.
- **Pricing (single-source, moderate confidence):** a "Solo" tier around
  $33/mo, no free trial, 7-day money-back guarantee; a "Startup" tier adds
  human strategist support (unlimited expert messaging, weekly calls).
- **Target audience:** solo creators, DTC/software brands, and small
  marketing agencies — software-plus-service hybrid rather than pure
  self-serve SaaS.

---

## 2. Product history

### Era 1 — AI interview prep / recruiting screener (original)
Dual-sided positioning: job seekers practiced mock interviews with AI
feedback, while a "Yorby AI Recruiter" B2B surface conducted structured
candidate screening at scale for employers. Content strategy relied on
programmatic per-job-title SEO pages ("Prep Cook Practice Interview
Questions," etc.). No verified pricing or exact homepage copy surfaced for
this era — not carried into the clone.

### Era 2 — AI UGC content tool (current, live at yorby.ai)
Founders (Andrew Meng, ex-banker turned marketing-agency operator and
creator; a co-founder referred to only as Thomas, ex-Google engineer)
describe the pivot as driven by their own pain running a content agency.
Pre-seed funded (Day Zero, LAUNCH accelerator cohort LA36). This is the
product this clone targets.

---

## 3. Feature breakdown to clone

| Feature | Description (aggregated) | Confidence |
|---|---|---|
| AI Content Remixer | Ingest any video (own or competitor's), reverse-engineer hook/pacing/structure, rewrite for the user's brand voice | Medium-high (3 sources) |
| Viral Database | Curated, filterable library of high-performing posts by platform/niche/format | Medium |
| Competitor Tracking | Follow a handle, get alerted when one of their posts trends | Medium |
| AI Content Coach | On-demand feedback on scripts/hooks/captions | Medium |
| Human strategist add-on (higher tier) | Weekly calls, dedicated strategist, unlimited messaging | Medium |

---

## 4. Positioning for the clone

Branded as **Remixly** (original name — avoids reusing Yorby's trademark,
consistent with this repo's existing pattern of "-style" clones such as the
QuoteIQ-style CRM). Landing page only for this pass: hero, how-it-works,
feature grid, pricing, and a closing CTA — matching the scope of the
request. No backend (video processing, auth, billing) is implemented here;
that would be a follow-up phase, same as the CRM build was staged across
multiple PRs.

**Pricing for the clone** (own numbers, inspired by but not asserting
Yorby's actual prices given single-source confidence): Solo $29/mo,
Studio $99/mo with strategist support — mirrors the two-tier
self-serve-vs-managed structure without claiming Yorby's exact figures.

---

## 5. Sources

yorby.ai (title/meta only, via search snippet), yorby.ai/about,
aifounderkit.com/ai-tools/yorby-ai-content-remixer, designrevision.com/blog/
best-ai-ugc-tools, etooly.eu/tools/yorby, crunchbase.com/organization/
yorby-ai, launchaccelerator.co/la36/yorby-ai, LinkedIn posts by
linkedin.com/in/andrewrmeng, netinfluencer.com profile of Andrew Meng,
web.yorby.ai/blog (per-role practice question pages, prior era).
