# Obsidian + Cursor Workflow (Hybrid)

This setup is optimized for your workflow:

- One global vault/repo for shared Cursor rules and skills (`grabio-ai-core`)
- One docs vault/repo per project (`<project>-docs`)

## 1) Global AI core (all projects, all machines)

Use this structure in your global private repo:

```text
grabio-ai-core/
  rules/
    anwar.mdc
    grabio-pos.mdc
  skills/
    <skill-name>/SKILL.md
```

On each machine, sync to Cursor user paths:

- Linux/macOS: `~/.cursor/rules`, `~/.cursor/skills`
- Windows: `%USERPROFILE%\.cursor\rules`, `%USERPROFILE%\.cursor\skills`

Use scripts:

- `scripts/obsidian/sync-cursor-config.sh`
- `scripts/obsidian/sync-cursor-config.ps1`

## 2) Project docs (one by one)

For each project, use one separate docs repo:

```text
<project>-docs/
  README.md
  structure.md
  conversation.md
  product-description.md
  backlog.md
  POS-INSTALLER-RUNBOOK.md
```

You can copy the starter template from:

`the eco sys/obsidian/project-docs-template/`

For POS operations, keep `POS-INSTALLER-RUNBOOK.md` in each project docs repo.

## 3) Recommended machine routine

1. Pull `grabio-ai-core`
2. Run sync script to update Cursor rules/skills
3. Pull the project docs repo you are working on
4. Keep code repo and docs repo open side-by-side in Obsidian/Cursor

## 4) Security

- Keep credentials only in local `.credentials.md` (gitignored)
- Do not put API keys, keystores, or service account files in the global vault
