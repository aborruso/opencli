# opencli — terminal commands for public data sources

[OpenCLI](https://github.com/jackwener/OpenCLI) turns a website into terminal commands. This repository is a set of those commands for seven public sources — EU legislative procedures, the text of EU law, EU funding calls and projects, Italian official statistics, the official register of the city of Palermo and its permanent archive of deliberations and ordinances, and a library of hand-drawn icons — written so that a person or an agent can query them without opening a browser and without reading an API doc first.

Seven sources, seven commands, and none of them needs a browser or an API key:

```bash
opencli law-tracker timeline 2021_106       # the stages the AI Act went through
opencli eur-lex get 32024R1689              # the full text of the AI Act
opencli eu-funding calls "artificial intelligence" --type grant   # EU grants open now
opencli istatdata ask "reddito medio a Bagheria"   # which ISTAT tables answer a question
opencli albo-palermo list "Avviso Pubblico"   # the latest public notices of Palermo
opencli palermo-delibere search DGC --text "stadio"   # every Giunta deliberation that names the stadium, years back
opencli koboyo search "shopping cart"       # a free hand-drawn SVG icon
```

Every command returns rows, in `table`, `json`, `csv`, `yaml` or plain text, so the output pipes into `jq`, into a spreadsheet or into the next command. The URLs in those rows are ones you can follow: a document to download, a dataset to read, a page to open.

Every command here is `access: read`. Nothing writes to any site. The only commands that write anything at all are `albo-palermo attachments` and `palermo-delibere attachments`, which save the attachments of an act to a local folder.

## Try it

Needs Node ≥ 20.

```bash
npm install -g @jackwener/opencli                       # the CLI itself
opencli plugin install github:aborruso/opencli          # every adapter in this repo
opencli list                                            # what you can now run
```

That is enough for every command but one. Single-site install, sitemap linking and the browser setup are under [Install](#install).

Each adapter has its own README with its commands, its examples and the traps of that particular source. Start from the table below.

## Sites covered

| Site | Sitemap | Adapter |
|---|---|---|
| [EU Law Tracker](https://law-tracker.europa.eu) — the EU legislative process | [`sitemaps/law-tracker/`](sitemaps/law-tracker/README.md) | [`plugins/law-tracker/`](plugins/law-tracker/) — `proposals`, `events`, `search`, `timeline`, `topics` |
| [EUR-Lex](https://eur-lex.europa.eu) — the text of EU law | [`sitemaps/eur-lex/`](sitemaps/eur-lex/README.md) | [`plugins/eur-lex/`](plugins/eur-lex/) — `search`, `get`, `meta`, `sparql` |
| [IstatData](https://esploradati.istat.it/databrowser/) — Italian official statistics | — | [`plugins/istatdata/`](plugins/istatdata/) — `ask`, `dataset` |
| [Koboyo Icons](https://koboyo.com/icons) — 261,740 free hand-drawn SVG icons | — | [`plugins/koboyo/`](plugins/koboyo/) — `search`, `get`, `groups` |
| [Albo Pretorio del Comune di Palermo](https://albopretorio.comune.palermo.it/albopretorio/jsp/home.jsp?modo=info&info=servizi.jsp) — the acts of the city of Palermo in publication | — | [`plugins/albo-palermo/`](plugins/albo-palermo/) — `types`, `list`, `search`, `get`, `dump`, `attachments`, `similar` |
| [Delibere e Ordinanze del Comune di Palermo](https://servizionline.comune.palermo.it/portcitt/jsp/home.jsp?modo=info&info=servizi.jsp&SERCOD=60&SERCODROOT=60) — the permanent archive of the city's deliberations, determinations and ordinances | — | [`plugins/palermo-delibere/`](plugins/palermo-delibere/) — `sections`, `list`, `search`, `get`, `attachments`, `dump`, `from-albo` |
| [EU Funding & Tenders Portal](https://ec.europa.eu/info/funding-tenders/opportunities/portal/) — EU calls, tenders and funded projects | — | [`plugins/eu-funding/`](plugins/eu-funding/) — `calls`, `topic`, `updates`, `faqs`, `faq`, `org`, `partners`, `projects`, `codes` |

The first two are complementary and cross-reference each other: law-tracker follows the legislative process and only searches procedure titles; EUR-Lex holds the acts and searches their full text.

**koboyo has no sitemap either**, for the same reason and more so: its search page is the only page worth driving, and the adapter reproduces it exactly, ranking included.

**eu-funding has no sitemap either.** Everything the portal shows comes from public APIs the adapter wraps. The one browser step the portal's own doc prescribes, building a filter in the page and copying its query out of the developer tools, is replaced by `--query` and `codes`.

**albo-palermo has no sitemap either.** The portal is server-rendered HTML, and the adapter walks the same session the pages do: list, detail, next page, filter. The one thing a person gets from the page and not from a list row, the permanent link behind "Copia", is in every row the adapter returns.

**palermo-delibere has no sitemap either**, for the same reason: it is the same SISPI application as the Albo, with the same records. The Albo shows an act while it is in publication; this portal keeps it afterwards, and `from-albo` turns an Albo link into the permanent one.

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
opencli list | grep -E 'law-tracker|eur-lex|istatdata|koboyo|eu-funding|albo-palermo|palermo-delibere'  # check
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

Verified end to end on 2026-08-28: `Installed 2 plugin(s) from monorepo: eur-lex, law-tracker`, then the sync script links both sitemaps and `opencli browser <sess> open` reports `sitemap.available: true`. A site with no sitemap, such as `istatdata`, `koboyo`, `eu-funding`, `albo-palermo` or `palermo-delibere`, simply has nothing for the script to link.

### Working on this repo instead of using it

The install above points OpenCLI at the clone under `~/.opencli/monorepos/`. To edit the adapters and sitemaps in your own working copy and see the changes live, install from the working copy instead:

```bash
opencli plugin install "file://$PWD/plugins/law-tracker"
opencli plugin install "file://$PWD/plugins/eur-lex"
opencli plugin install "file://$PWD/plugins/istatdata"
opencli plugin install "file://$PWD/plugins/koboyo"
opencli plugin install "file://$PWD/plugins/eu-funding"
opencli plugin install "file://$PWD/plugins/albo-palermo"
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

They stay together because the sitemaps reference each other: law-tracker follows the legislative process and points at EUR-Lex for the text of an act, EUR-Lex points back for the procedure behind it. Split across repositories those links become external URLs that rot silently, and `docs/`, `bin/` and `AGENTS.md` would have to be duplicated in each. A site that cross-references nothing, like istatdata, koboyo, eu-funding, albo-palermo or palermo-delibere, stays here for the second reason alone.

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
