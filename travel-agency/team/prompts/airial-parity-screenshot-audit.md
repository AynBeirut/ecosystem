# Prompt — Airial parity screenshot audit (Tester / Planner)

**Benchmark PDF (source of truth for “what Airial looks like”):**  
`/home/anwar/Documents/grabio space/travel-agency/Airial-for-Travel-Agents.pdf`

**Product folder:** `/home/anwar/Documents/grabio space/travel-agency`  
**Protocol:** `team/PROTOCOL.md` · **Do not fix code.** · **No passwords in any file** (use `.credentials.md` / `web/.env.staging` field names only).

---

## Paste-ready prompt

```
You are the Tester on the Travel Agency project (independent from Builder).

Goal: Produce a client-ready **Airial vs Grabio Travel** visual comparison — not a pass/fail on S0 alone. The client judges “are we like Airial?” from screenshots + a short gap table.

1. Read:
   - team/PROTOCOL.md, team/STATUS.md
   - decision-log.md (2026-10-04 Airial decision)
   - backlog.md (S0–S5 Airial-inspired plan)
   - team/tasks/S1-proposal-experience.md (target client “Present” UX)
   - Airial-for-Travel-Agents.pdf (export or photograph each major screen/story in the deck)

2. Environment:
   - Primary: local `cd travel-agency/web && npm run dev -- --mode staging` (post-R1 code).
   - Optional smoke: staging hosting URL from .credentials.md only if bundle hash is documented in the report.
   - Login: staging demo account (store `travel-agency-demo`). Never paste passwords into reports.

3. From the PDF, capture **reference crops** (one PNG per slide or feature group) into:
   `team/test-reports/assets/airial-ref/`
   Name files: `airial-{pillar}-{short-label}.png`
   Pillars (map slides to these even if PDF section titles differ):
   - **P1 Brief → draft** — natural-language trip brief becoming a draft itinerary
   - **P2 Present** — branded shareable proposal (hero, days, inclusions, price, approve)
   - **P3 Agent workspace** — pipeline, deal, quote builder, margin
   - **P4 Convert & collect** — approve, deposit, invoice/voucher, deal timeline
   - **P5 Document hub** — upload supplier doc, priced lines with source

4. Capture **Grabio Travel current state** at **390px** and **1280px** into:
   `team/test-reports/assets/grabio-now/`
   Name: `grabio-{route}-{viewport}-{label}.png`

   Required routes (agent):
   | ID | Route | What to show |
   |----|-------|----------------|
   | G1 | `/travel/` (Today) | tasks / activity |
   | G2 | `/travel/deals` | pipeline list |
   | G3 | `/travel/deals/demo-d1` | deal detail |
   | G4 | `/travel/deals/demo-d1/quote/demo-q1` | legacy text quote |
   | G5 | `/travel/deals/demo-d3/quote/mF4C0RqTwvEV55LpUmeq` | structured days + items + margin (if quote exists; else newest 3-day quote on demo-d3) |
   | G6 | `/travel/deals/new` | new deal (note: no Airial-style brief box yet) |
   | G7 | `/travel/book` | Nextra search (mock offers) |
   | G8 | `/travel/money` | owner margin / pipeline |
   | G9 | `/travel/crm` | contacts |
   | G10 | `/travel/settings` | agency branding fields |

   Required routes (client / traveller):
   | ID | Route | What to show |
   |----|-------|----------------|
   | C1 | `/travel/p/demo` | public proposal (current UI) |
   | C2 | Real `/travel/p/{token}` only if live API works; if 404 on Cloud Run proposal routes, capture console/network evidence and mark **NOT AVAILABLE — ENV** |

5. Build a **comparison matrix** in the report (one row per PDF pillar × sub-feature):
   - Airial (PDF ref image path)
   - Grabio now (screenshot path or “not built”)
   - Target slice (S0–S5 from backlog)
   - Parity: **Yes / Partial / No / Blocked (env)**

6. Write report:
   `team/test-reports/airial-parity-comparison-YYYYMMDD.md`
   Use sections: Executive summary (3 sentences for client), P1–P5 tables, Demo script (what to show tonight vs what to promise), Console errors (must be zero on captured routes), Not tested.

7. UI gate on every Grabio screenshot: mobile-first client pages, loading/empty if reachable, no horizontal scroll at 390px on `/travel/p/*`.

Do not edit tasks or STATUS unless PROTOCOL says this audit gates a slice; this is a **product comparison deliverable**, not S0 retest.
```

---

## Quick answer for the client (“Are we Airial?”)

| Airial pillar (PDF) | Grabio today | Honest line |
|---------------------|--------------|-------------|
| **P2 Present** (magazine proposal) | Dark `/p/demo` list; no hero, sticky approve, branding | **Not yet** — **S1** (queued) |
| **P3 Agent workspace** | Deals, CRM, quote builder, structured days (S0 agent-side) | **Partial** — ops console yes; not Airial polish |
| **P1 Brief → draft** | Plain new deal | **No** — **S2** |
| **P4 Convert & collect** | Deposit API scaffold; no traveller approve thread | **Partial** — **S3** |
| **P5 Document hub** | — | **No** — **S4** |

**Positioning:** “Same **journey** as Airial (brief → beautiful proposal → approve → collect); we’re **~25–35%** on traveller-facing **Present**; **~60%** on agent quote/deal spine. Nextra sits **behind** as inventory (Book page), not the client story.”

---

## Suggested side-by-side pairs for the deck

| Pair | Airial ref | Grabio now |
|------|------------|------------|
| Client opens proposal | `airial-P2-*.png` | `grabio-/travel/p/demo-390-hero.png` |
| Day-by-day detail | `airial-P2-days.png` | `grabio-...-quote-1280-structured.png` |
| Agent builds trip | `airial-P3-builder.png` | `grabio-...-quote-390-editor.png` |
| Approve & pay story | `airial-P4-*.png` | Money + quote deposit UI (note gaps) |
