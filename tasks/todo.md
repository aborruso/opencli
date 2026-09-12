# Plan — a collection of OpenCLI sitemaps in one repository

Status: in progress. Updated 2026-08-28.

## What was verified (facts, not guesses)

Sources: the mirrored `docs/`, DeepWiki on `jackwener/OpenCLI`, and above all the installed CLI's source (`dist/src/cli.js`, v1.8.6) plus the on-disk `opencli-sitemap-author` skill.

1. **A sitemap is not an SEO sitemap**: it is a "task execution graph" for agents — `SITE.md`, `pages/<page-id>.md`, `pages/_<partial>.md`, `workflows/<task-id>.md`, `pitfalls.md`, all Markdown with front matter (`schema_version`, `site`, `last_verified`, `source`, `login_required`, `auth_strategy`).
2. **Only two discovery paths** (`sitemapPathsForSite`, cli.js:192):
   - local: `~/.opencli/sites/<safeSite>/sitemap/` (or `sitemap.md`)
   - global: `<packageRoot>/sitemaps/<safeSite>/` — inside the npm package, so not ours
   No third path, no env var (`OPENCLI_DIR` does not apply here: it uses `os.homedir()`).
3. **Plugins do not carry sitemaps.** `opencli-plugin.json` registers commands, nothing else. So a single repo can only be hooked up by symlinking into the local overlay.
4. **The folder name is not the hostname** (`siteNameCandidatesFromUrl`, cli.js:156): first the `site` of any adapter whose `domain` matches the host, then the **SLD label alone** as a fallback. Verified: with an empty registry, `servizionline.asl.taranto.it` → `taranto`, `opendata.comune.palermo.it` → `palermo`. With the adapter loaded, the adapter's name wins — confirmed at runtime for law-tracker.
5. **Symlinks**: discovery uses `fs.existsSync`, which follows them. Link **only** the `sitemap` subfolder, never `sites/<site>` — that one already holds `endpoints.json`, `notes.md`, `verify/`.
6. Precedent already in place: `~/.opencli/plugins/asl-taranto -> ~/git/idee/albo-asl-taranto` plus `plugins.lock.json`. Same pattern, applied to sitemaps.

## Phases

### Phase 0 — decisions
- [x] Repo = this folder. `git init` done 2026-08-28.
- [x] Pilot site: **law-tracker.europa.eu** (EU Law Tracker).

### Phase 1 — repository scaffolding
- [x] `sitemaps/` and `bin/sync-sitemaps.sh` created. The script skips a `sites/<site>/sitemap` that is a real folder rather than a link, so existing knowledge is never overwritten.
- [x] `CLAUDE.md` extended: `sitemaps/`, `plugins/`, `bin/`, `tasks/` are hand-written, not mirrored. Repo language rule added.
- [x] Layout instantiated with `law-tracker`. `bash bin/sync-sitemaps.sh` prints the link.

### Phase 2 — acceptance test — DONE
- [x] `opencli browser lt open .../homepage` → `sitemap.available: true`, `source: local`, `paths.local` = `~/.opencli/sites/law-tracker/sitemap` (symlink into the repo).
- [x] Resolved name: **`law-tracker`**. The adapter's `domain` beats the SLD fallback, as expected.
- [x] Anchors re-verified with `opencli browser`: `/results` has `title: Search results`; on `/procedure/2021_106` a find on the reference returns 1 match, on `/procedure/9999_1` it answers `semantic_not_found`.
- [x] The `europa` alias was evaluated and dropped: it would serve this sitemap to every `*.europa.eu` site (verified on eur-lex and commission). The alias mechanism stays in `bin/sync-sitemaps.sh` for collision-free cases.

### Phase 3 — first real sitemap (pilot) — DONE
- [x] Recon with agent-browser: homepage, results page, procedure page, Advanced Search panel, Browse by topic.
- [x] API contracts re-verified with curl, one endpoint at a time (5 endpoints plus the vocabularies).
- [x] Plugin `plugins/law-tracker/` with 5 commands; `opencli validate law-tracker` → PASS; all exercised live.
- [x] Sitemap: SITE.md, pages/{homepage,results,procedure}.md, workflows/{find-procedures,track-procedure,whats-new}.md, pitfalls.md (12 entries).
- [x] Site memory: `~/.opencli/sites/law-tracker/{endpoints.json,notes.md}`.
- [x] READMEs: repository root and `sitemaps/law-tracker/README.md` with example commands and real output.
- [ ] `verify/<cmd>.json`: `opencli browser verify` does not see adapters installed as plugins (it only looks in `~/.opencli/clis/`). Decide whether to eject them or let it go.

