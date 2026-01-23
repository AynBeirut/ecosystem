# Friendly URLs Implementation Guide

This document explains the new friendly URL system with slugs for stores and products.

## Overview

The system now supports human-readable URLs instead of Firebase document IDs:

**Before:**
- `/store/abc123xyz` (Firebase ID)
- Product URLs didn't exist (404 errors)

**After:**
- `/store/tech-gadgets-store` (readable slug)
- `/store/tech-gadgets-store/product/iphone-15-pro` (full product URLs)

## Features

### 1. Slug-Based URLs
- **Store URLs**: `/store/{slug}` (e.g., `/store/johns-electronics`)
- **Product URLs**: `/store/{storeSlug}/product/{productSlug}`
- **Backward Compatibility**: Old ID-based URLs still work and redirect to slug URLs

### 2. Automatic Slug Generation
- Slugs are automatically generated from store/product names
- Format: lowercase, hyphens, alphanumeric only
- Example: "Tech Gadgets & More!" → "tech-gadgets-more"

### 3. Conflict Resolution
- System checks for duplicate slugs
- Suggests alternatives with numeric suffixes: `cafe-2`, `cafe-3`, etc.
- Shows user-friendly error messages in admin UI

### 4. Enhanced Social Sharing
- Share buttons on all product pages
- Support for: Facebook, Twitter/X, Instagram, LinkedIn, Pinterest, WhatsApp, Email
- Copy link functionality
- Uses slug-based URLs for better SEO

## Implementation Details

### Modified Files

#### Type Definitions
- `src/types/storeProfile.ts` - Added `slug?: string`
- `src/types/product.ts` - Added `slug?: string` to Product and Store types

#### Utilities
- `src/lib/slugify.ts` (NEW) - Slug generation, validation, and conflict checking
  - `generateSlug(text)` - Convert text to URL-safe slug
  - `isValidSlug(slug)` - Validate slug format
  - `checkSlugAvailability(slug, collection)` - Check Firestore for duplicates
  - `generateUniqueSlug(text, collection)` - Auto-generate with conflict resolution

#### Routing
- `src/App.tsx` - Updated routes:
  - `/store/:slug` - Main store route
  - `/store/:storeSlug/product/:productSlug` - Product detail route
  - `/store/id/:id` - Backward compatibility (redirects to slug)
  - `/product/id/:id` - Backward compatibility (redirects to slug)

#### Pages
- `src/pages/StoreDetail.tsx` - Enhanced to handle both slugs and IDs, auto-redirects
- `src/pages/ProductDetail.tsx` - Updated to use Firestore queries, slug routing
- `src/pages/Cart.tsx` - Product links use slugs
- `src/pages/admin/AdminProfile.tsx` - Added slug input with real-time validation
- `src/pages/admin/AdminProducts.tsx` - Auto-generates slugs on product creation

#### Components
- `src/components/ProductCard.tsx` - Links use slug-based URLs
- `src/components/StoreCard.tsx` - Links use slug-based URLs
- `src/components/ui/ShareButtons.tsx` - Enhanced with 8 social platforms

#### Migration
- `scripts/migrateToSlugs.ts` (NEW) - Batch migration script

## Admin UI Usage

### Store URL Management

1. Go to Admin Profile
2. Enter your store name
3. A slug is auto-generated (editable)
4. Real-time availability checking shows:
   - ✅ Green checkmark if available
   - ❌ Red X with suggestions if taken
5. Preview URL shown: `https://grabio.space/store/your-slug`

### Product URL Management

- Slugs are automatically generated when creating/editing products
- Based on product name
- Handles conflicts automatically with numeric suffixes
- No manual input needed (happens in background)

## Migration Guide

### Running the Migration Script

**Option 1: Using ts-node (Recommended)**
```bash
# Install ts-node if not already installed
npm install -D ts-node

# Run migration
npx ts-node scripts/migrateToSlugs.ts
```

**Option 2: Compile and Run**
```bash
# Compile TypeScript
npx tsc scripts/migrateToSlugs.ts --outDir dist --module commonjs

# Run compiled script
node dist/scripts/migrateToSlugs.js
```

### What the Migration Does

1. Fetches all stores without slugs
2. Generates unique slugs for each store
3. Updates Firestore documents
4. Repeats for products
5. Provides detailed progress and error reporting

### Migration Output Example

```
🚀 Starting Slug Migration

🏪 Starting store migration...
Found 15 stores
✅ Updated "John's Electronics" with slug: johns-electronics
✅ Updated "Fresh Fruits Market" with slug: fresh-fruits-market
⏭️  Skipping "Tech Store" - already has slug: tech-store

📊 Store Migration Summary:
   Total: 15
   Updated: 14
   Skipped: 1
   Errors: 0

📦 Starting product migration...
Found 127 products
✅ Updated "iPhone 15 Pro" with slug: iphone-15-pro
✅ Updated "Samsung Galaxy S24" with slug: samsung-galaxy-s24

📊 Product Migration Summary:
   Total: 127
   Updated: 127
   Skipped: 0
   Errors: 0

✨ Migration Complete!
⏱️  Duration: 8.45s
✅ All migrations completed successfully!
```

