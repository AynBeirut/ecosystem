# Unified Store Builder — Replan v2 (Shopify reference)

**Status:** Planning — owner shared Shopify screenshots (2026-06-29).  
**Prototype built:** `ShopifyStylePageEditor` in wizard — useful experiment but **not Shopify-feeling**. Keep for A/B; do not invest more in wireframe canvas.

---

## What Shopify actually does (from your screenshots)

Shopify is **not one wizard step**. It is **4 distinct surfaces** that feel like one product:

| # | Shopify screen | What it is | Grabio today |
|---|----------------|------------|--------------|
| **S1** | Home — “Welcome! Where do you want to start?” | Dashboard **checklist cards** (add product, choose design, AI help) | `AdminDashboard` quick actions — partial |
| **S2** | Onboarding — “What can we help you do?” | Full-screen **intent multi-select** (sell online, in-store, …) | Wizard `site-type` step — similar idea, wrong chrome |
| **S3** | Themes — “Discover themes” gallery | **Theme store grid** + preview + “Add” + AI sidebar | `AdminTemplates` templates tab — close, but buried in admin chrome |
| **S4** | **Theme editor** (the important one) | **Full-screen editor** — this is the “feeling” | Missing entirely |

### S4 — Theme editor anatomy (target UX)

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  Horizon · Draft · Home page ▾     [desktop][mobile]  Save Publish │
├──────────────┬──────────────────────────────────────────────────┤
│  LEFT TREE   │           LIVE STOREFRONT PREVIEW (iframe)        │
│              │                                                  │
│  Header      │   [real rendered site — click section to select] │
│   · Announce │                                                  │
│   · Header   │   Blue outline + label on selected block         │
│  + Add       │                                                  │
│              │                                                  │
│  Template    │                                                  │
│   · Hero     │                                                  │
│   · Featured │  ← selected section highlighted in tree + preview│
│  + Add       │                                                  │
│              │                                                  │
│  Footer      │                                                  │
│   · Footer   │                                                  │
│  + Add       │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

**Key differences from our prototype:**

| Shopify S4 | Our `ShopifyStylePageEditor` prototype |
|------------|----------------------------------------|
| **Real site** in preview (iframe) | Gray wireframe blocks |
| **Full-screen** — no admin sidebar | Inside wizard step, cramped |
| **Zone tree**: Header / Template / Footer | Flat section list |
| **+ Add section** per zone | Fixed 7 sections only |
| Click preview **or** tree → same selection | Canvas-only selection |
| Section settings in **slide-over / right panel** when selected | Always-visible right panel |
| Top bar: page picker, device toggle, undo, Save, Publish | None |
| Theme = Horizon (full template) | 4 color presets |

**Conclusion:** The “feeling” is **S4 full-screen theme editor with live iframe**, not a 3-column wireframe inside a wizard.

---

## What Grabio already has (reuse — do not rewrite)

| Capability | Where | Maps to Shopify |
|------------|-------|-----------------|
| 11+ templates + layout configs | `AdminTemplates` | S3 theme gallery + apply |
| Section order, enable, styling | `AdminTemplates` + `sectionOrder` | S4 Template zone |
| Colors, layout, media | `AdminTemplates` tabs | S4 section settings |
| Live storefront render | `StoreDetail.tsx` | S4 iframe preview **source** |
| Products catalog | `AdminProducts` / wizard | S1 “Add first product” |
| AI copy/colors | `AdminTemplates` AI panel | Shopify AI sidebar |

**We should not build a second renderer.** Preview = `StoreDetail` in iframe with `?preview=1` or draft token.

---

## Revised target architecture

### Two modes, one product

**Mode A — Onboarding** (S1 + S2)  
Route: `/admin/setup` or checklist on dashboard  
- Full-screen or card-based: intent → business → optional AI  
- Ends with: “Choose your design” → opens Mode B  

**Mode B — Theme editor** (S3 + S4) — **this is the Shopify feeling**  
Route: `/admin/theme-editor` (new full-screen layout, **no** `AdminPageShell`)  

```
/admin/theme-editor
├── Top chrome (Shopify-like)
│     store name · Draft/Live · page ▾ · desktop/mobile · Save · Publish
├── Left: SectionTree (Header / Template / Footer zones)
│     reuse sectionOrder + group hero in Header, products in Template, contact in Footer
├── Center: <iframe src="/store/{slug}?editorPreview=1" />
│     postMessage: click section → select in tree
└── Right (on select): SectionSettingsPanel
      extract from AdminTemplates section controls
```

**Mode C — Theme gallery** (S3)  
Route: `/admin/themes` or first panel in theme-editor when no template chosen  
- Grid of existing `TemplateDefinition[]` cards  
- “View demo” → open sample slug or preview modal  
- “Use template” → apply `handleSelectTemplate` logic  

### Wizard `/admin/builder` fate

| Option | Recommendation |
|--------|----------------|
| Keep wizard as onboarding only | **Yes** — S1/S2, then redirect to theme-editor |
| Keep wireframe page-design step | **No** — replace with link “Open theme editor” |
| Keep `/admin/templates` | Redirect to `/admin/theme-editor` or `/admin/themes` |

---

## Phased build (after you confirm)

| Phase | Deliverable | Effort | Shopify screen |
|-------|-------------|--------|----------------|
| **T0** | Full-screen `ThemeEditorShell` (top bar + empty iframe) | 1–2 d | S4 chrome only |
| **T1** | iframe loads real `StoreDetail` for store slug | 1 d | S4 live preview |
| **T2** | Left `SectionTree` synced with `sectionOrder` (DnD + zones) | 2–3 d | S4 left panel |
| **T3** | Click section in iframe → selection (data attributes on `StoreDetail` sections) | 2–3 d | S4 click-to-select |
| **T4** | Right settings panel (extract from AdminTemplates) | 2–3 d | S4 settings |
| **T5** | Theme gallery page (`/admin/themes`) | 1–2 d | S3 |
| **T6** | Dashboard checklist cards + onboarding intent screen | 1–2 d | S1, S2 |
| **T7** | Device toggle, Save/Publish, draft vs live | 1–2 d | S4 top bar |

**Total:** ~12–18 days for Shopify-parity **editor shell** (not new theme engine).

**Not in v1:** + Add section library (new section types), undo/redo stack, multi-page editor (Catalog, Contact pages), theme store marketplace.

---

## Section zones (map Grabio → Shopify tree)

| Shopify zone | Grabio `StoreSectionId` |
|--------------|-------------------------|
| Header | `hero`, `announcements` (optional) |
| Template | `about`, `products`, `gallery`, `reviews` |
| Footer | `contact` |

Menu/header bar is layout config (`menuStyle`, logo) — separate “Header” settings group, not a draggable section (v1).

---

## Decisions needed (updated)

1. **Priority:** Build **T0–T4** (full-screen editor + iframe + tree) before more wizard steps? **(Recommended: yes)**
2. **URL:** `/admin/theme-editor` OK?
3. **Preview:** iframe same-origin `/store/{slug}?editorPreview=1` — OK to add `data-section-id` on `StoreDetail` blocks?
4. **Gallery:** Separate `/admin/themes` or modal inside editor?
5. **Classic Templates:** Keep as power-user link or 301 redirect to theme-editor?

---

## What we stop doing

- Expanding wireframe `ShopifyStylePageEditor` (prototype stays for comparison only)
- Adding more wizard steps before T0–T2
- Deploying M1 wizard as the primary design experience

---

*Owner: confirm T0–T4 priority + decisions 1–5. Then we implement Theme Editor Shell only (no wizard changes).*
