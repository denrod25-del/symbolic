# Service-Company CRM — Competitive Research & Build Roadmap

Research date: 2026-06-22. Scope: QuoteIQ, ServiceTitan, Jobber, Housecall Pro,
plus broad field-service market trends. Purpose: inform a new QuoteIQ-style CRM
for broad home services (50+ trades), built on the existing `/crm` module.

> Confidence is noted per claim. Pricing for ServiceTitan is third-party
> estimated (it publishes none). All other pricing is from vendor pages /
> aggregators and may drift; re-verify before quoting publicly.

---

## 1. TL;DR

- **The category is mature on basics and immature on trust.** Every serious
  product has scheduling, invoicing, payments, texting, and a mobile app. What
  users actually complain about is **pricing opacity, hidden add-ons, payment
  lock-in, billing/cancellation abuse, weak Android apps, and shallow
  reporting.** That is the opening.
- **QuoteIQ's wedge is bundled AI + flat, no-per-user pricing.** Its weakness is
  product maturity: buggy app, thin web portal, mixed support reputation.
- **Table stakes for 2026:** mobile offline-first, automated scheduling/dispatch,
  quoting→invoice→payment flow, two-way SMS, QuickBooks sync, basic KPI
  dashboards, self-service online booking, automated reminders/reviews.
- **Differentiators in 2026:** AI estimating (from photos/aerial), AI call
  answering / receptionist, consumer financing at point of sale, weighted
  pipeline forecasting, review automation, native Stripe/Twilio/Google LSA.
- **Where to win:** transparent flat pricing, painless data export (anti
  lock-in), an Android app that is as good as iOS, reporting people don't have
  to dump to Excel, and AI bundled rather than paywalled.

---

## 2. Feature & pricing comparison matrix

Legend: ✅ strong / native · 🟡 partial, add-on, or higher-tier · ❌ absent

| Capability | QuoteIQ | ServiceTitan | Jobber | Housecall Pro |
|---|---|---|---|---|
| Quoting / estimates | ✅ + AI estimator, InstaQuote | ✅ Good-Better-Best | ✅ interactive quotes | ✅ visual quotes |
| Scheduling & dispatch | ✅ daily route opt | ✅ best-in-class, Dispatch Pro AI | ✅ + built-in routing | ✅ (no built-in routing) |
| Invoicing | ✅ | ✅ | ✅ | ✅ (hard to customize) |
| Payments | ✅ card/ACH/tap | ✅ | ✅ 2.9%+$0.30 / 1% ACH | ✅ 2.59–3.49% |
| Consumer financing | 🟡 | ✅ | 🟡 | ✅ Wisetack |
| CRM / contacts | ✅ ClientHub | ✅ deep | ✅ | ✅ |
| Sales pipeline | 🟡 (Elite+) | ✅ + missed-revenue | 🟡 basic | 🟡 basic |
| Two-way SMS / inbox | ✅ in-app calling too | 🟡 Marketing Pro add-on | 🟡 Grow tier+ | ✅ (per-msg fees) |
| Automations / workflows | ✅ + AI AutoReply | ✅ deep | ✅ quote/invoice follow-ups | ✅ marketing-centric |
| AI estimating | ✅ MapMeasure Pro | 🟡 | ❌ | 🟡 |
| AI call answering | ✅ Virtual Call Team | ✅ Marketing Pro | 🟡 AI Receptionist $99/mo | 🟡 CSR AI add-on |
| Reporting / analytics | 🟡 improving | ✅ 30+, deep | 🟡 "very basic" | 🟡 40+ but shallow |
| Mobile (iOS / Android) | 🟡 buggy, Android worse | 🟡 iOS ok, app ~3.0★ | 🟡 slowness/crashes, no offline | iOS 4.5★ / Android 3.3★ |
| QuickBooks sync | ✅ two-way | ✅ | 🟡 one-way, sync bugs | 🟡 Essentials+ |
| Zapier / API | ✅ + webhooks | 🟡 top tier only | ✅ Connect+ | ✅ MAX for API |
| Inventory | 🟡 Elite+ | ✅ (overcomplex) | ❌ | 🟡 add-on |
| Target size | 1–50 (solo→SMB) | 10–100+ (enterprise) | 1–15 (SMB) | 1–20 (SMB) |
| Entry price | **$29.99/mo flat** | ~$245–398/tech/mo | $39/mo (+$29/user) | $79/mo |
| Per-user fees | **None (flat)** | Per-tech | Yes ($29/user) | Yes ($35 over cap) |
| Contract / lock-in | None | 12–36 mo + exit fees | Month-to-month | Monthly; cancel complaints |
| Setup fee | None | $5k–$50k | None | None |
| Review ratings | 4.7★ app stores (4,100+) | G2 4.5 / BBB 1.0 | G2 4.6 / Trustpilot 4.3 | Capterra 4.7 / Trustpilot 2.9 |

