# Service Worker Cache Clear Instructions

## Issue
grabio.space is showing old header color while market-flow-7b074.web.app shows the correct new white-label header.

## Cause
Progressive Web App (PWA) service worker is caching old assets. Users who visited grabio.space before the deployment have the old version cached.

## Solutions

### For Testing (Immediate)

**Option 1: Hard Refresh**
- **Chrome/Edge**: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Firefox**: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Safari**: `Cmd + Option + R`

**Option 2: Clear Service Worker in DevTools**
1. Open DevTools (`F12`)
2. Go to **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
3. Click **Service Workers** in left sidebar
4. Click **Unregister** next to the active worker
5. Click **Clear storage** or **Clear site data**
6. Refresh the page (`F5`)

**Option 3: Incognito/Private Window**
- Open grabio.space in a new incognito/private window
- No cached version will be used

### For Production Users (Automatic)

The service worker is configured with:
- `skipWaiting: true` - New version activates immediately
- `clientsClaim: true` - Takes control of pages immediately
- `cleanupOutdatedCaches: true` - Removes old cached files

**How it works:**
1. User visits grabio.space
2. Browser checks for new service worker
3. If found, downloads and installs it
4. On next page load or refresh, new version is used

**Users need to:**
- Refresh the page once after the service worker updates
- Or close all tabs and reopen (forces update)

### Force All Users to Update (Optional)

If you need immediate update for all users, you can add a version check:

**src/main.tsx** (add this):
```tsx
// Force service worker update
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.update(); // Force check for new version
    });
  });
}
```

## Verification

After clearing cache, verify on grabio.space:
- ✅ Business tier account (anwar.abouhassan@gmail.com) shows store color header
- ✅ Pro tier account (mooveelectro@gmail.com) shows store color header  
- ✅ Free/Starter accounts show green Grabio header
- ✅ Text color adapts to background (black on light, white on dark)

## Prevention

Future deployments automatically update the service worker because:
- Build creates new hashed filenames (`index-BixRSW_u.js`)
- Service worker detects file changes
- `autoUpdate` mode pushes updates to clients
- Users see new version on next visit

## Current Status

**Deployment Time**: April 24, 2026 15:06:17  
**Domains**: 
- ✅ market-flow-7b074.web.app (working correctly)
- ⚠️ grabio.space (cached, needs hard refresh)

**Expected Timeline**:
- Most users: Updated within 24 hours (next visit)
- Active users: Updated on next page refresh
- Immediate fix: Hard refresh or clear cache
