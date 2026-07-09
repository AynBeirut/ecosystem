# Grabio drag-and-drop backup (pre theme-editor)

**Created:** 2026-06-29  
**Reason:** Full-screen Shopify-style theme editor added at `/admin/theme-editor`. Original Grabio editor preserved here.

## Files

| Backup | Original |
|--------|----------|
| `AdminTemplates.pre-theme-editor.tsx` | `src/pages/admin/AdminTemplates.tsx` |
| `ShopifyStylePageEditor.backup.tsx` | `src/components/builder/ShopifyStylePageEditor.tsx` |
| `storeSectionDefaults.backup.ts` | `src/lib/storeSectionDefaults.ts` |

## Restore classic editor only

```bash
cp src/pages/admin/_backup/AdminTemplates.pre-theme-editor.tsx src/pages/admin/AdminTemplates.tsx
```

`AdminTemplates.tsx` was **not modified** by the theme-editor work — `/admin/templates` remains the classic Grabio drag-and-drop UI.

## Compare editors

| Surface | URL |
|---------|-----|
| **Classic (Grabio)** | `/admin/templates` → Custom template → Sections |
| **Shopify-style (new)** | `/admin/theme-editor` |
| **Wizard wireframe (prototype)** | `/admin/builder` → Page design |
