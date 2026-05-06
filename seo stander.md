# SEO Standard Reference

TECHNICAL TASK — Automated SEO Platform for GJ Properties
==========================================================

PROJECT TYPE: Full-stack web application — automated SEO management platform
STACK: Builder's choice. Choose what you are most productive with. Must be
production-ready, scalable, and maintainable. Suggested defaults: Node.js or
Python backend, React or Next.js frontend, PostgreSQL or MySQL, Redis for queues.
DEPLOYMENT: VPS or cloud (Railway, Render, DigitalOcean, Vercel — your call)

---

CONTEXT & END GOAL
------------------
Build a fully automated SEO platform for GJ Properties (gjproperties.ae), a UAE
real estate developer focused on Ajman and the Northern Emirates. The platform is
managed manually by an operator for the first 6 months, then transitions to fully
autonomous operation with zero human intervention.

Target outcomes by Month 6:
- 35,000–40,000 monthly organic sessions
- 350+ organic leads/month (form submissions + WhatsApp clicks)
- 100 researched transactional keywords ranking (50 EN, 50 AR)
- 700+ programmatic SEO pages live and indexed

The platform has 9 core modules. All modules must support two operating modes:
- MANUAL MODE: operator reviews and approves every action before it executes
- AUTOMATION MODE: all actions run on schedules with no human approval required

---

MODULE 1 — KEYWORD ENGINE
--------------------------
Purpose: Manage, track, and assign 100 transactional keywords across EN and AR.

Requirements:
- CRUD interface for keywords with fields: keyword text, language (EN/AR), monthly
  search volume, keyword difficulty (KD), assigned landing page URL, target emirate
  (Ajman / Dubai / Sharjah / RAK), search intent stage (Awareness / Consideration /
  Decision), status (active/paused)
- Filter and sort by language, emirate, KD, volume, intent stage, ranking position
- Import via CSV
- Pull current Google ranking per keyword via SerpAPI or DataForSEO integration
- Flag priority keywords: KD < 40 AND volume between 1,000–10,000
- Automated weekly ranking refresh in automation mode

INTENT STAGE RULES (build this logic in):
- Awareness keywords (e.g. "Ajman real estate", "property UAE") → mapped to blog
  posts, guides, neighborhood profiles
- Consideration keywords (e.g. "best apartments Ajman", "off-plan vs ready") →
  mapped to comparison pages, project overview pages
- Decision keywords (e.g. "buy 2BHK apartment Ajman", "GJ Properties price list") →
  mapped to direct property landing pages and contact/lead pages
- The content engine (Module 2) must respect this mapping when generating content.
  A decision-intent keyword must never be assigned awareness-type content.

---

MODULE 2 — TOPICAL AUTHORITY ENGINE
--------------------------------------
Purpose: Build GJ Properties as the topically authoritative source for UAE real
estate, using pillar + cluster content architecture — not scattered individual posts.

This is the most important content module. Google ranks sites that OWN a topic,
not sites with isolated keyword pages.

Architecture requirements:
- PILLAR PAGES: 6–8 broad topic pages, each targeting a major theme:
  "Buying Property in Ajman", "Off-Plan Investment UAE", "Living in Ajman",
  "UAE Real Estate for Expats", "Ajman vs Dubai Property", etc.
  Each pillar page is 2,000+ words, covers the topic comprehensively, and links
  to all its cluster articles.
- CLUSTER ARTICLES: 8–12 supporting articles per pillar, each targeting a specific
  long-tail keyword within that topic, all internally linking back to the pillar page.
- The platform must visualize the topic cluster map: which pillars exist, which
  clusters are assigned, which are written, which are published, internal link coverage.
- Content gap detection: automatically flag topic clusters with fewer than 5 articles.
- Internal link manager: when a new article is published, suggest which existing
  pages should link to it and which pages it should link to, based on topic cluster
  membership.

Content creation workflow (applies to both pillar and cluster content):
- Content calendar: plan 8–12 pieces/month, assign to keywords and landing pages
- Content types: blog posts, property guides, neighborhood profiles, FAQ pages,
  landing page copy, pillar pages
- AI-powered draft generation using Claude API or OpenAI API
  - Enforce SEO structure in the prompt: H1 → H2s → body → FAQ → meta title →
    meta description → suggested internal links → suggested schema type
  - For Decision-intent pages: prompt must include a strong CTA and lead capture
    section in the generated draft
  - ARABIC CONTENT: must be generated in fluent native Arabic using a separate
    dedicated system prompt. Never translate from English. The AR prompt must
    instruct the model to write as a native Arabic speaker targeting Gulf Arab
    property buyers.
- Content review workflow: Draft → Review → Approved → Published
- In automation mode: auto-publish approved content on schedule
- On-page SEO checklist per piece: title tag, meta description, H1, image alt text,
  internal links count, schema markup type, word count, intent stage match
- Export content as HTML or push via REST API/webhook to GJ Properties CMS

---

