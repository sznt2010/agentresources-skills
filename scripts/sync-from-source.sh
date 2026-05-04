#!/usr/bin/env bash
# Sync the canonical skills/ tree from the AR monorepo into this mirror.
#
# Usage (run from monorepo root):
#   bash public-mirrors/agentresources-skills/scripts/sync-from-source.sh
#
# Idempotent. Safe to re-run. Drops anything in the mirror's skills/ that no
# longer exists in the canonical source so deletes propagate.

set -euo pipefail

# Resolve repo root regardless of CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIRROR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MIRROR_DIR}/../.." && pwd)"

CANONICAL="${REPO_ROOT}/skills"
TARGET="${MIRROR_DIR}/skills"

if [[ ! -d "${CANONICAL}" ]]; then
  echo "FATAL: canonical source ${CANONICAL} not found." >&2
  exit 1
fi

echo "[sync] canonical: ${CANONICAL}"
echo "[sync] mirror:    ${TARGET}"

# Mirror with deletes. Skip the _template (development scaffold, not a public skill).
rsync -av --delete \
  --exclude="_template/" \
  --exclude="node_modules/" \
  --exclude=".turbo/" \
  --exclude=".DS_Store" \
  "${CANONICAL}/" "${TARGET}/"

# Also pull the top-level skills/README.md as the per-folder description.
if [[ -f "${REPO_ROOT}/skills/README.md" ]]; then
  cp "${REPO_ROOT}/skills/README.md" "${TARGET}/README.md"
fi

echo "[sync] done. Review with: git -C \"${MIRROR_DIR}\" status"
