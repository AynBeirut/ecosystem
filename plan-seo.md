# Grabio SEO Build Plan
**Target:** Full SEO platform across 9 modules
**Timeline:** ~3 months (12 weeks)
**Already done:** Visitor tracking, traffic analytics, GSC integration, Apache log parsing

---

## Phase 1 — Keyword Engine (Week 1–2)
**Why first:** Everything else depends on knowing what keywords to target.
No content plan, no competitor gap, no reporting goals without this.

**What to build:**
- New admin page: `/admin/seo-keywords`
- CRUD table: keyword text, monthly volume, keyword difficulty (KD), assigned page URL, intent stage (Awareness / Consideration / Decision), status (active/paused)
- Filter/sort by intent stage, KD, volume, status
- CSV import (drag-and-drop or file picker)
- Manual ranking position input per keyword (no SerpAPI for now)
- Flag system: auto-highlight keywords with KD < 40 AND volume 1,000–10,000 as "priority"
- Nav entry in AdminDashboard

**Deliverable:** Admin can manage 100 keywords with intent stages and priority flags.

---

## Phase 2 — Technical Health Monitor (Week 2–3)
**Why second:** Fast ranking wins — fix what's already broken before building more content.
Phase 5 Apache logs already show 826 broken 404s. This turns that data into actionable tasks.

**What to build:**
- New admin page: `/admin/seo-technical`
- PageSpeed Insights API integration: check homepage + top 5 pages weekly
  - Track per page: LCP, CLS, INP, mobile score, desktop score
  - Alert badge when any page fails: LCP > 2.5s, CLS > 0.1, mobile < 70
- Broken link list: read from `seo_audits/grabio_space` (already in Firestore from Phase 5)
  - Display top 404 URLs with hit counts
  - Mark each as "fixed" or "redirect added"
- Redirect audit: flag chains of 2+ redirects (manual input for now)
- GSC coverage errors: pull de-indexed or excluded pages from GSC API (already connected)
- Nav entry in AdminDashboard

**Deliverable:** Admin sees health score, broken links, and CWV per page in one place.

---

## Phase 3 — Content Engine (Week 3–5)
**Why third:** Biggest long-term ranking driver. Builds topical authority that compounds over months.

**What to build:**
- New admin page: `/admin/seo-content`
- Content calendar table: title, target keyword (linked to Phase 1), type (blog/guide/landing/FAQ), intent stage, status (Idea → Draft → Review → Published), publish date, assigned URL
- On-page SEO checklist per content item: H1 ✓, meta title ✓, meta description ✓, word count, internal links count, schema type, intent stage match ✓
- Pillar + cluster map view: visual list of pillar pages, each expandable to show assigned cluster articles and their status
- Content gap alert: flag any pillar with fewer than 5 cluster articles assigned
- AI draft button: call OpenAI API to generate a structured draft
  - Prompt enforces: H1 → H2s → body → FAQ section → meta title → meta description → suggested internal links → schema type suggestion
  - Decision-intent pages: prompt includes CTA and lead capture section
- Export draft as HTML or copy to clipboard
- Nav entry in AdminDashboard

**Deliverable:** Admin can plan, draft, and track all content in one place with AI assist.

---

## Phase 4 — Reporting Dashboard (Complete Module 9) (Week 5–6)
**Why fourth:** The foundation (Phase 2-3-4) is in place — now close the loop on visibility.
The current AdminSEOAnalytics is partial. This completes it.

**What to add to existing `/admin/seo-analytics`:**
- Keyword rankings summary tab: total tracked, in top 3 / top 10 / top 20 (from Phase 1 data)
- Intent stage breakdown: how many Awareness/Consideration/Decision keywords are active
- Technical health tab: pull CWV snapshot from Firestore (Phase 2 data)
- Content pipeline tab: pieces published this month, in draft, in review (Phase 3 data)
- Month-over-month trend chart: organic sessions actual vs simple target line (set manually)
- PDF export button: generate a one-page summary PDF in the browser (using browser print or a PDF lib)
  - Sections: traffic summary, top pages, top keywords, content published, broken links count, health score

**Deliverable:** One dashboard that shows the full SEO picture month-over-month.

---

## Phase 5 — Competitor Gap Engine (Week 7–8)
**Why fifth:** Once content engine is running, feed it with competitor intelligence to prioritize what to write next.

**What to build:**
- New admin page: `/admin/seo-competitors`
- Competitor list: add domain, label (e.g. "Competitor A"), date added
- Manual keyword gap input: paste a list of keywords a competitor ranks for — platform compares against Phase 1 keyword list and flags gaps
- Gap keywords table: keyword, competitor that ranks for it, gap status (New / Added to plan / Rejected)
- One-click: "Add to keyword engine" — creates a new keyword record in Phase 1 with status "suggested from competitor"
- Future hook: SerpAPI integration can be plugged in here when ready
- Nav entry in AdminDashboard

**Deliverable:** Admin can log competitor keywords and feed gaps directly into the content pipeline.

---

## Phase 6 — AEO Module (Week 8–9)
**Why sixth:** Grabio is entering a world where ChatGPT and Perplexity answer buyer questions. This captures that channel.