### Phase 4 — generalise — DONE
- [x] Second sitemap, `eur-lex`, from the same template. It generalises: same layout, same symlink mechanism, and the resolved site name is `eur-lex` thanks to the adapter's `domain`.
- [x] The two sitemaps cross-reference each other (law-tracker = process, eur-lex = text). This is what a single repo buys over one repo per sitemap.
- [x] New shape validated: a workflow whose best path is the browser rather than an adapter (EUR-Lex search behind a WAF).
- [x] Repository README: what is here, how to sync.
- [x] `LOG.md` kept up to date.

### Phase 5 — align the mirror
- [ ] Add to `docs/meta.yml` and download: `SKILL-opencli-browser-sitemap.md`, `SKILL-opencli-sitemap-author.md`, `references/sitemap-schema.md`. They are missing today and the repo is now sitemap-centric → check: sha256/bytes regenerated.

### Phase 6 — third site: IstatData AI search — DONE

Goal: bring the AI search form of `esploradati.istat.it/databrowser/#/it/dw/search?ai=true` to the command line as an OpenCLI adapter. The Python tool `andy-tools/tools/istatdata-ai` already did the reverse engineering; this is a port to OpenCLI, not a new discovery.

#### Strategy note (skill Step 6 — mandatory before any code)

```
Strategy: PUBLIC_API
Contract: internal-unstable (undocumented product-internal hub endpoint, no public spec)
Evidence:
- observed request: POST https://esploradati.istat.it/databrowserhub/api/core/nodes/1/AI/ExecuteSearch
                    body {session_id, request, aiSearchMaxResults, aiRateLimiting, action:{type:"query"}}
                    header UserLang: it|en
                    plus GET .../nodes/1/catalog (1.48 MB, ~2 s) for titles and category paths
- auth source: none. No cookie, no token, no browser.
- replay result: three live calls on 2026-09-12, all HTTP 200 with non-empty `chatContext.dataproducts`:
  (1) "incidenti stradali in Sicilia", it -> 5 ids, titles filled
  (2) same session_id + "e solo a Palermo?" -> 4-turn conversation, different id set (session works)
  (3) "population of Italian municipalities", en -> 3 ids, `title`/`ai_title` EMPTY (catalog join is load-bearing)
  catalog: HTTP 200, keys categoryGroups / datasetMap / datasetUncategorized
Fragility to watch: `aiRateLimiting` is mandatory and echoes the node's own declared
`AIRateLimiting` extra. If the node changes those numbers, the hardcoded payload is the
first thing to drift. Read it from `GET nodes/{node}` instead of hardcoding.
```

No browser: `browser: false`, so `func: async (args)` - a single-argument signature. Do not copy `eur-lex/search.js` (browser adapter, `(page, args)`); copy `eur-lex/get.js`.

#### Commands (two, not five)

- `opencli istatdata ask "<question>"` -> one row per dataset: `id`, `title`, `aiTitle`, `category`, `similarity`, `table` (Data Browser URL), `data` (SDMX-CSV URL), `description`. `--session-id` continues a conversation; the new `session_id` goes in `footerExtra`, not in a row.
- `opencli istatdata dataset "<id>"` -> the same row for one known id, straight from the catalog, no AI call.

Dropped from the Python tool: `repl`, `catalog info`, `catalog refresh`, `--json`, `--no-links`. OpenCLI provides the shell, the output formats and the table itself; re-implementing them would be duplication.

#### Steps

