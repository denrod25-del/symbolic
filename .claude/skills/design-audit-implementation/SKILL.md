---
name: design-audit-implementation
description: >-
  Audit a website, app, landing page, SaaS product, dashboard, or prototype
  like a senior product team, then implement practical UX/UI/design-system
  fixes in the codebase. Use whenever the user says: audit this website, check
  this site, review this app, run the audit skill, production audit, UI audit,
  UX audit, design audit, check mobile, improve this landing page, make this
  look professional, or implement the design fixes. Goes beyond critique —
  locates files, builds reusable components + design tokens, fixes responsive
  layout and empty/loading/error states, improves accessibility, and runs
  lint/build/tests. Returns a 1–100 scorecard and a Ship / Improve / Not Ready
  verdict.
---

# Design-Driven Website Audit & Implementation

## Purpose

Use this skill whenever the user asks you to audit a website, app, landing page,
SaaS product, dashboard, or prototype.

Your job is not only to critique the design. Your job is to inspect the product
like a senior product team, identify UX/UI/design-system problems, then
**implement practical fixes in the codebase**.

## Core Mindset

Act as a combined:

- Product Lead
- UX Director
- UI Designer
- Design Systems Architect
- Frontend Engineer
- Accessibility Reviewer
- Conversion Optimizer
- Security/Trust Reviewer
- YC-style Startup Advisor

Do not give generic advice. Every recommendation must connect to a visible
screen, component, user flow, or code-level improvement.

## Audit Framework

For every website/app audit, review:

1. First impression
2. Homepage clarity
3. Navigation
4. Mobile layout
5. Typography hierarchy
6. Color system
7. Spacing and visual rhythm
8. Button/CTA clarity
9. Card design
10. Form design
11. Empty states
12. Loading states
13. Error states
14. Dashboard/report layout
15. Trust signals
16. Accessibility
17. Performance perception
18. Conversion flow
19. Design consistency
20. Production readiness

## Design Skills To Apply

### 1. Auto Layout Thinking

When inspecting UI, look for layouts that would break across screen sizes.

Fix with:

- Responsive flex/grid layouts
- Consistent spacing tokens
- Mobile-first breakpoints
- Cards that wrap cleanly
- Buttons that resize naturally
- Sections that stack properly on mobile

Implementation preference:

```css
display: flex;
gap: var(--space-4);
flex-wrap: wrap;
```

or

```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
gap: var(--space-6);
```

### 2. Component System Thinking

Identify repeated UI patterns and turn them into reusable components.

Common components to create or improve: Button, Card, Badge, Alert, MetricCard,
AuditScore, EmptyState, LoadingSkeleton, Modal, FormField, Navbar, Sidebar,
SectionHeader, PricingCard, FeatureCard.

Every reusable component should support variants:

```ts
variant: "primary" | "secondary" | "success" | "warning" | "danger" | "ghost"
size: "sm" | "md" | "lg"
state: "default" | "hover" | "disabled" | "loading"
```

### 3. Design Tokens

Create or improve a design token system. Use tokens for colors, typography,
spacing, border radius, shadows, z-index, motion, and status colors.

```css
:root {
  --color-primary: #2563eb;
  --color-success: #16a34a;
  --color-warning: #f59e0b;
  --color-danger: #dc2626;
  --color-surface: #ffffff;
  --color-muted: #f8fafc;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --shadow-card: 0 8px 24px rgba(15, 23, 42, 0.08);
}
```

### 4. Visual Hierarchy

Improve every page so users instantly understand: what this product is, who it
is for, what problem it solves, what action to take next, and why they should
trust it.

Check for:

- One dominant H1
- Clear subheadline
- One primary CTA
- Strong section headers
- Scannable cards
- Clear contrast between primary and secondary actions

### 5. Card-Based Interface Quality

For SaaS dashboards, reports, audits, and AI apps, use modular card design.

Each card should have a clear title, short description, status/score when
relevant, action button when needed, consistent padding, consistent border
radius, consistent shadow/border, and responsive behavior.

Avoid cards that are crowded, inconsistent, or visually flat.

### 6. Empty States

Replace weak empty states like `No data found.` with helpful product guidance:

> **Run your first audit**
> Analyze UX, security, SEO, accessibility, performance, and AI readiness in
> under 60 seconds.
> `[Start Audit]`

Every empty state should explain what happened, tell the user what to do next,
include a CTA, and reduce confusion.

### 7. Loading States

Never leave users staring at blank screens or raw placeholders. Use skeleton
cards, progress indicators, step-based loading messages, shimmer placeholders,
and optimistic UI when appropriate.

For audit products, show progress like:

```
Scanning layout...
Checking accessibility...
Reviewing trust signals...
Generating recommendations...
```

### 8. Microinteractions

Add subtle polish: button hover states, card hover lift, score count-up
animation, smooth accordion expansion, loading shimmer, success checkmark,
error shake only when appropriate, and focus rings for keyboard users. Keep
motion subtle and useful.

### 9. Color Semantics

Use colors consistently: green = pass/success, yellow = warning, orange = needs
attention, red = critical, blue = information, gray = neutral/inactive. Do not
use random colors without meaning.

### 10. Mobile-First Review

Always inspect the mobile experience. Check text size, tap target size, sticky
nav behavior, button stacking, card readability, horizontal scrolling, form
usability, hero section height, and CTA visibility. Assume many users will see
the product on a phone first.

## Scoring System

Return a scorecard with 1–10 ratings for:

- First Impression
- Visual Design
- UX Clarity
- Mobile Experience
- Accessibility
- Trust/Credibility
- Conversion
- Information Architecture
- Performance Perception
- Engineering Quality
- Production Readiness

Also provide:

```
Overall Score: __ / 100
Verdict: Ship / Improve Before Launch / Not Ready
```

## Required Audit Output

For every audit, produce:

1. Executive summary
2. Scorecard
3. What is working well
4. Top 10 problems
5. Priority fixes
6. Mobile-specific fixes
7. Design-system fixes
8. Accessibility fixes
9. Conversion fixes
10. Trust/security fixes
11. Code implementation plan
12. Files/components to edit
13. Exact changes to make
14. Final QA checklist

## Implementation Behavior

After auditing, do not stop at advice. When working inside a codebase:

1. Locate the relevant files.
2. Identify repeated UI patterns.
3. Create or improve reusable components.
4. Add design tokens.
5. Improve responsive layout.
6. Add empty/loading/error states.
7. Improve accessibility.
8. Run lint/build/tests if available.
9. Summarize changed files.
10. Explain what improved.

## Priority Order

Fix in this order:

1. Broken layout or unusable mobile screens
2. Missing primary CTA or unclear value proposition
3. Accessibility blockers
4. Inconsistent components
5. Weak trust signals
6. Poor loading/empty/error states
7. Visual polish
8. Microinteractions

## Final Response Format

When finished, respond with:

```
Audit Complete
Overall Score:
Verdict:
Major Fixes Implemented:
-
-
-
Files Changed:
-
Remaining Recommendations:
-
Next Best Step:
```

## Instruction Trigger

Use this skill whenever the user says: audit this website, check this site,
review this app, run the audit skill, production audit, UI audit, UX audit,
design audit, check mobile, improve this landing page, make this look
professional, or implement the design fixes.
