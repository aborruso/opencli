#!/usr/bin/env bash
# Aggancia le sitemap di questo repo all'overlay locale di OpenCLI.
# OpenCLI le cerca solo in ~/.opencli/sites/<site>/sitemap (o nel pacchetto npm):
# qui si crea un symlink per ogni cartella sotto sitemaps/.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src_root="$repo_root/sitemaps"
dst_root="$HOME/.opencli/sites"

[ -d "$src_root" ] || { echo "manca $src_root" >&2; exit 1; }

shopt -s nullglob
for src in "$src_root"/*/; do
  site="$(basename "$src")"
  dst="$dst_root/$site/sitemap"
  # solo la sottocartella sitemap: sites/<site>/ ospita gia' endpoints.json, notes.md, verify/
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "SALTO $site: $dst esiste ed e' una cartella vera, non un link" >&2
    continue
  fi
  mkdir -p "$dst_root/$site"
  ln -sfn "${src%/}" "$dst"
  echo "ok $site -> $dst"
done

# Alias: nomi di sito alternativi (es. il fallback SLD di opencli) che devono
# puntare alla stessa cartella. Formato: "<alias>\t<cartella in sitemaps/>".
aliases_file="$src_root/aliases.txt"
if [ -f "$aliases_file" ]; then
  while IFS=$'\t' read -r alias site; do
    case "$alias" in ''|'#'*) continue ;; esac
    [ -d "$src_root/$site" ] || { echo "SALTO alias $alias: manca sitemaps/$site" >&2; continue; }
    dst="$dst_root/$alias/sitemap"
    if [ -e "$dst" ] && [ ! -L "$dst" ]; then
      echo "SALTO alias $alias: $dst esiste ed e' una cartella vera" >&2
      continue
    fi
    mkdir -p "$dst_root/$alias"
    ln -sfn "$src_root/$site" "$dst"
    echo "ok alias $alias -> $site"
  done < "$aliases_file"
fi
