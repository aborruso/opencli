# opencli — notes and site sitemaps

Two things in one repository, both built around [OpenCLI](https://github.com/jackwener/OpenCLI), the tool that turns websites into terminal commands.

- **`docs/`** — a verbatim mirror of the upstream documentation (`docs/meta.yml` records provenance and checksums) plus `docs/notes.md`, hand-written notes on the parts that are not obvious: Browser Bridge setup on WSL2, the three-case model, field traps.
- **`sitemaps/`** and **`plugins/`** — one navigation graph and one adapter per site.

## Install

Requires Node ≥ 20.

```bash
npm install -g @jackwener/opencli                       # the CLI itself
opencli plugin install github:aborruso/opencli          # both adapters from this repo
bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh  # link the sitemaps into place
opencli list | grep -E 'law-tracker|eur-lex'            # check
```

The plugin install clones this repo to `~/.opencli/monorepos/opencli/` and symlinks each sub-plugin declared in the root `opencli-plugin.json` into `~/.opencli/plugins/`. One adapter only: `opencli plugin install github:aborruso/opencli/eur-lex`.

The sitemaps come with the clone but OpenCLI does not link them itself — there is no install mechanism for sitemaps, which is what `bin/sync-sitemaps.sh` is for.

Verified end to end on 2026-08-28: `Installed 2 plugin(s) from monorepo: eur-lex, law-tracker`, then the sync script links both sitemaps and `opencli browser <sess> open` reports `sitemap.available: true`.

Agents should start from [`AGENTS.md`](AGENTS.md).

### Working on this repo instead of using it

The install above points OpenCLI at the clone under `~/.opencli/monorepos/`. To edit the adapters and sitemaps in your own working copy and see the changes live, install from the working copy instead:

```bash
opencli plugin install "file://$PWD/plugins/law-tracker"
opencli plugin install "file://$PWD/plugins/eur-lex"
bash bin/sync-sitemaps.sh
```

```bash
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
| [EUR-Lex](https://eur-lex.europa.eu) — the text of EU law | [`sitemaps/eur-lex/`](sitemaps/eur-lex/README.md) | [`plugins/eur-lex/`](plugins/eur-lex/) — `get`, `meta`, `sparql` |

The two are complementary and cross-reference each other: law-tracker follows the legislative process and only searches procedure titles; EUR-Lex holds the acts and searches their full text.

## Licence and provenance

MIT, see [`LICENSE`](LICENSE) — for what is written here: the sitemaps, the adapters, the scripts and the notes.

Everything under `docs/` except `notes.md` is a verbatim mirror of the [OpenCLI](https://github.com/jackwener/OpenCLI) documentation, which is Apache-2.0 and belongs to its authors. `docs/meta.yml` records the source URL and the sha256 of every mirrored file.

The agent skills this repo is written against (`opencli-usage`, `opencli-browser`, `opencli-browser-sitemap`, `opencli-sitemap-author`, `opencli-adapter-author`, `opencli-autofix`) are not redistributed here. Install them separately:

```bash
npx skills add jackwener/opencli
```

`skills-lock.json` records which ones, and at which version, this repo was written against.

## Editing rules

Everything under `docs/` except `notes.md` is a verbatim upstream copy: never edit it by hand, regenerate it from the URLs in `docs/meta.yml`. Everything else — `sitemaps/`, `plugins/`, `bin/`, `tasks/`, `LOG.md` — is hand-written. See `CLAUDE.md`.