**What to build:**
- New admin page: `/admin/seo-aeo`
- FAQ bank: CRUD for Q&A pairs — question, answer, assigned page, schema added (yes/no)
- FAQPage JSON-LD generator: select FAQs → generate schema → copy button
- AEO content checklist (per content item from Phase 3):
  - Answer in first sentence ✓
  - Answer under 50 words (word count shown)
  - Question in H2 tag ✓
- AI citation log: manual log — date, platform (ChatGPT/Perplexity/Gemini), query used, cited URL, notes
- Featured snippet tracker: keyword → who holds it (manual input for now)
- Structured data validator: paste URL → fetch page → validate JSON-LD schema blocks
- Nav entry in AdminDashboard

**Deliverable:** Admin manages FAQ schema, tracks AI citations, and validates structured data.

---

## Phase 7 — GEO Module (Week 9–10)
**Why seventh:** Local search is important for grabio (Lebanon-focused), but lower urgency than content and technical.

**What to build:**
- New admin page: `/admin/seo-geo`
- Per-city dashboard: Beirut / Tripoli / Sidon / other — track active pages, keyword count, estimated traffic share (manual input)
- LocalBusiness JSON-LD generator: fill in Name, Address, Phone → generate schema → copy button
- NAP consistency panel: define official Name / Address / Phone → flag if entered differently anywhere else (manual comparison for now)
- Citation tracker: list of Lebanese/regional directories → status per directory (Listed / Not listed / Needs update)
- Google Business Profile task checklist with completion status
- Entity SEO checklist: Wikipedia mention, Knowledge Panel triggered (yes/no manual tracking)
- Nav entry in AdminDashboard

**Deliverable:** Admin tracks and manages local search presence from one place.

---

## Phase 8 — Programmatic SEO Engine (Week 10–12)
**Why eighth:** High-impact but complex. Needs Phases 1–3 mature first (keywords, content, health) before scaling to hundreds of pages.

**What to build:**
- New admin page: `/admin/seo-programmatic`
- Template builder: create page templates with variable slots
  - e.g. "[Category] stores in [City]", "[Product type] near [Area]"
- Seed data tables: cities, areas, categories, store types (all editable)
- Page generator: select template + seed data → preview generated pages
- Each page auto-gets: unique title tag, meta description, H1, body text (AI-varied), FAQ section with FAQPage schema, canonical URL
- Publish queue: review generated pages before publishing (manual mode) or auto-publish (automation mode hook)
- Dead page monitor: pages with 0 sessions after 60 days → auto-flag for refresh or deletion (reads from `seo_events`)
- Sitemap: auto-regenerate `/sitemap.xml` on every publish
- Volume tracker: pages live vs monthly targets
- Nav entry in AdminDashboard

**Deliverable:** Admin can generate and publish hundreds of SEO pages from templates at scale.

---

## Phase 9 — Link Building Tracker (Week 11–12, parallel with Phase 8)
**Why last:** Offsite — doesn't depend on anything internal. Simple to build, can run in parallel.

**What to build:**
- New admin page: `/admin/seo-links`
- Prospect list: domain, DR score (manual), type (directory / guest post / PR / partner), status (Prospecting / Contacted / Negotiating / Acquired / Rejected), notes
- Acquired links log: domain, linking URL, target URL, anchor text, DR, date acquired
- Monthly target: set target (e.g. 5 links/month) → dashboard shows progress bar
- Dead link checker: for each acquired link, store last HTTP status code + last checked date — manual recheck button
- Export to CSV
- Nav entry in AdminDashboard

**Deliverable:** Admin tracks the full outreach pipeline and acquired backlinks in one place.

---

## Summary Timeline

| Week | Phase | Admin Page Added |
|------|-------|-----------------|
| 1–2 | Phase 1 — Keyword Engine | `/admin/seo-keywords` |
| 2–3 | Phase 2 — Technical Health | `/admin/seo-technical` |
| 3–5 | Phase 3 — Content Engine | `/admin/seo-content` |
| 5–6 | Phase 4 — Reporting (complete) | `/admin/seo-analytics` (updated) |
| 7–8 | Phase 5 — Competitor Gap | `/admin/seo-competitors` |
| 8–9 | Phase 6 — AEO | `/admin/seo-aeo` |
| 9–10 | Phase 7 — GEO | `/admin/seo-geo` |
| 10–12 | Phase 8 — Programmatic SEO | `/admin/seo-programmatic` |
| 11–12 | Phase 9 — Link Building | `/admin/seo-links` |

---

## What's Already Done (Pre-Plan)

| Item | Status |
|------|--------|
| Visitor tracking on all 6 public pages | ✅ Live |
| Firestore seo_events collection | ✅ Live |
| AdminSEOAnalytics dashboard (traffic, pages, leads, funnel) | ✅ Live |
| AdminSEOAudit + Google Search Console OAuth | ✅ Live |
| grabio.space verified in GSC | ✅ Live |
| VPS Apache log parser + daily cron | ✅ Live |
| SEOHead.tsx on all public pages (meta, OG, schema) | ✅ Live |
