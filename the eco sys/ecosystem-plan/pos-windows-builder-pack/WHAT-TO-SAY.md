# What to tell the builder (copy/paste)

Send them **this folder** (or `pos-windows-builder-pack.zip`) + **git repo access**.

---

## Short message

```
Hi,

Here is the Grabio POS handoff pack. Everything is in one folder — start with README.md.

1. Clone the repo
2. Open pos-windows-builder-pack/README.md and follow the steps
3. Your work is in: the eco sys/ecosystem-plan/posfinal-main/pos-v1/
4. Build js/grabio/ (pairing + heartbeat first) — details in CODE-TASKS.md
5. API details in API-CONTRACT.md

Pairing API is live. Catalog + orders endpoints are not built yet — coordinate with me before assuming they exist.

Do not deploy Firebase or production hosting. Send me the Windows installer when ready for QA.

Questions: support@grabio.space
```

---

## If they use Cursor

```
After clone, copy pos-windows-builder-pack/rules/grabio-pos.mdc into the repo .cursor/rules/ folder.
Open the pos-v1 folder in Cursor. First prompt: read pos-windows-builder-pack/README.md and implement js/grabio/ per CODE-TASKS.md.
```

---

## What you give them

| Item | How |
|------|-----|
| This folder | Zip `pos-windows-builder-pack/` or share repo path |
| Git access | Repo URL + branch (main or your feature branch) |
| Test store | Login for a store with POS module enabled |
| Pairing test | You generate code at grabio.space/admin/pos |

---

## What you do NOT give them

- Firebase deploy keys
- `.credentials.md`
- Production deploy approval (you deploy after QA)