## Testing Checklist

### Before Testing
- [ ] Run migration script to add slugs to existing data
- [ ] Verify no TypeScript errors: `npm run build`

### Store Pages
- [ ] Access store by slug: `/store/your-store-name`
- [ ] Old ID URLs redirect: `/store/abc123` → `/store/your-store-name`
- [ ] Store cards in marketplace use slug links
- [ ] Follow/unfollow functionality works
- [ ] Reviews load correctly

### Product Pages
- [ ] Access product by slug: `/store/store-name/product/product-name`
- [ ] Old product ID URLs redirect: `/product/id/xyz789`
- [ ] Product cards link correctly
- [ ] Add to cart works
- [ ] Favorites work
- [ ] Quantity selector works
- [ ] "Back to Store" link uses store slug

### Admin UI
- [ ] Store slug input shows availability status
- [ ] Suggestions appear for taken slugs
- [ ] URL preview shows correctly
- [ ] Products auto-generate slugs on creation
- [ ] Editing products preserves slugs

### Cart & Navigation
- [ ] Cart product links work
- [ ] Marketplace navigation works
- [ ] Search results use correct links
- [ ] Order history links work (if applicable)

### Social Sharing
- [ ] All 8 share buttons work:
  - [ ] Facebook
  - [ ] Twitter/X
  - [ ] Instagram
  - [ ] LinkedIn
  - [ ] Pinterest
  - [ ] WhatsApp
  - [ ] Email
  - [ ] Copy Link
- [ ] Shared URLs use slugs
- [ ] Copy link shows success toast

### Edge Cases
- [ ] Store without slug (shouldn't exist after migration)
- [ ] Product without slug (shouldn't exist after migration)
- [ ] Invalid slug in URL (shows 404 error)
- [ ] Duplicate slug attempts (shows error with suggestions)

## SEO Benefits

### Before
- URLs: `grabio.space/store/abc123xyz`
- Not memorable, not shareable
- No keywords for search engines

### After
- URLs: `grabio.space/store/johns-electronics`
- Memorable and shareable
- Contains relevant keywords
- Better search engine ranking
- Professional appearance

## Backward Compatibility

### Old Links Continue Working
- All existing shared links redirect automatically
- Format: `/store/id/{firebaseId}` → `/store/{slug}`
- Product links: `/product/id/{firebaseId}` → proper slug URL
- No broken links for customers

### How It Works
1. System detects if URL param is ID or slug (by pattern matching)
2. If ID: looks up document, gets slug, redirects
3. If slug: direct Firestore query by slug field
4. Seamless user experience

## Troubleshooting

### Slug Not Available Error
**Problem:** "This store name is already taken"  
**Solution:** Click one of the suggested slugs or modify your store name

### Old URLs Not Redirecting
**Problem:** `/store/abc123` shows 404  
**Solution:** 
1. Verify store has slug in Firestore
2. Run migration script if needed
3. Check browser cache (hard refresh: Ctrl+Shift+R)

### Products Show 404
**Problem:** Product detail pages not loading  
**Solution:**
1. Verify product has slug in Firestore
2. Verify store has slug in Firestore
3. Run migration script
4. Check console for errors

### Migration Script Fails
**Problem:** Script errors or times out  
**Solution:**
1. Check Firebase credentials in `.env`
2. Verify internet connection
3. Check Firestore permissions
4. Run migration in smaller batches (modify script)

## API Reference

### Slugify Utility Functions

```typescript
// Generate a slug from text
generateSlug(text: string): string
// Input: "Tech Gadgets & More!"
// Output: "tech-gadgets-more"

// Validate slug format
isValidSlug(slug: string): boolean
// Returns true if slug matches: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

// Check if slug is available
checkSlugAvailability(
  slug: string, 
  collection: string, 
  excludeId?: string
): Promise<{ available: boolean; suggestions: string[] }>
// Returns availability and suggestions if taken

// Generate unique slug (auto-handles conflicts)
generateUniqueSlug(
  text: string, 
  collection: string, 
  excludeId?: string
): Promise<string>
// Auto-appends numbers if needed: "cafe-2", "cafe-3"
```

## Future Enhancements

### Custom Domains (Planned)
- Allow sellers to use their own domains
- Example: `johnelectronics.com` instead of `grabio.space/store/johns-electronics`
- Requires DNS configuration

### URL Shortener (Consideration)
- Optional short URLs for social media
- Example: `grb.io/abc123` → full slug URL

### Analytics
- Track which slugs get the most traffic
- A/B test different slug formats
- Monitor redirect performance

## Support

For questions or issues:
1. Check this documentation first
2. Review console errors in browser
3. Check Firestore data structure
4. Verify migration script completed successfully
5. Contact development team with specific error messages
