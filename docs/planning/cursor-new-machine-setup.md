# Cursor Setup — New Machine (Windows)

**Owner:** Anwar  
**Purpose:** Copy your personalized Code of Conduct, rules, and skills from Linux laptop → Windows POS dev machine.

---

## What syncs automatically vs what does not

| Item | Auto-sync on login? | Location (Linux) | Location (Windows) |
|------|---------------------|------------------|---------------------|
| **User Rules** (Settings UI) | Partial — some account settings sync | Cursor Settings → Rules | Same after sign-in |
| **Rules files** (`anwar.mdc`) | **No** | `~/.cursor/rules/` | `%USERPROFILE%\.cursor\rules\` |
| **User Skills** | **No** | `~/.cursor/skills/` | `%USERPROFILE%\.cursor\skills\` |
| **Built-in Cursor skills** | Yes (Cursor-managed) | `~/.cursor/skills-cursor/` | Re-downloaded by Cursor |
| **Project rules** | Via **git** | `grabio space/.cursor/rules/` | Same in cloned repo |

Cursor **does not** yet cloud-sync personal skills the way it syncs keybindings. You must copy files or use a private git repo.

---

## Option A — Quick copy (recommended for one Windows PC)

### On Linux (this machine)

```bash
# Pack your Cursor config (no secrets)
cd ~
tar czvf ~/grabio-cursor-config.tar.gz \
  .cursor/rules \
  .cursor/skills
```

Copy `grabio-cursor-config.tar.gz` to Windows (USB, Google Drive, etc.).

### On Windows

1. Install [Cursor](https://cursor.com) and sign in with **the same account** (mooveelectro@gmail.com or your dev account).
2. Extract:

```powershell
cd $env:USERPROFILE
tar -xvf C:\path\to\grabio-cursor-config.tar.gz
```

3. Restart Cursor.
4. Verify: **Cursor Settings → Rules** — you should see `anwar` rule if `anwar.mdc` is in `%USERPROFILE%\.cursor\rules\`.
5. Verify: **Customize → Skills** — your user skills appear under Agent Decides.

---

## Option B — Private git repo (best for ongoing sync)

1. Create private repo `anwar-cursor-config` on GitHub.
2. Push:

```bash
cd ~/.cursor
git init
git add rules/ skills/
git commit -m "Cursor rules and skills"
git remote add origin git@github.com:YOUR_USER/anwar-cursor-config.git
git push -u origin main
```

3. On Windows:

```powershell
git clone git@github.com:YOUR_USER/anwar-cursor-config.git $env:USERPROFILE\.cursor-backup
# Merge into .cursor (or symlink skills folder)
```

Optional: symlink skills folder so edits sync via git pull:

```powershell
# PowerShell as Admin — example
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.cursor\skills" -Target "C:\dev\anwar-cursor-config\skills"
```

---

## Option C — Project rules in repo (for POS builder)

Rules committed **inside** `grabio space` travel with the repo. This repo includes:

```
.cursor/rules/grabio-pos.mdc   ← POS + ecosystem conventions for any clone
```

Your personal `anwar.mdc` stays **out of git** unless you choose to copy it into the repo.

---

## Your current Linux paths (reference)

| Asset | Path |
|-------|------|
| Personal COC / rules | `/home/anwar/.cursor/rules/anwar.mdc` |
| User skills (GCP, etc.) | `/home/anwar/.cursor/skills/` |
| Cursor built-in skills | `/home/anwar/.cursor/skills-cursor/` (do not copy — Cursor refreshes) |

---

## Windows POS workflow in Cursor

1. Clone repo: `git clone <ecosystem-repo-url>`
2. **File → Open Folder** → `...\grabio space\the eco sys\ecosystem-plan\posfinal-main\pos-v1`
3. Read `docs/planning/pos-windows-handoff.md` first chat in Agent.
4. `@docs/planning/pos-sync-contract.md` when touching API.
5. Use **Agent** (not Thinking) for JS/Electron UI to save credits (per your COC rule 17).

---

## User Rules in Cursor UI (duplicate check)

Some rules live only in the app, not on disk:

1. **Cursor Settings → Rules → User Rules**
2. If you pasted COC there too, export/copy text manually — file copy alone may not cover UI-only rules.
3. Compare with `anwar.mdc` content after migration.

---

## Security

- **Never** commit `.credentials.md`, keystores, or API keys into cursor-config repo.
- Skills folder is mostly GCP docs — review before pushing to any remote.
