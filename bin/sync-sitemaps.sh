#!/usr/bin/env bash
# Link this repo's sitemaps into OpenCLI's local overlay.
# OpenCLI only looks for them in ~/.opencli/sites/<site>/sitemap, so each folder
# under sitemaps/ gets a symlink there.
#
#   bash bin/sync-sitemaps.sh                # link every sitemap
#   bash bin/sync-sitemaps.sh eur-lex        # link only the ones you name
#
# Name the sites you actually installed the adapter for: a sitemap whose
# commands are not installed sends an agent after commands that do not exist.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src_root="$repo_root/sitemaps"
dst_root="$HOME/.opencli/sites"

[ -d "$src_root" ] || { echo "missing $src_root" >&2; exit 1; }

wanted=("$@")
is_wanted() {
  [ ${#wanted[@]} -eq 0 ] && return 0
  for w in "${wanted[@]}"; do [ "$w" = "$1" ] && return 0; done
  return 1
}

for w in "${wanted[@]}"; do
  [ -d "$src_root/$w" ] || { echo "no sitemap named \"$w\" in sitemaps/" >&2; exit 1; }
done

link_one() {
  local name="$1" src="$2" dst="$dst_root/$1/sitemap"
  # Only the sitemap subfolder: sites/<site>/ already holds endpoints.json,
  # notes.md and verify/.
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "SKIP $name: $dst exists and is a real directory, not a link" >&2
    return
  fi
  mkdir -p "$dst_root/$name"
  ln -sfn "$src" "$dst"
  echo "ok $name -> $dst"
}

shopt -s nullglob
for src in "$src_root"/*/; do
  site="$(basename "$src")"
  is_wanted "$site" || continue
  link_one "$site" "${src%/}"
done

# Aliases: alternative site names (e.g. OpenCLI's SLD fallback) pointing at the
# same folder. Format: "<alias>\t<folder under sitemaps/>".
aliases_file="$src_root/aliases.txt"
if [ -f "$aliases_file" ]; then
  while IFS=$'\t' read -r alias site; do
    case "$alias" in ''|'#'*) continue ;; esac
    is_wanted "$site" || continue
    [ -d "$src_root/$site" ] || { echo "SKIP alias $alias: sitemaps/$site is missing" >&2; continue; }
    link_one "$alias" "$src_root/$site"
  done < "$aliases_file"
fi
