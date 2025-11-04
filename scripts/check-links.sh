#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/check-links.sh [paths...]

Runs markdown-link-check against the provided markdown files. If no paths are
supplied, the script scans all docs/ markdown files.

Dependencies:
  - Node.js 20+
  - npx (ships with Node.js)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${REPO_ROOT}/.markdown-link-check.json"

mapfile -t TARGETS < <(
  if [[ $# -gt 0 ]]; then
    for path in "$@"; do
      if [[ -d "$path" ]]; then
        find "$path" -type f -name '*.md'
      else
        echo "$path"
      fi
    done
  else
    find "${REPO_ROOT}/docs" -type f -name '*.md'
  fi |
  sort -u
)

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "No markdown files found." >&2
  exit 1
fi

STATUS=0
for file in "${TARGETS[@]}"; do
  echo "Checking links in ${file}"
  if ! npx -y markdown-link-check "${file}" -q -c "${CONFIG_FILE}"; then
    STATUS=1
  fi
done

exit ${STATUS}