- [x] `plugins/istatdata/` with `opencli-plugin.json`, `package.json`, `shared.js`, `ask.js`, `dataset.js`. `opencli validate istatdata` -> PASS, 2 commands, 0 warnings.
- [x] `shared.js`: the ExecuteSearch POST, the node-settings read, the catalog fetch, the id -> {title, categoryIds, categoryLabels} join, the two URL builders. Checked: `ask` and `dataset` on `IT1,41_287_DF_DCIS_INDINCIDENT_1,1.0` agree on title and links.
- [x] Error handling, all exercised: unknown id and malformed id and bad `--lang` -> ARGUMENT (exit 2); unknown node -> COMMAND_EXEC (exit 1); a question with no answer -> EMPTY_RESULT (exit 66), met for real by asking "e per le donne?" with no `--session-id`, which out of context matches nothing. The body-first guard was tested against three synthetic 200 responses (errorCode, rate-limit errorCode, missing chatContext) plus a 429 and a catalog without `datasetMap`: five throws, zero silent empty tables.
- [x] Registered in the root `opencli-plugin.json` (that map is what the github install path reads) and installed locally.
- [x] Live runs. First result for "qual è il reddito medio del comune di Bagheria" matches the Python tool's README byte for byte, table URL included - that is the eyeball check against a known-good reference. Session continuation verified end to end through the CLI: read `sessionId` from `-f json`, pass it to `--session-id`, get a different result set. Also verified from a clean `env -i` shell outside the repo.
- [x] Site memory `~/.opencli/sites/istatdata/{endpoints.json,notes.md}`, `verified_at` 2026-09-12.
- [x] `README.md`, `AGENTS.md`, `plugins/istatdata/README.md`, `LOG.md`.
- [x] Every declared example run. One in the plugin README did not work and was replaced: DuckDB reading the SDMX-CSV URL directly gets `HTTP 416`, because that service does not serve byte ranges. Now it is curl to a file, then `read_csv` on the file (1 MB in 14 s). `opensdmx` is now the documented downstream tool, with a command verified end to end (231 rows in 22 s, labels resolved, dataflow id taken straight from an `ask` result). Its three apparent failures were all measurement errors of mine: `-o csv` after `get` rather than before, an `info` run killed by my own 110 s limit mid retry-loop, and a `get` backgrounded at a 120 s harness timeout that looked like "exit 0, no output".

#### Decisions taken while building

- **Root description widened** to "for public data sources"; the README already said "notes and site sitemaps" and needed no change on that point.
- **No sitemap**, per the reasoning now written into the README: the API covers what the form does, so the graph would describe a path nobody walks.
- **`aiRateLimiting` read live** from `GET nodes/{node}` (13 kB), falling back to the known values only if that call fails. It is the field most likely to drift and a drift would be silent.
- **Catalog: fail loudly**, no degraded rows. `dataset` is meaningless without it, and null `category`/`table` is the silent-column-drop shape.
- **No catalog cache in v1.** ~5 s per question end to end, measured. Revisit if it bites.
- **`sessionId` is a column, not `footerExtra`.** This was the one real design change against the plan. `footerExtra` renders only in `table` format, and `table` auto-downgrades to yaml whenever stdout is not a TTY, so in every pipe and every machine-readable format the value is gone - which makes `--session-id` an option whose input cannot be obtained. It repeats identically down the column; that is the price. `eur-lex search` has the same exposure with its `_total`, but there the value is informational, not an input to the next call.
- **`motivation` not surfaced.** A single letter with no legend anywhere in the application. A column of undocumented letters is noise; documented in the README as deliberately absent.

#### Still open

- **Unverified: what the node does past its declared 10 requests / 60 s.** Not tested, and not going to be: testing means deliberately tripping a public service. HTTP 429 and an `errorCode` matching /rate|limit/ are both mapped to a rate-limit error, and that mapping is written down as an assumption in the site notes.
- The documented "HTTP 200 with an errorCode" quirk answered **HTTP 500** on 2026-09-12 with the same body. Either the hub gained a proper status since 2026-08-24, or the two measurements are not the same case. The guard reads the body first and so covers both; worth re-checking if anything else on this hub starts behaving oddly.
- `opencli browser verify` still does not see plugin-installed adapters, so istatdata has no `verify/<cmd>.json` either. Same limitation as open question 1 of this plan, now on three sites.

## Conventions
- `source:` in front matter: the content lives in the repo but is mounted at the local-overlay path → for the runtime it is `source: local`. Using `local` everywhere.
- Stable ids: `page_id`/`workflow_id`/`pitfall_id` unique per site; `action:<id>` unique within its page.
- File size: the spec says 800 tokens, the on-disk skill allows up to ~1500 naturally and requires splitting above 3000. Following the skill.
- Language: English for repository content. See `CLAUDE.md`.

## Open questions
0. **`eur-lex search` requires a visible browser today.** The Browser Bridge was running under X410 (`DISPLAY=127.0.0.1:0.0`), so a Chrome window appears. Restarting it under Xvfb (`opencli-bridge-stop` then `opencli-bridge`) should make it invisible and change nothing else, but this was never actually run and verified. Until it is, do not claim in the docs that search is invisible. Worth reconsidering more broadly whether a command that needs a browser at all belongs in this repo.
1. `opencli browser verify` and plugin-installed adapters: eject, or drop the fixtures?
2. Which site next?
   - `verify/<cmd>.json` for eur-lex too: same plugin-vs-`clis/` limitation.
3. Does the repo stay local or go to GitHub? Only the README changes, not the layout.
4. Sitemaps only for sites with an adapter, or for sites without one too? In the second case the folder name is the SLD label and collisions are possible — accept it, or handle it with an alias.
