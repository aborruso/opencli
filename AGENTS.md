# AGENTS.md

Instructions for an AI agent working with, or through, this repository.

This repo ships two things for two different consumers:

- **OpenCLI adapters** (`plugins/`) — commands you can run.
- **Agent sitemaps** (`sitemaps/`) — navigation graphs telling you how to drive these websites with a real browser, which command to prefer, and how to recover when a page disagrees with memory. Only the sites that need one have one: where the adapter covers everything the pages offer, there is nothing to navigate.

## Install

```bash
npm install -g @jackwener/opencli@2.0.2                 # the CLI itself, Node >= 20.18.1
opencli plugin install github:aborruso/opencli          # every adapter, in one shot
opencli plugin list | jq -r '.data[].name'                # check: the installed plugins
```

The plugin install clones this repo to `~/.opencli/monorepos/opencli/` and symlinks each sub-plugin into `~/.opencli/plugins/`. To install a single site, name the sub-plugin: `opencli plugin install github:aborruso/opencli/eur-lex`.

**JSON output is wrapped** in OpenCLI 2: `-f json`, and the default output when no `-f` is given, print `{"ok": true, "data": [...]}`. Read the rows with `jq '.data[]'`. A failure prints `{"ok": false, "error": {...}}`, with a non-zero exit code.

## Agent discoverability

Every tool must be easy for an agent to discover and orchestrate from the CLI itself. Treat help as part of the command's public interface, not a list of flag names.

- Site help must make available capabilities discoverable; command help must explain inputs, defaults, output fields and the next useful command.
- Explain query languages and meaningful combinations: operators, AND/OR/exclusion behavior, quoting, identifiers and how to discover valid values. Include runnable examples and distinguish native service filters from local adapter filters.
- State important limitations, authentication requirements, date semantics, pagination/completeness behavior and actionable failure hints. Clearly identify offline commands that need no credentials.
- Keep essential guidance in `--help`, available in structured help too. For a larger query language, expose a discoverable read-only reference command such as `syntax`, with JSON output. A README alone is not enough.
- After a command change, inspect human and JSON help and test that the discovery path reaches the necessary syntax without reading source code or guessing. Never include credentials or private inventories in examples.

## Read this before using the commands

Each site has a `README.md` with example commands and their real output, and a `SITE.md` that opens with the rule of engagement for that site. Read the `SITE.md` first — for EUR-Lex in particular it tells you which half of the work you are in, and getting that wrong wastes the whole session.

| Site | Start here | Commands |
|---|---|---|
| law-tracker.europa.eu | [`sitemaps/law-tracker/SITE.md`](sitemaps/law-tracker/SITE.md) | `opencli law-tracker proposals\|events\|search\|timeline\|topics` |
| eur-lex.europa.eu | [`sitemaps/eur-lex/SITE.md`](sitemaps/eur-lex/SITE.md) | `opencli eur-lex search\|get\|meta\|transposition\|sparql` (only `search` needs a browser) |
| esploradati.istat.it | [`plugins/istatdata/README.md`](plugins/istatdata/README.md) — no sitemap | `opencli istatdata ask\|dataset` (no browser) |
| aster.istat.it | [`plugins/aster/README.md`](plugins/aster/README.md) — no sitemap | `opencli aster atlases\|datasets\|dataset\|values\|data` (no browser) |
| opentender.eu | [`plugins/opentender/README.md`](plugins/opentender/README.md) — no sitemap | `opencli opentender stats\|sectors\|tenders\|tender\|companies\|company\|authorities\|authority` (no browser) |
| piao.dfp.gov.it | [`plugins/piao/README.md`](plugins/piao/README.md) — no sitemap | `opencli piao search\|recent\|enti\|ente\|docs` (no browser) |
| raindrop.io | [`plugins/raindrop/README.md`](plugins/raindrop/README.md) — setup and search cookbook | `opencli raindrop search\|get\|collections\|tags\|syntax` (no browser; `syntax` is offline, other commands require `RAINDROP_TOKEN`) |
| koboyo.com | [`plugins/koboyo/README.md`](plugins/koboyo/README.md) — no sitemap | `opencli koboyo search\|get\|groups` (no browser) |
| ec.europa.eu/info/funding-tenders | [`plugins/eu-funding/README.md`](plugins/eu-funding/README.md) — no sitemap | `opencli eu-funding calls\|topic\|updates\|faqs\|faq\|org\|partners\|projects\|codes` (no browser) |

## How to use a sitemap

OpenCLI 2 does not load sitemaps: nothing tells you one exists when a page opens. Before driving the browser on law-tracker or EUR-Lex, read the sitemap yourself from this repo (or from the clone under `~/.opencli/monorepos/opencli/sitemaps/`). Read it lazily: `SITE.md` first, then only the `pages/` or `workflows/` file the task needs. Every file stays small enough to load on demand. Browser commands take the session as an option: `opencli browser open <url> --session <name>`.

A sitemap is a hint. **Live browser state is the truth.** When they disagree, trust the browser and mark the entry stale rather than forcing the old path.

## What these sites are, and how they relate

- **law-tracker** follows the *legislative process*: which stage a file is at, what happened when. Its search matches **procedure titles only**, not the text of the acts.
- **eur-lex** holds the *text of the law*. Its full-text search is the one that finds a subject no title names. `eur-lex.europa.eu` is behind an AWS WAF and answers `HTTP 202` with an empty body to any non-browser client, so `opencli eur-lex search` drives a real browser; `get`, `meta`, `transposition` and `sparql` need none. `get`, `meta` and `transposition` take a CELEX number or an ELI; `transposition` lists the national measures that transpose a directive (`--country ITA`).

