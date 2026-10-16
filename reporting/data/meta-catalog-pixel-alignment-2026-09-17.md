# Meta catalog ↔ Pixel content_id alignment (2026-09-17)

**Little Hands:** Unrequested product catalog removed — CSV deleted, Firestore `metaIntegrationSettings` catalog/pixel cleared (`reporting/data/littlehands-meta-catalog-removed-2026-09-17.json`). Delete the catalog in Meta Commerce Manager if it still exists there.

## Problem
Meta Commerce Manager reported catalog match rate &lt; 90% — Pixel `content_ids` not matching catalog product IDs.

## Root cause (code)
1. Storefront loads **per-store** Pixel via `ProductDetail` / `StoreDetail`, but `pixelViewContent` / `pixelAddToCart` only fired when **global** `initMetaPixel()` (`VITE_META_PIXEL_ID`) ran — browser events often had **no** `content_ids` while CAPI did.
2. IDs were already Firestore `products` doc ids in most paths; catalog feed used same `id` but lacked explicit `retailer_id`.
3. **Live CSV feed returned 0 rows** for POS-heavy stores: `isValidMetaCatalogProduct` required `image` URL, but menu items use emoji/empty images — Meta scheduled feed emptied catalog while Pixel still sent `pos-{storeId}-*` ids.
4. **Marketing pixel** (`VITE_META_PIXEL_ID`) initialized on `{slug}.grabio.space`, polluting match rate if tied to the same catalog as the store pixel.

## Fix (paths)
| Area | File |
|------|------|
| Single ID helper + store pixel init + browser events work with store pixel | `src/lib/metaPixel.ts` |
| Marketing pixel only on `grabio.space` (not store subdomains) | `src/App.tsx`, `src/components/CookieConsent.tsx` |
| Browser `InitiateCheckout` + `content_ids` | `src/lib/metaPixel.ts`, `src/pages/Cart.tsx` |
| Store pixel init | `src/pages/ProductDetail.tsx`, `src/pages/StoreDetail.tsx` |
| Events | `src/components/ProductCard.tsx`, `src/pages/Cart.tsx` |
| Catalog feed `id` + `retailer_id` + fallback `image_link` | `functions/src/api/metaCatalog.ts` (`GET /meta/catalog/feed`) |
| CAPI normalization + `contents` | `functions/src/api/metaCatalog.ts`, `functions/src/services/metaConversion.ts` |

## Catalog ID rule
**Always** `metaCatalogContentId(product.id)` = trimmed Firestore `products/{id}` — must match feed `id` and `retailer_id`.

## Deploy
```bash
npm run build && firebase deploy --only hosting:production
cd functions && npm run build && firebase deploy --only functions:api
```

## Meta admin checklist
1. Catalog data source URL (CSV) = `https://us-central1-market-flow-7b074.cloudfunctions.net/api/meta/catalog/feed.csv?storeId={STORE_ID}`
2. One Pixel per catalog (no shared Pixel across Grabio packages catalog + store catalog).
3. Re-upload / refresh catalog after deploy; wait 24–48h for match rate.
