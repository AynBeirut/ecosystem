#!/usr/bin/env bash
set -euo pipefail

# Sync shared rules/skills from global AI core repo to Cursor user folders.
#
# Usage:
#   scripts/obsidian/sync-cursor-config.sh /path/to/grabio-ai-core

SOURCE_DIR="${1:-}"
if [[ -z "${SOURCE_DIR}" ]]; then
  echo "Usage: $0 /path/to/grabio-ai-core"
  exit 1
fi

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Source directory not found: ${SOURCE_DIR}"
  exit 1
fi

RULES_SRC="${SOURCE_DIR}/rules"
SKILLS_SRC="${SOURCE_DIR}/skills"

if [[ ! -d "${RULES_SRC}" ]]; then
  echo "Missing folder: ${RULES_SRC}"
  exit 1
fi

if [[ ! -d "${SKILLS_SRC}" ]]; then
  echo "Missing folder: ${SKILLS_SRC}"
  exit 1
fi

CURSOR_DIR="${HOME}/.cursor"
RULES_DEST="${CURSOR_DIR}/rules"
SKILLS_DEST="${CURSOR_DIR}/skills"

mkdir -p "${RULES_DEST}" "${SKILLS_DEST}"

rsync -a --delete "${RULES_SRC}/" "${RULES_DEST}/"
rsync -a --delete "${SKILLS_SRC}/" "${SKILLS_DEST}/"

echo "Synced rules to: ${RULES_DEST}"
echo "Synced skills to: ${SKILLS_DEST}"
