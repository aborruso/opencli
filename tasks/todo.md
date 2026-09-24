# Plan — a collection of OpenCLI sitemaps in one repository

Status: in progress. Updated 2026-09-20.

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
### Phase 7 — fourth site: Koboyo Icons search — DONE

Goal: bring the icon search of `koboyo.com/icons` to the command line. 261,740 hand-drawn SVG icons; the search box needs JavaScript, so there is no URL that returns results and no documented API.

#### Strategy note (skill Step 6 — mandatory before any code)

Reverse-engineered from `/icons/_astro/IconBrowser.C_JvFU5V.js` on 2026-09-20. The search is **not** a server endpoint: it is a static, prefix-sharded JSON index served off the same origin, and all ranking happens in the browser. Verified live:

- `GET /icons/data/search/v1/<prefix>.json` — `{split: [...], truncated: bool, entries: [...]}`. `ca.json` = 146 kB, 800 entries, `truncated: true`, `split` listing 18 three-letter shards.
- `GET /icons/data/search/v1/_common.json` — the stop-word list (`action`, `hand`, `person`, `cartoon`, …).
- `GET /icons/svg/<slug>.svg` — the icon itself.
- `GET /icons/<slug>` — the icon page. `GET /icons/data/groups/v1/<group>--<subgroup>.json` and `/icons/data/style/v1/<style>.json` — the browse listings.

Ranking, to be ported verbatim from `he()`: exact slug 1000, name-token 120, name-token prefix 60, keyword 40, keyword prefix 20, substring 4; **any token scoring 0 kills the row** (semantics are AND); bonuses (+200 phrase, +80 same token count, +max(0, 40-8*extra)) only when every token matched through the slug/name path; `+entry[4]` base weight last. Entry = `[slug, name, keywords, nameTokens, weight, group, subgroup, style]`, empty style meaning `original`.

Shard selection: the **longest** token of length ≥ 2 that is not in `_common.json`; then walk `split` from the 2-char shard down. The site fetches prefixes 2..len in parallel and then walks; walking sequentially gives the same shard for about half the requests.

Strategy PUBLIC, `browser: false`, `access: read`. No key, no cookie, no Chrome: the index is public static JSON on the CDN.

**Koboyo already ships an MCP server**, key-gated and account-bound. This adapter exists alongside it for the same reason the rest of the repo exists: keyless, browserless, pipeable. To be written into the plugin README so it reads as a decision.

**License boundary** (`koboyo.com/icons/license`): the icons are free for personal and commercial use, no attribution, but one cannot "bundle the icons into any app where they are the feature, or where users can pick, extract, download or re-share them". The repo's own rule settles it: every command here is `access: read` and nothing writes anything anywhere. So the adapter returns the `/icons/svg/<slug>.svg` URL and, on request, prints the markup to stdout; it never writes a file and never caches the library.

#### Commands (three: two planned, one added while building)

- `opencli koboyo search "<query>"` → `slug`, `name`, `group`, `style`, `relevance`, `url`, `svg`, `page`. `--style`, `--group`, `--limit`.
- `opencli koboyo get <slug>` → the same icon with keywords and description; `--svg` adds the markup.
- `opencli koboyo groups` → the 111 `group/subgroup` pairs `--group` accepts, with counts. Not in the plan: `--group` draws on a controlled vocabulary that nothing publishes as data, and an option whose values cannot be discovered is close to an option that does not exist.

#### Steps

