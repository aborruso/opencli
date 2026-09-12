# opencli — terminal commands for public data sources

[OpenCLI](https://github.com/jackwener/OpenCLI) turns a website into terminal commands. This repository is a set of those commands for three public sources — EU legislative procedures, the text of EU law, and Italian official statistics — written so that a person or an agent can query them without opening a browser and without reading an API doc first.

One question in plain language, and out come the datasets that answer it — this is real output, not an illustration:

```console
$ opencli istatdata ask "reddito medio del comune di Bagheria" --limit 1
id: IT1,30_1008_DF_MEF_REDDITIIRPEF_COM_2,1.0
title: Contribuenti e reddito complessivo per classi di importo
category: Condizioni economiche delle famiglie e disuguaglianze > Reddito delle persone fisiche (Irpef)  - comuni
similarity: 1.479233
table: https://esploradati.istat.it/databrowser/#/it/dw/categories/IT1,HOU,1.0/MEF_REDDITIIRPEF_COM/IT1,30_1008_DF_MEF_REDDITIIRPEF_COM_2,1.0
data: https://esploradati.istat.it/SDMXWS/rest/data/IT1,30_1008_DF_MEF_REDDITIIRPEF_COM_2,1.0/?format=csv
aiTitle: Distribuzione del reddito delle persone fisiche per classi di importo nei comuni italiani
description: Le dimensioni di analisi presenti nella tavola sono Frequenza, Territorio, Indicatore, Classe di importo, Tempo.
I dati diffusi riguardano: contribuenti per classe di importo, reddito per classi di importo.
Frequenza di aggiornamento dei dati: annuale.
Ultimo aggiornamento di dati e/o metadati: 09/15/2025 08:45:27.
sessionId: wdKu96UGP3HoD7H6z7u3p
```

No key, no login, no browser. `data` is a URL you can pipe straight into DuckDB. The other two sites have the same shape: `opencli eur-lex get 32024R1689` prints the text of the AI Act, `opencli law-tracker timeline 2021_106` prints the stages a proposal went through.

Every command here is `access: read`. Nothing writes anything anywhere.

## Try it

Needs Node ≥ 20.

```bash
npm install -g @jackwener/opencli                       # the CLI itself
opencli plugin install github:aborruso/opencli          # every adapter in this repo
opencli istatdata ask "incidenti stradali in Sicilia"   # a first question
```

That is enough for every command but one. Single-site install, sitemap linking and the browser setup are under [Install](#install).

## Sites covered

| Site | Sitemap | Adapter |
|---|---|---|
| [EU Law Tracker](https://law-tracker.europa.eu) — the EU legislative process | [`sitemaps/law-tracker/`](sitemaps/law-tracker/README.md) | [`plugins/law-tracker/`](plugins/law-tracker/) — `proposals`, `events`, `search`, `timeline`, `topics` |
| [EUR-Lex](https://eur-lex.europa.eu) — the text of EU law | [`sitemaps/eur-lex/`](sitemaps/eur-lex/README.md) | [`plugins/eur-lex/`](plugins/eur-lex/) — `search`, `get`, `meta`, `sparql` |
| [IstatData](https://esploradati.istat.it/databrowser/) — Italian official statistics | — | [`plugins/istatdata/`](plugins/istatdata/) — `ask`, `dataset` |

The first two are complementary and cross-reference each other: law-tracker follows the legislative process and only searches procedure titles; EUR-Lex holds the acts and searches their full text.

**istatdata has no sitemap on purpose.** Its public API covers exactly what the web form does, so an agent holding the adapter has no reason to open the Data Browser, and a navigation graph would describe a path nobody walks. One gets written the day something worth reaching is only reachable through the pages — the data preview beside a result, for instance, which is not wrapped.

Commands talk to a public API through OpenCLI's local daemon and need **no browser**. The single exception is `eur-lex search`: EUR-Lex full-text search exists nowhere but on the site itself, which sits behind an AWS WAF, so that one command drives a real Chrome through the **Browser Bridge** extension.

## What is in this repository

- **`plugins/`** — the adapters, one folder per site. This is the part you install.
- **`sitemaps/`** — navigation graphs for an agent that has to drive the pages of a site itself: which pages exist, what to click, where it will get stuck. Only the sites that need one have one.
- **`docs/`** — a verbatim mirror of the upstream OpenCLI documentation (`docs/meta.yml` records provenance and checksums) plus `docs/notes.md`, hand-written notes on the parts that are not obvious: Browser Bridge setup on WSL2, the three-case model, field traps.

Agents should start from [`AGENTS.md`](AGENTS.md).

## Install

```bash
npm install -g @jackwener/opencli                       # the CLI itself
opencli plugin install github:aborruso/opencli          # every adapter in this repo
bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh  # link the sitemaps into place
opencli list | grep -E 'law-tracker|eur-lex|istatdata'  # check
```

The plugin install clones this repo to `~/.opencli/monorepos/opencli/` and symlinks each sub-plugin declared in the root `opencli-plugin.json` into `~/.opencli/plugins/`.

The sitemaps come with the clone but OpenCLI does not link them itself — there is no install mechanism for sitemaps, which is what `bin/sync-sitemaps.sh` is for.

### Installing one site only

Append the sub-plugin name, then sync only that sitemap:

```bash
opencli plugin install github:aborruso/opencli/eur-lex
bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh eur-lex
```

Sync the sitemap for a site whose adapter you did not install and an agent will follow it to commands that do not exist — the clone carries every sitemap regardless of which adapter you picked, so name the ones you want. With no arguments the script links them all.

Verified end to end on 2026-08-28: `Installed 2 plugin(s) from monorepo: eur-lex, law-tracker`, then the sync script links both sitemaps and `opencli browser <sess> open` reports `sitemap.available: true`. A site with no sitemap, such as `istatdata`, simply has nothing for the script to link.

### Working on this repo instead of using it

The install above points OpenCLI at the clone under `~/.opencli/monorepos/`. To edit the adapters and sitemaps in your own working copy and see the changes live, install from the working copy instead:

```bash
opencli plugin install "file://$PWD/plugins/law-tracker"
opencli plugin install "file://$PWD/plugins/eur-lex"
opencli plugin install "file://$PWD/plugins/istatdata"
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

## Why one repository

Each site can be installed on its own — `opencli plugin install github:aborruso/opencli/<site>` registers only that adapter, `opencli plugin update` only touches the sub-plugins you installed, and each carries its own version number. So separate repositories would buy nothing operationally.

They stay together because the sitemaps reference each other: law-tracker follows the legislative process and points at EUR-Lex for the text of an act, EUR-Lex points back for the procedure behind it. Split across repositories those links become external URLs that rot silently, and `docs/`, `bin/` and `AGENTS.md` would have to be duplicated in each. A site that cross-references nothing, like istatdata, stays here for the second reason alone.

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