**istatdata** is unrelated to the other two: Italian official statistics, not EU law. Its one thing worth knowing is that `ask` is a *dataset finder, not an oracle* — ask it for the average income in a town and it returns the table that holds the figure, never the figure. Getting the number out means downloading the `data` URL, which pulls the whole dataflow unless you narrow it.

**aster** is ISTAT too, but a different source from istatdata: the Statistical Atlas of the Territory, seven atlases on their own hub, with no SDMX endpoint behind them. Unlike istatdata it returns the figure itself: `data` returns one row per observation, code and label of every dimension. Three things to hold: `data` starts from the filter the web table opens with (`dataset` shows it), and `--filter` changes only the dimensions it names; a request too large for the hub fails with an error rather than coming back short; and no observation is `EMPTY_RESULT`, not a zero. The way in is `datasets --grep`, then `dataset`, then `values` for the codes.

**opentender** is European public procurement: 24.5 million tenders of 35 countries and the EU institutions, from TED and national sources (Italy: ANAC open data). The portal is behind Cloudflare; the adapter reads its data server. Four things to hold when you answer with it: one company has one record per spelling of its name, so `companies` lists them all and you decide which are the same company, saying which ones you joined and never on the name alone; the winner is usually a local subsidiary, not the group; amounts come in three kinds (final, estimated, winning bid per lot) that are not summed, because some sources repeat the tender total on every lot, and the server's own `total_value_eur` does double count; Italian tenders have no final price and no CPV. Report the commands you ran, the numbers they gave, and what you could not verify. The way in is `companies` or `authorities`, then `tenders --supplier-id` or `--buyer-id`, then `tender` for the lots.

**piao** is the PIAO plans of Italian public administrations, about 40,000 records. The way in is `enti` for the IPA code, then `ente` for the history, then `docs` for the files. One row is one version: use `--latest` before counting plans. `recent` is not sorted by approval date. `n_dipendenti` is an unlabelled raw value: do not interpret it as fact. A command reads at most 200 portal pages and fails rather than returning a partial list.

**koboyo** is unrelated to all three: a library of 261,740 free hand-drawn SVG icons. Its search is not a server endpoint — the site ships a static JSON index and ranks in the browser — so the adapter ports that ranking and returns what the page would have shown. Three things to hold: the words are **ANDed**, so fewer words find more; names and keywords are **English only**, and an Italian query returns nothing; and every row carries a `page` URL, the same search on the site, which is what to hand to a person who needs to *see* the icons. Commands are read-only: they return URLs and print markup, and never write a file.

**eu-funding** is the EU Funding & Tenders Portal: calls for proposals and tenders, their updates and FAQs, participant organisations, partner searches and funded projects, through the portal's public APIs. The APIs speak in codes; the commands take names and label the codes, and `codes` is the dictionary for anything you write into `--query`. Three things to hold: `--status open` is not what the doc page's "open" sample returns (that one includes forthcoming); a status can be stale, so use `--deadline-after` when "still open" matters; and a range filter written with a bare date does not compare (it only keeps records that have the field, so the count drops and looks right) - write `2026-09-21T00:00:00.000+0000`.

**raindrop** searches the authenticated user's bookmarks, not public web results. Start with `opencli raindrop syntax -f json` for offline operators, combinations and examples; `search --help` includes essential grammar. Read its README for extended examples and dotenvx invocation. It reads `RAINDROP_TOKEN` from the environment; dotenvx is optional and external, not an automatic fallback. `--from`/`--to` refer to inclusive UTC save dates, not publication dates; `--domain x.com,twitter.com` matches exact hosts/subdomains, and `--limit 0` exhausts pages. Native search and local filters are distinct; saved metadata does not prove the full content of a linked thread. Do not publish private inventories or credentials.

Neither EU-law source carries the other's identifier: bridging a procedure to its act means matching on the title or the act number, and that link is inferred, not asserted by either source. Say so when you report it.

## Rules

- Read the `pitfalls.md` of a site before concluding that something is not there. Both EU-law sites have failure modes that look like success: filters silently ignored, `totalResults` reading 0 with results present, a non-existent page returning HTTP 200, and a WAF challenge that is a 202 rather than a 403.
- Never attempt to bypass the WAF, a CAPTCHA, or a rate limit. If the front door needs a browser, use the browser. The ISTAT node declares 10 AI searches every 60 seconds: ask serially, and do not retry in a loop to find out where the ceiling is.
- Do not report a result total that the source does not give you. Report what you actually paged through.
- These commands are all `access: read`. Nothing here writes to any site. The only commands that write anything at all are `albo-palermo attachments` and `palermo-delibere attachments`, which save files to a local folder.

## If you are changing this repo

- Repository language is **English** — READMEs, sitemaps, adapter code, comments, help strings, error messages, `LOG.md`, `tasks/`.
- Everything under `docs/` except `notes.md` is a verbatim upstream mirror: regenerate it from the URLs in `docs/meta.yml`, never hand-edit it.
- Every `evidence:` line in a sitemap must name a command that was actually run. An invented evidence line is worse than a missing action.
- After touching an adapter: `opencli adapter check <site>` must pass. `opencli convention-audit <site>` scans no plugin file (it only sees the adapters inside the npm package, in 1.8 and 2.0 alike), so check its rules by hand: declared columns equal emitted keys, no camelCase column, `access` set, no clamped argument, no silent empty fallback, no sentinel row.
- Keep `LOG.md` current, newest entry on top, dates as `YYYY-MM-DD`.