- [x] `plugins/koboyo/` with `opencli-plugin.json`, `package.json`, `shared.js`, `search.js`, `get.js`, `groups.js`, `README.md`; `node_modules/@jackwener/opencli` symlinked as in the other three. `opencli validate koboyo` → PASS, 3 commands, 0 warnings.
- [x] `shared.js`: `_common.json`, the sequential shard walk, `he()` verbatim, the style and group filters, the four URL shapes, the sidebar taxonomy parser.
- [x] **No featured fallback.** `search "hand person"` → ARGUMENT naming the common words; `search "a b"` → ARGUMENT naming the length rule. Neither prints a row.
- [x] `truncated` surfaced in the footer with the match count and the shard that answered (`7 matches in the "dog" index shard, which is capped`).
- [x] Error handling exercised: unknown slug → EMPTY_RESULT (66); bad `--style`, bad `--group`, empty query → ARGUMENT (2). Zero results carries the two invisible causes — English-only index, ANDed words — plus the active filters.
- [x] Registered in the root `opencli-plugin.json` and installed locally.
- [x] **Ranking parity against the site's own code**: the minified `he`/`W`/`Se`/`$e` extracted into a scratch module and run against the same shards. `acoustic guitar`, `coffee mug`, `warehouse shelf`, `dog run`, `birthday cake candle`, `abacus`, `rocket launch`, plus `--style cartoon` and `--group object/entertainment` — identical ordered slug lists every time, and the one empty case empty on both sides.
- [x] The four page URL shapes verified in a real browser (`agent-browser`, X410 display), `?q=` honoured on each: `/icons`, `/icons/<style>`, `/icons/set/<g>/<s>`, `/icons/set/<g>/<s>/<style>`.
- [x] `search` defaults to `-f plain`: eight columns, three of them URLs, make the default table unreadable.
- [x] Parity harness kept, not left in a scratch directory: `~/.opencli/sites/koboyo/{site.mjs,parity.mjs}` plus how to re-run it in the site notes.
- [x] Site memory `~/.opencli/sites/koboyo/{endpoints.json,notes.md}`; root `README.md` table, `AGENTS.md`, plugin `README.md`, `LOG.md`.

#### Decisions and corrections while building

- **`page` is a column, not the footer.** An agent has to be able to hand a person a link — a slug cannot show what an icon looks like — and the footer renders in `table` format only. Same tradeoff as istatdata's `sessionId`, knowingly repeated.
- **`footerExtra` is an option of `cli()`, not a key of the returned value.** Returning `{data, footerExtra}` made the runtime read the object as a single row and print an empty table, while `-f json` looked right. Caught by looking at `-f table`.
- **Two wrong claims, both corrected by a screenshot of the actual page**: a drawing style does have a URL (`/icons/inkbrush`), and style and group do combine (`/icons/set/object/animal/inkbrush`). Both came from reading the code and stopping at the first explanation that fit.
- **Zero results explains itself**: English-only index and ANDed words are invisible from the query.
- **No sitemap**, third time. The search page is the only page worth driving and the adapter reproduces it.

#### Still open

- Does `truncated` mean every popular prefix is capped by construction, or that this shard overflowed? Unmeasured across shards.
- The index is versioned `v1` and static. Nothing signals a rebuild; a drift would show up as a parity failure and nothing else.
- `opencli browser verify` still does not see plugin-installed adapters, so koboyo has no `verify/<cmd>.json` either. Same limitation, now on four sites - and **`convention-audit` is blind in the same way**: it scans the `clis/` inside the npm package and reports `OK` on zero files for `--site koboyo`. Which puts the 2026-08-28 claim that the audit passes on eur-lex and law-tracker in doubt: it was probably an empty scan too. The seven rules were checked by hand here. Open question 1 is about two tools, not one.

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

---

# Plan — fifth site: `eu-funding` (EU Funding & Tenders Portal APIs)

Status: done, 2026-09-21. Source: https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis (Angular SPA, text read with agent-browser; saved in `tmp/sedia-apis-page.txt`).

## What was verified (curl, 2026-09-21)

