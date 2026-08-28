# opencli — notes and site sitemaps

Two things in one repository, both built around [OpenCLI](https://github.com/jackwener/OpenCLI), the tool that turns websites into terminal commands.

- **`docs/`** — a verbatim mirror of the upstream documentation (`docs/meta.yml` records provenance and checksums) plus `docs/notes.md`, hand-written notes on the parts that are not obvious: Browser Bridge setup on WSL2, the three-case model, field traps.
- **`sitemaps/`** and **`plugins/`** — one navigation graph and one adapter per site.

## Install the CLI

Requires Node ≥ 20.

```bash
npm install -g @jackwener/opencli
opencli --version
opencli list                 # every command available
opencli doctor               # daemon and browser-extension health
```

Many commands need nothing else: the local daemon calls the site's public API and no browser is involved. Commands that must drive a real page need the **Browser Bridge** Chrome extension connected — see `docs/notes.md` for the WSL2 setup.

## What a sitemap is here

Not an SEO sitemap. A **task execution graph for agents**: a folder of Markdown that tells whoever is driving `opencli browser` where it is, which actions exist, which adapter to prefer, and how to recover when the live page disagrees with memory.

```
sitemaps/<site>/
  README.md               # what this site is, example commands, example output
  SITE.md                 # purpose, auth, top-level routes
  pages/<page-id>.md      # anchors and actions (pre/do/post/fail/recover/evidence)
  workflows/<task-id>.md  # best path, fallback path, avoid list
  pitfalls.md             # durable failure modes
```

OpenCLI only looks for sitemaps in `~/.opencli/sites/<site>/sitemap/` (and inside the npm package). Link this repo's sitemaps into place with:

```bash
bash bin/sync-sitemaps.sh
```

The script symlinks **only** the `sitemap` subfolder, never `sites/<site>` itself — that folder already holds `endpoints.json`, `notes.md` and `verify/`. `sitemaps/aliases.txt` handles the case where OpenCLI resolves a host to a different site name; read the warning in that file before adding one.

Verify a sitemap is found:

```bash
opencli browser <session> open <url>     # look for "sitemap": { "available": true }
```

## Plugins

Adapters live in `plugins/<site>/` and are installed once:

```bash
opencli plugin install "file://$PWD/plugins/<site>"
opencli validate <site>
```

## Sites covered

| Site | Sitemap | Adapter |
|---|---|---|
| [EU Law Tracker](https://law-tracker.europa.eu) — the EU legislative process | [`sitemaps/law-tracker/`](sitemaps/law-tracker/README.md) | [`plugins/law-tracker/`](plugins/law-tracker/) — `proposals`, `events`, `search`, `timeline`, `topics` |

## Editing rules

Everything under `docs/` except `notes.md` is a verbatim upstream copy: never edit it by hand, regenerate it from the URLs in `docs/meta.yml`. Everything else — `sitemaps/`, `plugins/`, `bin/`, `tasks/`, `LOG.md` — is hand-written. See `CLAUDE.md`.
