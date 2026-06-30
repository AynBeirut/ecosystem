# Cursor Setup — New Windows PC

For **Anwar** (and builders using the same rules).

---

## What syncs when you log into Cursor?

| Item | Auto-sync? |
|------|------------|
| Editor settings / keybindings | Often yes (same Cursor account) |
| **Rules file** `anwar.mdc` | **No** — copy manually |
| **User skills** folder | **No** — copy manually |
| **This pack** `rules/grabio-pos.mdc` | Comes with git / this zip |

---

## Copy rules & skills (Linux → Windows)

### On Linux (current machine)

```bash
tar czvf ~/pos-cursor-config.tar.gz -C ~/.cursor rules skills
```

Copy `pos-cursor-config.tar.gz` to Windows (USB, Drive, etc.).

### On Windows

1. Install Cursor from https://cursor.com
2. Sign in with your Cursor account
3. Extract:

```powershell
cd $env:USERPROFILE
tar -xvf C:\Users\You\Downloads\pos-cursor-config.tar.gz
```

4. Restart Cursor
5. Check **Settings → Rules** — `anwar` rule should appear

---

## Project rule (POS)

After cloning the repo, copy from this pack:

```
pos-windows-builder-pack/rules/grabio-pos.mdc
  →  grabio space/.cursor/rules/grabio-pos.mdc
```

Or create `.cursor/rules/` in repo root and paste the file.

---

## Open the right folder in Cursor

**File → Open Folder:**

```
...\grabio space\the eco sys\ecosystem-plan\posfinal-main\pos-v1
```

First chat with Agent: paste:

> Read `the eco sys/ecosystem-plan/pos-windows-builder-pack/README.md` and implement `js/grabio/` per CODE-TASKS.md

---

## Optional — private git for rules (keep in sync)

```bash
# Linux — one-time
cd ~/.cursor
git init
git add rules skills
git commit -m "cursor config"
# push to private GitHub repo

# Windows — clone and copy into %USERPROFILE%\.cursor\
```

---

## Security

Never put passwords, keystores, or `.credentials.md` in git or in this pack.