- Two endpoints, both public, no login, no browser: `POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=<KEY>&text=<TEXT>&pageSize=&pageNumber=` and `.../facet?apiKey=<KEY>&text=***` (decodes reference codes). Plus `GET .../document/<PIC>?apiKey=SEDIA_PERSON`.
- Body is multipart: parts `query` (Elasticsearch-style bool JSON), `languages` (`["en"]`), `sort` (`{"field":..,"order":..}`), each `type=application/json`.
- Keys: `SEDIA` (grants, tenders, topics, grant updates), `SEDIA_FAQ` (FAQs), `SEDIA_PERSON` (organisations, partner searches), `SEDIA_NONH2020_PROD` (projects & results — not written on the doc page, captured from the portal's own XHR).
- All 8 documented services answer: grants & tenders (622 forthcoming grants), topic details (`text="HORIZON-CL3-2022-BM-01-01"`), grant updates (`type 6`, 45,687), FAQ index (1,689), FAQ detail (`nid` — the doc's own example `755` returns 0, `55257` returns 1), organisation (`PIC 999991722`), partner searches by topic (40), projects (Horizon: 23,759).
- **Trap 1: the status codes.** Facet says `31094501` = Forthcoming, `31094502` = Open for submission, `31094503` = Closed. The doc's "only open tenders" sample uses 501+502, i.e. forthcoming+open. The adapter exposes names, never raw codes.
- **Trap 2: languages.** Without `languages` the same record appears once per translation (topic `HORIZON-CL3-2022-BM-01-01`: 10+ rows, `language` es/fr/hr/…). Always send `languages`.
- **Trap 2b: an identifier is not one record.** With `["en"]` the same topic id still returns 4 records: 2 grant updates (`type 6`, 21 keys), the topic itself (`DATASOURCE SEDIA`, `type 1`, 56 keys) and a `SEDIA_PRD_CENTRICITY` copy (38 keys). `topic` must filter on `type` 1/2/8 and `DATASOURCE SEDIA`, and fail loudly if that still is not exactly one.
- **Trap 4: `pageSize` is capped at 100** (asked 500 and 1000, got 100, response echoes `pageSize: 100`). `--limit` pages through `pageNumber`; no `--limit 0 = all` (projects alone: 88,322).
- **Trap 5: `type` is scoped to the key.** SEDIA: 0 Tender, 1 Grant, 2 Calls for proposals, 8 Cascade funding, 6 grant update. SEDIA_FAQ: its own 4 values. SEDIA_PERSON: `ORGANISATION`/`PERSON`. Projects: no `type`. Name maps are per key, never shared.
- The facet endpoint answers on all four keys (FAQ 7 facets, PERSON 16, projects 19+).
- Out of scope: the "previous version APIs" linked from the page. Only the eight current services.
- **Trap 3: every metadata value is an array** (`identifier: ["..."]`), dates as `2027-04-06T00:00:00.000+0000`.

## Commands (all PUBLIC, `browser: false`, `access: read`)

| command | service | key |
|---|---|---|
| `calls [text]` `--type grant,tender,cascade --status open,forthcoming,closed --programme --call --limit` | Grants & Tenders | SEDIA |
| `topic <identifier>` | Topic details | SEDIA |
| `updates [text]` `--programme` | Grant updates (type 6) | SEDIA |
| `faqs [text]` `--programme` | FAQ index | SEDIA_FAQ |
| `faq <nid>` | FAQ detail (full answer) | SEDIA_FAQ |
| `org <PIC>` | Organisation public data | SEDIA_PERSON (GET document) |
| `partners <topic>` | Published partner searches for a topic | SEDIA_PERSON |
| `projects [text]` `--programme --topic --limit` | Projects & results | SEDIA_NONH2020_PROD |
| `codes <field>` `--index calls|faqs|partners|projects` | Facet API: code → label | any |

Plus on every search command `--query <json>`: raw bool query passthrough, so anything the API allows but the flags do not cover stays reachable ("copy the query from the portal", as the doc itself recommends).

## Phases

- [x] 1. `shared.js`: `search(key, text, query, opts)` with paging over the 100 cap, `facet(...)`, array flattening, per-key type maps, status map, body-first error guard → verify: probe script returns the counts above.
- [x] 2. `calls` + `topic` + `codes` → verify: `calls --status forthcoming --type grant` total = facet count; `topic HORIZON-CL3-2022-BM-01-01` one row.
- [x] 3. `updates`, `faqs`, `faq`, `org`, `partners`, `projects` → verify: each declared example runs, columns == emitted keys.
- [x] 4. Programme names: `--programme horizon` resolved through the facet (`frameworkProgramme` / `programId` codes) instead of raw ids → verify: `43108390` ↔ Horizon Europe.
- [x] 5. README (plugin + root table + `opencli-plugin.json`), LOG.md, `opencli validate`, install via `plugin install` from local path, clean `env -i` run.

## Unresolved questions

All four answered by Andrea on 2026-09-21: name `eu-funding`; expose individuals' names in `partners`; `codes` both as a command and for labelling output; default `-f json`.

## Review

- Built as planned, with three departures, all recorded in `LOG.md` and in the plugin README. `partners` defaults to `ANNOUNCEMENT` records rather than the doc's ORGANISATION/PERSON sample, which is heavy. `--deadline-after` was added because statuses can be stale. And range dates must be written in full timestamp form, because a bare date is silently ignored.
- Also a fourth: `faqs` covers all four FAQ types (the doc's sample covers 3% of the index).
- Not done: a `git commit`. Left for Andrea.

---

# Plan — sixth site: `albo-palermo` (Albo Pretorio of the Comune di Palermo)

Status: done, 2026-09-22. Source: https://albopretorio.comune.palermo.it/albopretorio/jsp/home.jsp?modo=info&info=servizi.jsp (server-rendered JSP by SISPI, readable with curl).

## What was verified (curl, 2026-09-22)

- **No browser needed.** Every page is server-rendered HTML; the "no JavaScript" banner is cosmetic. Strategy PUBLIC, `browser: false`.
- **Three levels.** 11 categories on `servizi.jsp`, each with an `onclick` to `scelta_tipo_documento.jsp&AP=AP&TD=<cat>&SERCOD=<n>`. Each category lists document types (112 in all; the page paginates them client side, all are in the HTML). Every type, in every category, opens the same endpoint: `pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&AP=AP&TD=<type>`.
- **The list is stateful.** 10 rows per page, columns: protocol number, protocol date, subject, publication start, publication end. Next page is `POST dbmanager/tabella-lista-piu.do`; the detail is `dbmanager/tabella-modifica.do?row=N`, where N is 0-9 *within the current page* (`row=10` on page 2 answers "Servizio temporaneamente non disponibile"). One cookie jar per run, requests strictly sequential.
- **The list has no permalink and no id.** Only `row=N`. The permalink is in the detail, inside `copiaCollegamento()`: `pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=<type>&ALBCOD=<hex>&sportello=albopretorio`. Opened from a fresh session it shows that single act ("record 1 di 1").
- **`ALBCOD` is the internal id `ALB_COD` (hidden field in the detail), XORed with the fixed key `SISPISICUL` and hex-encoded.** Checked on 4 acts. It does not save requests (the id is not in the list either), but lets `get` accept either form.
- **The detail adds** sector (`SET_COD_DECODIFICATO`) and attachments `viewDocument?col=ALLEGATI&idx=i` with size and signed/unsigned icon. Attachments are session-bound: no permanent link to the PDF. Download works in the same session (`content-disposition` carries the original filename).
- **Search** (`POST dbmanager/tabella-filtro.do` then `tabella-ricerca.do`, `siglaStato=R`): subject substring (`ALB_DESOGGETTO`), year (`ALB_DESANNOPROT`), protocol number (`ALB_NUMPROT`), sector (`SET_COD`). One document type at a time. Checked: `PEG` on Giunta → 2 rows; year+number `291` → the single record. A sector-only query returned "errori interni": to recheck.
- Only acts currently in publication: no archive.

## Commands (all PUBLIC, `browser: false`, `access: read`)

| command | what |
|---|---|
| `types [--category]` | categories and document types with their `TD` code, read from the two index pages |
| `list <TD>` `--pages 1\|2` | acts of one type; opens every detail, so each row carries `permalink`, `sector`, `attachments`. Hard cap: 2 pages (20 acts, 22 requests) |
| `dump [types]` | every type or a comma-separated list of TD codes and names, JSON Lines on stdout, same cap per type (added mid-build at Andrea's request) |
| `search <TD>` `--text --year --number` | the portal's filter; same row shape as `list`, same 2-page cap |
| `get <permalink\|ALBCOD\|ALB_COD --type TD>` | one act by its permanent link |

## Phases

- [x] 1. `shared.js`: session (cookie jar), fetch + ISO-8859/UTF-8 check, row parser, detail parser, `ALBCOD` encode/decode → verify: parser on saved pages returns 10 rows; encode(1800156607) = `6271636078667F75657B`.
- [x] 2. `types` → verify: 11 categories, 112 types, Giunta = `TD 2024`, "Avviso Pubblico" = `TD 1041037357` under "Avvisi ed atti diversi".
- [x] 3. `list` → verify: Giunta 2 pages = 20 rows, each permalink opens "record 1 di 1" with the same protocol number.
- [x] 4. `search` + `get` → verify: `search 2024 --text PEG` = 2 rows; `get` on a permalink from `list` returns the same row.
- [x] 5. README (plugin + root table + `opencli-plugin.json`), LOG.md, `opencli validate`, clean `env -i` run.

## Unresolved questions

All answered by Andrea on 2026-09-22: name `albo-palermo`; default 2 pages; attachments as sizes only, no download; default `-f json`; `dump` in JSON Lines. The sector filter needed no fix: the "errori interni" came from my own malformed request.

## Review

- Built as planned plus `dump`. The ids and permanent links went further than planned: `ALBCOD` decodes to the internal id, so `get` also accepts a bare `ALBCOD` with `--type`.
- Future: a full dump beyond 20 acts per type (TD 2010 has 855) would need several sessions striding the pages of one type in parallel. Not built: a daily follow-up needs only the newest acts.
- Not done: a `git commit`. Left for Andrea.

# Plan — nightly archive of the Albo Pretorio of Palermo

Status: done 2026-09-23. Runs 35872009064 (first, 229 acts, release created) and 35872558929 (previous 229, merged 229, 0 new) passed from a GitHub runner.

Goal: a GitHub Actions workflow that every night runs `opencli albo-palermo dump`, merges it into one JSON Lines archive (append, sort, dedupe) and publishes only the latest version, with no history. Any sign of a broken run stops everything and leaves the published archive untouched.

## Design

- **Where the archive lives: a GitHub Release asset**, tag `albo-palermo-data`, file `albo-palermo.jsonl`, replaced each night with `gh release upload --clobber`. No commits, so no history and no diffs in the repo. Stable download URL: `https://github.com/aborruso/opencli/releases/download/albo-palermo-data/albo-palermo.jsonl`.
- **Flow**: install opencli and the adapter from the checkout → download the current archive (first run: none) → `dump > today.jsonl` → `bin/albo-palermo-merge.sh` (`cat archive today | LC_ALL=C sort -u` plus the checks) → upload.
- **Checks, any failure = job fails, nothing uploaded**:
  1. `dump` exits 0 (it already fails on 429 after retries, and on an empty result).
  2. today's dump has more than 0 rows.
  3. merged archive rows >= previous archive rows (catches a lost or truncated previous archive).
  4. schema: every row of today's dump and of the merged archive has exactly the 11 keys `category, td, type, number, date, subject, sector, published_from, published_to, attachments, permalink`, all strings, same set as the previous archive.
- A failed run shows up as a failed workflow, and GitHub emails the repo owner.

## Phases

### Phase 1 — feasibility from a GitHub runner
- [x] Workflow with `workflow_dispatch` only, running `dump "Avviso Pubblico"` → verify: the portal answers from a GitHub (US, Azure) IP, no 429, no geo-block; the opencli daemon starts on the runner.

### Phase 2 — the workflow
- [x] `.github/workflows/albo-palermo-nightly.yml`: cron nightly + `workflow_dispatch`, `permissions: contents: write`, `concurrency` so two runs never overlap → verify: first manual run creates the release and the asset.
- [x] Checks as a small shell/jq script in the workflow → verify: second manual run keeps row count >= first; a local test with a truncated previous archive, an empty dump and a row with a renamed key each make the check fail.

### Phase 3 — docs
- [x] `plugins/albo-palermo/README.md`: the archive URL and what it is (and is not: at most 20 newest acts per type per night) → verify: link resolves.
- [x] `LOG.md` entry.

## Decisions (2026-09-23)

- Duplicates: exact line, `sort -u`. An act whose fields change stays twice, by choice.
- Storage: Release asset, tag `albo-palermo-data`.
- 20-acts cap per type: accepted.
- Cron: 03:17 UTC. Scheduled workflows are disabled after 60 days without repo activity: known.

# Plan — albo-palermo `attachments`: download the attachments of one act

Status: done 2026-09-24.

## What was verified

- The detail page links each attachment as `../viewDocument?col=ALLEGATI&idx=N`, i.e. `/albopretorio/viewDocument?...` (not under `/pu/`). The index points into the detail page last opened in the session: there is no permanent URL.
- Same cookie jar as the detail page → HTTP 200, `content-type: application/pdf`, `content-disposition: filename=<name>.pdf`. Tested on Delibera di Consiglio 548 (25 attachments): idx 0 = `Parere_Contabile_DC_PROP_614_2026_1800989618_20260917.pdf` (2 pages), idx 1 = `dlc_Delibera_18-09-2026_11-13-10_omissis_1800989618_20260917.pdf` (14 pages).
- Without that session → HTTP 200, `text/html`, "File non visualizzabile. Sessione scaduta". So a 200 is not enough: the command must check the content type.

## Design

- New command `opencli albo-palermo attachments <act> [--type] [--dir <path>]`. `<act>` as in `get`: permanent link, or bare `ALBCOD` plus `--type`.
- One session: open the detail, read the `idx` links (with size and signed flag, as `parseDetail` does), then download them sequentially, reusing the existing 429 retry and the two-requests cap.
- Filename from `content-disposition`, sanitised; fallback `attachment-<idx>.pdf`. An existing file is not overwritten (skip and say so).
- Output: one row per attachment, `idx`, `filename`, `bytes`, `signed`, `path`. `access: read`: it writes only local files.
- A response that is HTML instead of a document → clear error ("session expired").

## Phases

- [x] `shared.js`: a binary GET on the session (the current `get` returns text) → verify: the two PDFs above come out byte-identical to curl's.
- [x] `attachments.js` → verify: Delibera 548 gives 25 files whose sizes match the "Kb" shown on the page; an act with one attachment (Decreto Prefettizio 65781); a bare ALBCOD with `--type`; an act out of publication gives the empty-result error; a second run skips the existing files.
- [x] `opencli validate albo-palermo` → 6 commands, PASS.
- [x] README: command table, example, and the trap "Attachments have no permanent link" rewritten (no longer "There is no download command"). LOG entry.

## Decisions (2026-09-24)

- Default folder: one per act, `./albo-<TD>-<number>/`.
- Existing file: skipped, never overwritten.
- No `--list` flag: `get` already lists the attachments.

# Plan — new adapter for the deliberations and ordinances archive of the Comune di Palermo

Status: done 2026-09-24.

Source: https://servizionline.comune.palermo.it/portcitt/jsp/home.jsp?modo=info&info=servizi.jsp&SERCOD=60&SERCODROOT=60 ("Delibere e Ordinanze" of the online services portal). Decisions already taken: a new adapter in this repo; CLI plus a nightly archive; every archive row carries its permanent link.

## What was verified (2026-09-24)

- Same SISPI application as the Albo Pretorio: list → `dbmanager/tabella-modifica.do?row=N` → detail at `jsp/home.jsp?modo=tabella`, stateful session, `viewDocument?col=ALLEGATI&idx=N` attachments, HEAD gives the file name.
- Unlike the Albo it is an archive: acts stay after their publication period, from 2018 (DDI) or 2020 (ODT, DCCIR) onwards.
- Permanent link: `pu/push-tabella-delibere.do?nomeTabella=<table>&TD=<code>&ALBCOD=<hex>&sportello=portcitt`. `ALBCOD` uses the same XOR key: `627E6A627A607C716675` → `1792335239`, which is also the prefix of that act's attachment names.
- Eight sections, each its own table and code:

| Section | table | TD | SERCOD | Access | Acts |
|---|---|---|---|---|---|
| Delibere di Giunta Comunale | FO_SCEDELIBERE | DGC | 6000 | list | 2,349 |
| Delibere di Consiglio Comunale | FO_SCEDELIBERE | DCC | 6010 | list | 3,247 |
| Delibere di Consiglio di Circoscrizione | FO_SCEDELIBERE | DCCIR | 6015 | filter only (year, circoscrizione) | ? |
| Delibere del Comitato dei Sindaci | FO_SCEDELIBERE | DCS | 6017 | list | 73 |
| Determinazioni e Ordinanze Sindacali | FO_SCEALBOPRETORIO | OS | 6020 | list | 2,106 |
| Determinazioni e Ordinanze Commissariali | FO_SCEALBOPRETORIO | DCO | 6021 | list | 221 |
| Determinazioni e Ordinanze Dirigenziali | FO_SCEDETDIRIGENZIALI | DDI | 6030 | filter only | 12,493 in 2026 alone |
| Dirigenziali Ufficio Traffico | FO_SCEDETDIRIGENZIALIUT | ODT | 6040 | filter only | ? |

- The filter refuses broad queries: year 2026 alone on DDI answers "I criteri di filtro impostati corrispondono ad un numero eccessivo di elementi: 12.493". One protocol date passes: 22/09/2026 → 28 acts, 3 pages. Andrea confirmed the same with today's date in his browser.
- My curl replay of the filter POST came back to the form ("Filtro attivo") with no list; the same search clicked in a headless browser worked. The exact request sequence is still to be pinned down (Phase 0).

## Design

- `plugins/palermo-delibere/`, strategy PUBLIC, no browser, `access: read`, default `-f json`. Own copy of the session, ALBCOD and attachment code: a single-site install (`plugin install github:aborruso/opencli/palermo-delibere`) cannot import from `plugins/albo-palermo/`.
- Commands:
  - `sections`: the eight sections, codes, how each is reached.
  - `day <YYYY-MM-DD> [--section] [--pages 1|2]`: acts with that protocol date, all filter sections or some, at most 2 pages each. The core of the archive for DDI, ODT, DCCIR.
  - `search <section>`: the portal's filter (`--text`, `--year`, `--number`, `--date`, `--sector`), with the portal's "too many" refusal passed on as a clear error.
  - `list <section>`: newest acts, for the sections that have a list.
  - `get <permalink>` and `attachments <permalink>`: as in albo-palermo, `act.html` and `act.json` included.
- Row: `section`, `type`, `number`, `date`, `subject`, `sector`, extra fields per section if the detail has them, `attachments`, `permalink`.
- Daily workflow, same pattern as albo-palermo: release asset, append + `sort -u`, same stop conditions (empty or invalid dump, schema change, archive shrinking). Andrea's scope (2026-09-24): no history. Sections with a list: the first 2 pages (the 20 newest acts). Sections reached only through the filter: see "Daily run, per section" below. Like albo-palermo, a day with more than 20 acts in one section is cut, and the run says so on stderr.

## Phases

### Phase 0 — recon — DONE 2026-09-24
- [x] Filter sequence with curl: GET the section's list URL, then POST `dbmanager/tabella-ricerca.do` with every form field plus `ALB_COD=&siglaStato=F&row=0&chiave=&provieneDa=`; it answers 302 to `jsp/home.jsp?modo=tabella`, which holds the list. `ALB_DATPROT=22/09/2026` on DDI → 28 rows, as in the browser. My earlier "failure" was the year filter's legitimate refusal (too many), not a bad request. The extra hex cookie the browser holds is not needed.
- [x] Filter fields: DGC, DCC, DCS, DCCIR: year, number, subject, `ARECOD` (empty select). OS, DCO: year, subject, type. DDI: year, type, number, protocol date, sector, progressive number and date, subject. ODT: as DDI without sector. Only DDI and ODT have a date.
- [x] Volumes under the filter: DCCIR year 2026 → 1,248 acts, ODT 2026 → 1,902, ODT 2025 → 2,627: all accepted. DDI 2026 → 12,493: refused. DCCIR and ODT lists are newest first.
- [x] Detail fields: `ALB_NUMPROT`, `ALB_DATPROT`, `ALB_DATFINPUB`, `ALB_COD`, `TAT_COD` everywhere; `TAT_COD_DECODIFICATO` on OS, ODT, DDI; `SET_COD_DECODIFICATO` (sector) on DDI only; `ALB_NUMPROTESTERNO`/`ALB_DATPROTESTERNO` on ODT, DDI; subject in the `ALB_DESOGGETTO` textarea. No publication start date.
- [x] **Same records as the Albo Pretorio.** DGC 302 has `ALB_COD=1802029321` and `ALBCOD=6271636279617070677D` here and on the Albo; `TAT_COD` values are the Albo's TD codes (2024, 2022, 2010, 2012, 1037940907). This portal is the permanent archive of the Albo's acts.

### Daily run, per section (Andrea, 2026-09-24: 05:00 Rome, yesterday's date)
- DGC, DCC, DCS, OS, DCO: the list, first 2 pages.
- DCCIR, ODT: filter on the current year, first 2 pages (newest first).
- DDI: filter on yesterday's protocol date, at most 2 pages.

### Phase 1 — adapter — DONE 2026-09-24
- [x] `sections`, `list`, `search`, `get`, `attachments`, `dump --date` (the nightly entry point, per-section daily rule). `validate` PASS, 6 commands.
- [x] Verified live: `get` on Andrea's example (DGC 272, the PEBA adoption, 26 attachments) and on acts already off the Albo (DCS 9, DCO 2) in a clean session; `list DGC` 20 distinct acts over 2 pages, the permalink of row 20 opens act 283; `search DDI --date 2026-09-22` 20 of 28; a Sunday gives the empty result; a single match (DGC 302/2026) is read from the detail; DCCIR and ODT through the year filter; the "too many" refusal (DDI 2026: 12.493); a flag a section lacks is refused by name; `attachments` on DCS 9 (2 PDFs, act.html, act.json, rerun all `exists`).
- [x] `dump --date 2026-09-22`: 148 acts in 44 s, 9 string columns on every row.
- Fixes found by running it: the subject is a `<div>` here, a `<textarea>` on the Albo; six DCO acts of 2024-12-30 have a "Copia" link with no ALBCOD, so the link is built from `ALB_COD` when the page's own lacks it.
- Albo → portal: the same ALBCOD opens the act here, with the section's code and table. Checked one act per Albo type: 2024→DGC, 2022→DCC, 1037940907→DCCIR, 2010→DDI, 2001 and 2011→OS, 2012→ODT (an Ordinanza Dirigenziale of another office may be in DDI). The other 16 Albo types are not in the portal.
- Trap for the README: `search --text` matches the subject as written, and subjects break words with hyphens ("ARCHI-TETTONICHE" in DGC 272), so "barriere architettoniche" misses it.

### Phase 2 — nightly archive
- [x] `bin/jsonl-merge.sh` + wrappers; 10 local cases pass on both schemas.
- [x] Workflow → runs 36036129768 (2026-09-22, first run: 148 acts, release created) and 36036337210 (default date 2026-09-23: previous 148, dump 140, merged 168, 20 new = DDI of 23/09) passed on GitHub.

### Phase 3 — docs
- [x] Adapter README with traps, root README table and intro, AGENTS.md, userscript README, LOG.

## Decisions (2026-09-24)

- Name: `palermo-delibere`.
- Daily run at 05:00 Rome (cron `0 3 * * *` UTC: 05:00 in summer, 04:00 in winter), reading yesterday's protocol date for DDI (Andrea's second proposal, replacing 23:00 on today's date).
- No history, no look-back: 2 pages per section per run.
