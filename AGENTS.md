# AGENTS.md

Instructions for an AI agent working with, or through, this repository.

This repo ships two things for two different consumers:

- **OpenCLI adapters** (`plugins/`) — commands you can run.
- **Agent sitemaps** (`sitemaps/`) — navigation graphs telling you how to drive these websites with a real browser, which command to prefer, and how to recover when a page disagrees with memory. Only the sites that need one have one: where the adapter covers everything the pages offer, there is nothing to navigate.

## Install

```bash
npm install -g @jackwener/opencli                       # the CLI itself, Node >= 20
opencli plugin install github:aborruso/opencli          # every adapter, in one shot
bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh  # link the sitemaps into place
opencli list | grep -E 'law-tracker|eur-lex|istatdata'  # check
```

The plugin install clones this repo to `~/.opencli/monorepos/opencli/` and symlinks each sub-plugin into `~/.opencli/plugins/`. The sitemaps travel with the clone but OpenCLI does not link them itself — that is what the sync script is for. It only ever creates `~/.opencli/sites/<site>/sitemap` symlinks and refuses to overwrite a real directory.

To install a single site, name the sub-plugin and sync only its sitemap:

```bash
opencli plugin install github:aborruso/opencli/eur-lex
bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh eur-lex
```

The clone carries every sitemap whichever adapter you install, so name the ones you want. A sitemap whose adapter is not installed will send you after commands that do not exist.

## Read this before using the commands

Each site has a `README.md` with example commands and their real output, and a `SITE.md` that opens with the rule of engagement for that site. Read the `SITE.md` first — for EUR-Lex in particular it tells you which half of the work you are in, and getting that wrong wastes the whole session.

| Site | Start here | Commands |
|---|---|---|
| law-tracker.europa.eu | [`sitemaps/law-tracker/SITE.md`](sitemaps/law-tracker/SITE.md) | `opencli law-tracker proposals\|events\|search\|timeline\|topics` |
| eur-lex.europa.eu | [`sitemaps/eur-lex/SITE.md`](sitemaps/eur-lex/SITE.md) | `opencli eur-lex search\|get\|meta\|sparql` (only `search` needs a browser) |
| esploradati.istat.it | [`plugins/istatdata/README.md`](plugins/istatdata/README.md) — no sitemap | `opencli istatdata ask\|dataset` (no browser) |

## How to use a sitemap

When `opencli browser <session> open <url>` returns `"sitemap": {"available": true, ...}`, load the `opencli-browser-sitemap` skill (`opencli skills read opencli-browser-sitemap`) and follow it. Read the sitemap lazily: `SITE.md` first, then only the `pages/` or `workflows/` file the task needs. Every file stays small enough to load on demand.

**The announcement fires once per browser session per site.** A second `open` in the same session returns `"sitemap": null` even when one exists. Do not conclude there is no sitemap from that: check `~/.opencli/sites/<site>/sitemap/` directly, or open with a fresh session name.

A sitemap is a hint. **Live browser state is the truth.** When they disagree, trust the browser and mark the entry stale rather than forcing the old path.

## What these sites are, and how they relate

- **law-tracker** follows the *legislative process*: which stage a file is at, what happened when. Its search matches **procedure titles only**, not the text of the acts.
- **eur-lex** holds the *text of the law*. Its full-text search is the one that finds a subject no title names. `eur-lex.europa.eu` is behind an AWS WAF and answers `HTTP 202` with an empty body to any non-browser client, so `opencli eur-lex search` drives a real browser; `get`, `meta` and `sparql` need none.

**istatdata** is unrelated to the other two: Italian official statistics, not EU law. Its one thing worth knowing is that `ask` is a *dataset finder, not an oracle* — ask it for the average income in a town and it returns the table that holds the figure, never the figure. Getting the number out means downloading the `data` URL, which pulls the whole dataflow unless you narrow it.

Neither EU-law source carries the other's identifier: bridging a procedure to its act means matching on the title or the act number, and that link is inferred, not asserted by either source. Say so when you report it.

## Rules

- Read the `pitfalls.md` of a site before concluding that something is not there. Both EU-law sites have failure modes that look like success: filters silently ignored, `totalResults` reading 0 with results present, a non-existent page returning HTTP 200, and a WAF challenge that is a 202 rather than a 403.
- Never attempt to bypass the WAF, a CAPTCHA, or a rate limit. If the front door needs a browser, use the browser. The ISTAT node declares 10 AI searches every 60 seconds: ask serially, and do not retry in a loop to find out where the ceiling is.
- Do not report a result total that the source does not give you. Report what you actually paged through.
- These commands are all `access: read`. Nothing here writes anything anywhere.

## If you are changing this repo

- Repository language is **English** — READMEs, sitemaps, adapter code, comments, help strings, error messages, `LOG.md`, `tasks/`.
- Everything under `docs/` except `notes.md` is a verbatim upstream mirror: regenerate it from the URLs in `docs/meta.yml`, never hand-edit it.
- Every `evidence:` line in a sitemap must name a command that was actually run. An invented evidence line is worse than a missing action.
- After touching an adapter: `opencli validate <site>` and `opencli convention-audit <site>` must both pass. The audit catches the ways an adapter can lie to you — dropped columns, silent empty fallbacks, sentinel rows, clamped arguments.
- Keep `LOG.md` current, newest entry on top, dates as `YYYY-MM-DD`.
