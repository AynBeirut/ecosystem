# Play upload — Grabio Admin 1.3.9 (140)

**Package:** `space.grabio.app`  
**AAB:** `grabio-mobile/release/grabio-1.3.9-140.aab`  
**Tester opt-in:** https://play.google.com/apps/testing/space.grabio.app

## Steps (Anwar — ~5 min)

1. Play Console → **Grabio** (admin app, not `space.grabio.finance`).
2. **Closed testing** (or Internal testing) → **Create new release**.
3. Upload `grabio-1.3.9-140.aab` — versionCode **140** must be new on track.
4. Save → review → roll out to testers.
5. On phone: open opt-in URL → update from Play (can uninstall USB build first).

## What 140 fixes (release notes)

- Server-first tenant bind (`users.subAccountId` → store).
- Wrong-store session guard (sign out if cache shows another tenant).
- Manager sub-accounts: same back-office access as web (`hasStoreAdminAccess`).

## Do not

- Sideload APK to clients — Play update only per `decision-log.md`.