MODULE 3 — PROGRAMMATIC SEO ENGINE
-------------------------------------
Purpose: Auto-generate hundreds of SEO landing pages targeting long-tail property
queries at scale.

Requirements:
- Template system with variable slots:
  "[Property Type] for [sale/rent] in [Location]"
  "Apartments in [Tower Name] Ajman"
  "[N] bedroom flat in [Area] near [Landmark]"
  "Off-plan properties in [Emirate] under [Price]"
- Seed data inputs (all editable from admin panel): property types, tower/project
  names, area names, BHK options, landmarks, price ranges
- Auto-generate page HTML from templates. Each page must have unique content —
  use AI to vary descriptions, not string replacement only. No duplicate thin content.
- Each generated page must include: unique title tag, meta description, H1,
  200+ word body, FAQ section with FAQPage schema, property listing section,
  correct intent-stage assignment (these are Decision pages)
- Page volume targets: M1=50, M2=100, M3=200, M4=350, M5=500, M6=700+
- Sitemap auto-updates on every new page publish
- Pages must be server-side rendered or statically generated — no JS-only rendering
- Dead page monitor: flag any programmatic page with 0 sessions after 60 days for
  refresh or deletion

---

MODULE 4 — GEO MODULE (Geographic Entity Optimization)
---------------------------------------------------------
Purpose: Establish GJ Properties as the authoritative real estate entity for 4
UAE emirates in Google's knowledge graph and local search.

Requirements:
- Per-emirate dashboard: Ajman (primary, 50% traffic target), Dubai (25%),
  Sharjah (15%), RAK (10%)
- Each emirate profile tracks: active landing pages count, keyword count,
  estimated traffic share, ranking coverage, map pack position (manual input)
- Schema markup generator: output LocalBusiness, RealEstateAgent, and Place
  schema JSON-LD per emirate — copyable and exportable
- Citation tracker: UAE real estate directories with listing status per directory
  (listed / not listed / needs update). Track: Bayut, Property Finder, Dubizzle,
  Zawya, Gulf News Property, Gulf Business, Wam.ae, Khaleej Times Property
- NAP consistency checker: input official Name, Address, Phone for GJ Properties,
  flag inconsistencies across all tracked citations
- Google Business Profile task list with completion status tracking (manual — GBP
  cannot be automated via API but must be tracked)
- Entity SEO checklist (manual task tracking with status):
  - Wikidata entry exists for GJ Properties (yes/no)
  - Wikipedia mention or citation (yes/no)
  - Consistent entity mentions across 10+ authoritative UAE domains (count tracked)
  - Google Knowledge Panel triggered for brand search (yes/no)
  These are tracked as tasks, not automated — but the platform must surface them
  clearly and remind the operator monthly.

---

MODULE 5 — AEO MODULE (Answer Engine Optimization)
-----------------------------------------------------
Purpose: Get GJ Properties content cited in AI-generated answers across Google SGE,
ChatGPT, Perplexity, and Gemini.

Requirements:
- FAQ bank: central database of Q&A pairs covering GJ Properties, UAE property
  buying, Ajman investment, off-plan process — editable from admin
- Auto-generate FAQPage JSON-LD schema from the FAQ bank — exportable per page
- AEO content guidelines built into the content editor as a live checklist:
  - Answer appears in first sentence (yes/no)
  - Answer is under 50 words (word count shown)
  - Question is in an H2 tag (yes/no)
  - Conversational tone score (basic readability check)
- Featured snippet tracker: for each keyword, show current snippet owner and
  whether GJ Properties holds it (via SerpAPI)
- AI citation log: manual log where operator records when GJ Properties is cited
  in ChatGPT/Perplexity/Gemini answers — fields: date, platform, query used,
  screenshot upload, cited URL
- Structured data validator: paste a URL, validate all schema markup on that page

---

MODULE 6 — LINK BUILDING TRACKER
-----------------------------------
Purpose: Track outreach and acquired backlinks systematically.

Requirements:
- Prospect list: add target domains with fields: domain, DR score, type
  (directory / guest post / PR / partner), status (prospecting / contacted /
  negotiating / acquired / rejected), notes
- Acquired links log: domain, linking URL, target URL on gjproperties.ae,
  anchor text, DR, date acquired
- Monthly target: 8–12 new links/month — dashboard shows progress vs target
- Integration with Ahrefs API or Moz API if available — otherwise manual DR input
- Flag any acquired link that goes dead (returns non-200) — check monthly

---

MODULE 7 — CORE WEB VITALS & TECHNICAL HEALTH MONITOR
--------------------------------------------------------
Purpose: Track site health as an ongoing ranking input, not just a one-time audit.

Requirements:
- Weekly automated check via Google PageSpeed Insights API for key pages
  (homepage, top 10 landing pages, top 5 programmatic pages)
- Track per page: LCP, FID/INP, CLS, mobile score, desktop score
- Alert when any tracked page drops below: LCP > 2.5s, CLS > 0.1, mobile score < 70
- Broken link scanner: crawl gjproperties.ae weekly, log all internal 404s
- Redirect audit: flag chains of 2+ redirects
- Indexation monitor: use GSC API to track pages that are de-indexed or have
  coverage errors — alert operator immediately