---

## 3. Per-product strengths & weaknesses

### QuoteIQ — the baseline you're modeling
**Strengths:** Flat pricing with **no per-user fee** ($29.99–$699/mo, 5 tiers);
**AI bundled on every plan** via IQ credits (AI Estimator, AI Autopilot ~35 NL
tools, Virtual Call Team 24/7 call answering); ClientHub unified SMS/email/photo
thread; mobile-first; InstaQuote/InstaSchedule self-service (claims +40%
conversion); fast quote-to-cash. ~40,000 users, 4.7★ across 4,100+ app reviews.
**Weaknesses:** App stability complaints (crashes at login, frequent logouts,
"texting invoices broken for years"), Android worse than iOS; thin web portal;
"feels like beta"; **owner/support reputation issues on Reddit** (confrontational,
asks for login credentials); generic one-size-fits-all workflows weak for niche
trades; daily-only route optimization (no weekly batch). Confidence: pricing/
features HIGH; support-reputation MEDIUM (small sample).

### ServiceTitan — the enterprise ceiling
**Strengths:** Best-in-class dispatch (G2 8.9/10) with ML Dispatch Pro; deepest
reporting (30+ reports, missed-revenue, CSR scorecards); full inventory,
payroll/timesheets, job costing; comprehensive all-in-one; G2 4.5, 89% recommend.
**Weaknesses:** **Cost** — ~$245–398/tech/mo + **$5k–$50k onboarding** + add-ons
(Marketing Pro ~$2k/mo); Year-1 for 5 techs ≈ $57k–67k. **3–12 month
implementations** (BBB complaint: "NEVER BEEN ONBOARDED"); steep learning curve;
**12–36 mo contracts with painful early-termination fees**; documented **data-
export/lock-in** pain; BBB 1.0★. Explicitly "not optimized for ≤3 techs."
Confidence HIGH.

### Jobber — the SMB favorite
**Strengths:** Ease of use; excellent scheduling + **built-in route
optimization**; strong automation (quote/invoice follow-ups); Jobber Copilot AI
coach; good support (majority); entry $39/mo; 300k+ users, G2 4.6.
**Weaknesses:** **Per-user creep** ($29/user) + payment processing often the
biggest line item; **two-way SMS gated to Grow tier** (~doubles cost); marketing
($79) and AI Receptionist ($99) are add-ons; **QuickBooks sync unreliable**
(duplicate/invoice-number conflicts — most common complaint); **reports "very
basic," no job costing**; **no inventory**; **no offline mobile**; all-or-nothing
permissions; scaling pain past ~20–30 techs. Confidence HIGH.

