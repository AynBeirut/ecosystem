# Builder Phase 1 — Demo store schema (isolated)

Demo stores live **only** under the builder path. They must never appear in production commerce collections.

## Firestore paths

```
builders/{builderUid}
  businessType: 'designer' | 'media_company' | ...
  demoSlotCount: number          // max 5 active demos
  grantedExtras?: string[]       // admin-granted module ids (Phase 3 UI)
  createdAt, updatedAt

builders/{builderUid}/demoStores/{demoId}
  name: string
  status: 'draft' | 'preview' | 'invited' | 'converted' | 'deleted'
  previewTokenHash: string       // SHA-256 of preview token (Phase 2)
  previewExpiresAt?: timestamp
  createdAt, updatedAt

builders/{builderUid}/demoStores/{demoId}/profile/branding
  // Subset of StoreProfile: name, logo, colors, template, slug (reserved, not public until transfer)

builders/{builderUid}/demoStores/{demoId}/products/{productId}
  // Catalog + variants + image refs — same shape as products/ but scoped to demo

builders/{builderUid}/demoStores/{demoId}/blogPosts/{postId}
  // Draft/preview content only

builders/{builderUid}/demoStores/{demoId}/contentDrafts/{draftId}
  // SEO / copy drafts
```

## Real store (post-transfer) — unchanged primary model

```
storeProfiles/{storeId}          // storeId may be client UID (first store) or generated UUID (store #2+)
  ownerId: clientUid
  isDemo: false                  // must never be true on real stores
  subscriptionStatus: active | trial | grace | ...

users/{clientUid}
  ownedStoreIds: string[]        // Phase 2
  primaryStoreId: string
  activeStoreId: string
```

## Commerce eligibility (`isRealStore`)

A store may participate in orders, customers, CRM sync, AI ledger, POS, etc. only when:

1. `storeProfiles/{storeId}` exists
2. `isDemo !== true`
3. `subscriptionStatus` is `active`, `trial`, or `grace`, **or** field is unset (legacy stores)

Explicit `expired` or `blocked` status → commerce denied.