---

MODULE 8 — COMPETITOR GAP ENGINE
-----------------------------------
Purpose: Automatically surface keyword and content opportunities by monitoring
what competitors rank for that GJ Properties does not.

Requirements:
- Competitor list (editable): add competitor domains — e.g. Bayut.com,
  Propertyfinder.ae, other Ajman developers
- Monthly automated competitor keyword scan via SerpAPI or DataForSEO:
  pull top 50 keywords per competitor in UAE
- Gap report: keywords competitors rank for in top 10 that GJ Properties does not
  appear in top 50 for — auto-flag as opportunity
- Gap keywords feed directly into the keyword engine as suggestions with status
  "suggested from competitor gap" — operator approves or rejects
- In automation mode: approved gap keywords are automatically added to content
  calendar as new cluster article assignments
- Frequency: runs monthly automatically

---

MODULE 9 — REPORTING & ANALYTICS DASHBOARD
--------------------------------------------
Purpose: Full monthly automated reporting covering all SEO KPIs with PDF delivery.

Integrations required: Google Search Console API, Google Analytics 4 API,
SerpAPI or DataForSEO, PageSpeed Insights API.

Dashboard home — show current month vs previous month vs Month 0 baseline:
- Organic sessions: total, by emirate, by device
- Keyword rankings: total tracked, in top 3 / top 10 / top 20, by language (EN/AR),
  by intent stage
- Organic leads: form submissions + WhatsApp clicks (GA4 events)
- Programmatic pages: total live, avg sessions/page, dead pages count
- Topical authority score: pillar pages count, avg cluster depth, internal link
  coverage % (custom metric — calculate from platform data)
- GEO: map pack positions (manual), citation health score, entity checklist completion %
- AEO: featured snippet count, AI citation log entries this month
- Core Web Vitals: avg LCP, CLS, INP across tracked pages, pages below threshold
- Backlinks: total referring domains, new this month, lost this month, avg DR
- Competitor gap: new opportunities identified this month, opportunities actioned

M1–M6 forecast vs actual chart: line chart with target trajectory and actual data
per metric (traffic, leads, keywords in top 10).

Monthly PDF report — auto-generated on the 1st of each month:
- All KPIs vs targets vs previous month
- Top 10 keywords by traffic
- Top 5 pages by sessions
- Top 3 content pieces published
- Competitor gap summary
- Recommendations for next month (AI-generated summary via Claude/OpenAI API)
- Auto-emailed to configured recipient list

---

AUTOMATION MODE (Phase 2 — Month 6+)
--------------------------------------
All modules must have a global toggle: Manual Mode vs Automation Mode.

When Automation Mode is ON, these run without human approval:
- Keyword rankings refresh: weekly
- Competitor gap scan: monthly, approved gaps auto-added to content calendar
- Content drafts generated and published per content calendar schedule
- Programmatic pages generated per monthly volume targets
- Schema markup auto-applied to all new pages
- Core Web Vitals check: weekly, alerts sent automatically
- Broken link scan: weekly, 404s logged automatically
- Dead programmatic pages (0 sessions, 60+ days): auto-flagged for refresh
- Monthly PDF report: auto-generated and emailed on the 1st
- All automated actions logged with timestamp, module, action type, and result
  in a persistent activity feed visible in the admin panel

---

ADMIN PANEL REQUIREMENTS
-------------------------
- Secure login: email + password, bcrypt hashed, JWT or session-based auth
- Sidebar navigation: Dashboard / Keywords / Topical Map / Content / Programmatic /
  GEO / AEO / Links / Technical / Competitors / Reports / Settings
- Settings page: API keys (GSC, GA4, SerpAPI, OpenAI/Claude, PageSpeed, Ahrefs),
  automation mode toggle, email report recipients, GJ Properties NAP data, site URL,
  competitor domains list
- Activity log: every automated and manual action logged with timestamp and status
- Mobile-responsive — operator must be able to review dashboard from a phone
- Notification center: surface alerts (dead pages, CWV drops, new competitor gaps,
  de-indexed pages) in a persistent inbox inside the admin panel

---

NON-FUNCTIONAL REQUIREMENTS
-----------------------------
- All data in a persistent database — nothing lost on restart
- Scheduled jobs must survive server restarts — use BullMQ, Celery, or proper cron.
  Never use setTimeout for scheduled work.
- API rate limits respected on all external calls — implement retry logic with
  exponential backoff
- Duplicate content check before any page publish — hash comparison minimum
- Arabic text renders correctly everywhere — RTL support in all UI-facing output
- Sitemap regenerates automatically on every new page publish
- All external API keys stored as environment variables, never hardcoded

---

DELIVERABLE
-----------
Working web application with all 9 modules functional in manual mode.
Automation mode infrastructure (job queues, schedulers) must be scaffolded and
working — full autonomous operation is activated by flipping the toggle.