### Housecall Pro — marketing-strong, trust-weak
**Strengths:** Very easy; strong **iOS app (4.5–4.6★)**; built-in marketing
(email/SMS/**postcards** $0.86) and AI team (CSR/Analyst/Coach) across plans;
**Wisetack consumer financing**; online booking; 45k+ businesses; Capterra 4.7.
**Weaknesses:** **Hidden-cost stacking** — functional 5-tech deploy reportedly
**8–9× advertised price** (Sales Proposals $40, GPS $20/veh, Price Book $149,
processing 2.59–3.49%); **billing/cancellation complaints** (continued billing
after cancel; BBB 21% resolution rate, 2.07★); **payment holds 48h–7d** + monthly
caps; **Android app 3.3★**; **phone support only on MAX ($329)**; reporting needs
Excel export; **no built-in routing**; Trustpilot fell 3.7→2.9. Confidence HIGH.

---

## 4. The cross-cutting weak points (your opening to do better)

These complaints recur across **all four** — fix them and you differentiate:

1. **Pricing opacity & hidden add-ons** — #1 complaint category (~40% of reviews
   mention price/lock-in). Win with **flat, all-in, no-per-user pricing** (QuoteIQ
   already proves the appetite) and an honest "what you pay" page.
2. **Payment lock-in & holds** — processing fees are often the biggest bill;
   holds/caps strangle cash flow. Win with transparent processing, no surprise
   holds, and **bring-your-own-processor** (Stripe Connect) optionality.
3. **Billing/cancellation abuse** — self-serve cancel, no dark patterns, prorated
   exits. Cheap to build, huge trust signal vs. Housecall Pro / ServiceTitan.
4. **Data lock-in** — one-click full export (contacts, jobs, quotes, invoices,
   history) as a feature, not a fight. Anti-ServiceTitan positioning.
5. **Weak Android & no offline** — offline-first mobile with conflict resolution
   is still a real gap (Jobber has no offline; HCP Android is 3.3★).
6. **Shallow reporting** — users dump to Excel everywhere. Native **job
   costing + marketing attribution + pipeline forecasting** is differentiated.
7. **Support quality** — every vendor has support complaints; responsive,
   in-app, non-gated support is a moat for an underdog.

---

## 5. Feature tiers for the new product

**Table stakes (must ship to be credible):**
mobile offline-first app · scheduling & dispatch · quoting/estimates ·
invoicing · integrated payments · two-way SMS + email inbox · contacts/CRM ·
automated reminders & review requests · self-service online booking ·
QuickBooks sync · basic KPI dashboard.

**Differentiators (where to invest to stand out):**
AI estimating from photos/aerial · AI receptionist / call answering · consumer
financing at point of sale · weighted pipeline forecasting · job-costing &
marketing-attribution reporting · native Stripe / Twilio / Google Local Services
Ads · genuinely good Android + offline · transparent flat pricing & one-click
data export.

**Avoid early (enterprise weight, low SMB ROI):**
deep inventory/PO management · payroll engine · multi-location P&L ·
skill-based ML routing · heavy customization frameworks.

---

## 6. Map to the existing repo (`/crm`)

**Already built:** contacts · 5-stage pipeline (lead→contacted→qualified→won/
lost) · calendar/booking · SMS+email inbox (simulated/Resend/Twilio) ·
trigger→action automations with run log. This already covers a meaningful slice
of table stakes — notably the inbox + automations that competitors gate to
higher tiers.

**Critical gaps vs. table stakes (build next, in order):**

1. **Quoting / Estimates** — the namesake feature; nothing exists today.
   Line items, taxes, options (Good-Better-Best), accept/sign, quote→invoice.
2. **Invoicing** — convert accepted quotes; statuses; reminders (reuse the
   existing automation + messaging layers).
3. **Payments** — Stripe integration; payment links via the existing inbox;
   reconcile to invoices.
4. **Online booking** — public self-service page feeding the calendar
   (InstaSchedule equivalent).
5. **Reporting depth** — job costing + revenue/pipeline dashboards beyond the
   current KPI tiles.

**Differentiators that fit the existing architecture cheaply:**
- **AI estimator** — generate quote line items from a photo + scope; slots onto
  the new Quotes module.
- **AI inbox replies / draft-and-send** — extends the existing messaging layer.
- **Review-request automation** — a new trigger/action in the existing workflow
  engine (you already have the primitives).
- **One-click export & transparent pricing** — positioning wins, low build cost.

**Suggested phasing:**
- **Phase 1 (table stakes):** Quotes → Invoices → Payments (Stripe). Unlocks
  quote-to-cash, the core loop.
- **Phase 2 (acquisition):** Online booking + review-request automation +
  reporting/job-costing.
- **Phase 3 (differentiation):** AI estimator + AI inbox assist + consumer
  financing; harden mobile/offline.

---

## 7. Sources

QuoteIQ: myquoteiq.com (pricing, features, Feb-2026 update, reviews),
Capterra, SoftwareAdvice, ContractorToolStack, ServiceBusinessAcademy,
App Store / Google Play reviews.
ServiceTitan: servicetitan.com/features, G2 (345 reviews), Capterra, BBB,
fieldcamp.ai, projul.com, Contrary Research, Sacra, fieldpulse.com.
Jobber: getjobber.com (features/pricing/help), G2, Capterra, Trustpilot,
serviceagent.ai, nuacom.com, fieldcamp.ai, PRNewswire (Copilot).
Housecall Pro: housecallpro.com (pricing/features/help), Capterra, G2,
Trustpilot, BBB, projul.com, tooleduppro.com, fieldcamp.ai.
Market trends: Gartner Peer Insights, Capterra/G2 category pages, IFS,
BuildOps & FieldProxy pricing guides, Field Nation 2026 trends, BDR home-service
trends, Wisetack, ServiceTitan AI blog, GMInsights market sizing.

Full per-claim URL lists are retained in the research notes backing this report.
