# LOG

## 2026-09-12

- **Third site: `istatdata`** (`plugins/istatdata/`, commands `ask` and `dataset`). `ask` is the AI search form of the ISTAT Data Browser on the command line: a question in plain Italian, out come the datasets that answer it. Strategy PUBLIC, `browser: false` - the form's own XHR is a public endpoint of the Data Browser hub, so nothing here needs Chrome or the Browser Bridge. A port of `andy-tools/tools/istatdata-ai` (Python), not a new discovery: the reverse engineering was already written up there.
- **The repo is no longer EU-law only.** Root `opencli-plugin.json` description widened to "for public data sources"; README, AGENTS.md and the site table updated. The two EU sources still cross-reference each other, istatdata references nothing and stays here only for the shared `docs/`, `bin/` and `AGENTS.md`.
- **No sitemap for this site, deliberately.** The API covers exactly what the web form does, so an agent holding the adapter has no reason to open the Data Browser and the navigation graph would describe a path nobody walks. Reasoning written into the README so the absence reads as a decision rather than an omission. Open question 4 of `tasks/todo.md`, answered in one concrete case.
- **The defect worth naming: this hub reports failures in the body.** `{"errorCode": "INTERNAL_ERROR_SERVER", "message": ""}` - and, as documented on 2026-08-24, with HTTP 200. A conventional `if (!res.ok) throw` sails past that, `chatContext` is then absent, and the command prints an empty table for a search that never ran: a silent wrong answer that `validate` and any smoke test would pass. The guard reads the body first. Tested against three synthetic 200 responses plus a 429 and a catalog missing its `datasetMap`: five throws, no empty tables. Today that same case answers HTTP 500 with the same body, so the status is no longer a reliable signal in either direction - which is the argument for the body-first guard, not against it.
- **`aiRateLimiting` is mandatory and is only a copy of the node's own setting**, so it is read live from `GET nodes/{node}` (13 kB) rather than hardcoded. It is the single field most likely to drift, and a drift would be invisible.
- **`sessionId` had to be a column, not `footerExtra`.** The tidy place for an answer-level value is the footer - that is where `eur-lex search` puts its result total. But the runtime renders the footer only in `table` format, and `table` auto-downgrades to yaml whenever stdout is not a TTY, so in every pipe and every machine-readable format a footer value is simply gone. For a total that is a cosmetic loss; for a session id it is fatal, because `--session-id` is fed by it and an option whose input you cannot read back out is a broken option. It repeats identically down the column and that is the price paid. Worth remembering for any adapter whose output feeds its own next invocation.
- Other traps met: `UserLang: en` empties both `title` and `ai_title`, which is what makes the 1.5 MB catalog join load-bearing rather than decorative; the Data Browser deep link needs the whole category path, group id first, or the app answers "page not available"; kebab arg names stay kebab in `args`, so it is `args['session-id']`.
- **A declared example that did not run**, caught by the repo's own habit of executing them all: `duckdb read_csv` straight off the SDMX-CSV URL answers `HTTP 416`, because that service does not serve byte ranges. Replaced with curl to a file and then `read_csv` on the file.
- **`opensdmx` is the right downstream tool and it works**, with the dataflow id exactly as this adapter returns it minus agency and version: `opensdmx -o csv get 24_84_DF_DCIS_MATRIND_4 --provider istat --start-period 2020 --labels -y` gives 231 rows in 22 s with a `<DIM>_label` beside every code. Getting there took three false failures, all of them mine, and they are worth writing down because each one nearly became a bug report: `-o csv` placed after `get` instead of before it (it is a global option, and the CLI said so); an `info` call declared broken when it had only exceeded my own 110 s limit inside a legitimate retry-wait loop; and a `get` "exiting 0 with no output" that had in fact been backgrounded at a 120 s timeout by the harness running it. Re-run cleanly, the same command produces 293 kB. The rule held: when the tool and my measurement disagree, the measurement is the suspect.
- The `EmptyResultError` path was met for real rather than simulated: asking "e per le donne?" with no `--session-id` matches nothing out of context and the command exits 66 saying so, instead of printing an empty table. Which is also the clearest demonstration of what the session is for - the same question inside the previous context returns the datasets disaggregated by sex.
- Verified live, including from a clean `env -i` shell outside the repo. The first result for "qual è il reddito medio del comune di Bagheria" matches the Python tool's README byte for byte, table URL included. Session continuation checked end to end: `sessionId` out of `-f json`, back in through `--session-id`, different result set. Site memory written to `~/.opencli/sites/istatdata/`.
- **Both commands default to `-f plain`.** The default table was the first thing that made the tool unpleasant to use: nine columns, one of them a 400-character multi-line description, another a session id repeated down every row, rendered as a screen-wide wall of box-drawing characters. `defaultFormat: 'plain'` is one line, loses no data and yields to any explicit `-f`. Found by capturing the real terminal output for the README instead of describing it.
- **The repository README was rewritten at the top.** It opened with the title "notes and site sitemaps" - the names of two folders - then listed directories and went straight into `## Install`, so a visitor never learned what the thing does; the table of sites, the only section that answers that, sat below four others. Now: one line on what this is, a real captured `ask` run, a three-command "Try it", then the sites. The title leads with the adapters because they are the product - istatdata has no sitemap at all - and the illustrative output that was in the first draft of the intro was replaced with verbatim output, since an invented example is exactly the kind of unverified claim that turns into a correction later.
- Not tested on purpose: what the node does past its declared 10 searches per minute. Finding out means deliberately tripping a public service. HTTP 429 and an `errorCode` matching /rate|limit/ are handled, and that mapping is recorded as an assumption rather than an observation.

## 2026-08-28 (evening 7)

- **`opencli eur-lex search` added** (`browser:true`, the only such command in the repo). The earlier decision to leave search out was right about the risk but wrong about the remedy: the objection was that a WAF challenge would make it degrade silently, and that is fixable — the command checks it actually landed on the results page and raises COMMAND_EXECUTION otherwise, so a challenge fails loudly instead of looking like zero results. What it replaced was a line of hand-written JavaScript that no user should have to invent.
- Usability pass on the new command, driven by what the first run exposed:
  - `--exact` wraps the query in quotes. Without it the site ORs the words: `facial recognition` → 904 results, `"facial recognition"` → 356. Nested shell quoting to get a phrase was a trap.
  - The `Date of document` field carries `"14/05/2024; Date of signature"` — cut at the semicolon.
  - `total` was a row column repeated on every row; moved to `footerExtra` where it belongs (`10 items · eur-lex/search · 356 results in total`).
  - Added a derived `act` column (`Regulation (EU) 2024/1358`) so there is something scannable next to the 400-character official titles, and put `title` last so a wide table degrades from the right.
  - Dropped `author`: almost always "European Parliament, Council of the European Union".
- All nine declared examples run; `validate` and `convention-audit` pass on both sites. Sitemap, both READMEs, `AGENTS.md` and the plugin description updated: EUR-Lex's rule of engagement is now "one command needs the browser, three do not".

## 2026-08-28 (evening 6)

- **Corrected a wrong pitfall.** `pitfall:no_reliable_result_total` claimed the EUR-Lex results page has no usable total. It does: the page text reads `Results 1 - 10 of 356`. The earlier probe looked for an element with a class of its own and found none, and I turned "my selector missed it" into "the source does not provide it". Replaced with `pitfall:result_total_is_in_the_page_text` plus an `action:read_result_total`, both carrying the regex and two measurements (`"facial recognition"` → 356, `biometr*` → 3246).

## 2026-08-28 (evening 5)

- **Decision: one repository, not one per sitemap.** Checked against the requirement first: single-site install works (`plugin install github:aborruso/opencli/<site>` registers only that adapter), `plugin update` iterates the lock and touches only installed sub-plugins, and `plugin list` shows a per-site version read from each sub-plugin's own manifest. Splitting would buy separate issue trackers and landing pages, nothing operational, and would cost the cross-links between the two sitemaps plus a duplicated `docs/` mirror, `bin/` and `AGENTS.md`. Rationale recorded in the README so a visitor does not have to ask.

## 2026-08-28 (evening 4)

- **Two shipped `example` strings did not run.** Found by executing every declared example: `law-tracker search "artificial intelligence" --status ong --stage FR` was exactly the combination the guard refuses (the example predated the guard), and `timeline 2021/0106(COD)` fails in a shell because the parentheses are unquoted. Fixed to `search --status ong --stage FR --size 20` and `timeline 2021_106`; all eight examples now run. The constraint also moved into the `search` description and into the `--status`/`--stage` help, so it travels with the CLI rather than living only in the sitemap.
- **Single-site install verified**: `opencli plugin install github:aborruso/opencli/eur-lex` registers only that adapter. But the clone carries *every* sitemap, so a bare sync would link law-tracker's too and send an agent after commands that are not installed. `bin/sync-sitemaps.sh` now takes site names (`sync-sitemaps.sh eur-lex`) and fails loudly on an unknown one. Documented in the main README, `AGENTS.md`, and both per-site READMEs.

## 2026-08-28 (evening 3)

- Repository published: <https://github.com/aborruso/opencli>, public, MIT. Upstream OpenCLI skill copies (`.agents/`, `.claude/`) excluded from git — they are jackwener's files and are reproducible with `npx skills add jackwener/opencli`; `skills-lock.json` records the versions this repo was written against.
- Added a root `opencli-plugin.json` declaring the two sub-plugins, which makes the repo an OpenCLI plugin monorepo, and `AGENTS.md` as the agent-facing entry point.
- **Install path verified end to end after publishing**: `opencli plugin install github:aborruso/opencli` → "Installed 2 plugin(s) from monorepo: eur-lex, law-tracker", clone under `~/.opencli/monorepos/opencli/`, then `bash ~/.opencli/monorepos/opencli/bin/sync-sitemaps.sh` links both sitemaps and `opencli browser open` reports `sitemap.available: true`. Commands answered live from that install.
- Then restored the development setup: plugins reinstalled from `~/git/idee/opencli/plugins/*` so edits in the working copy are live rather than shadowed by the clone. Both routes documented in the README.

## 2026-08-28 (evening 2)

- Second site covered: **eur-lex.europa.eu**. Sitemap in `sitemaps/eur-lex/` (SITE + 3 pages + 2 workflows + 7 pitfalls) and plugin in `plugins/eur-lex/` with 3 PUBLIC commands (`get`, `meta`, `sparql`). `opencli validate eur-lex` → PASS; `opencli browser ex open` resolves `sitemap.site: "eur-lex"`, so the adapter-`domain` pattern generalises — that was Phase 4's open question.
- The finding that shapes the whole sitemap: **`eur-lex.europa.eu` is behind an AWS WAF**. Any non-browser client gets `HTTP 202` with a JS challenge and an empty body — not a 403, so careless code reads it as success. No bypass attempted, per the adapter-author red line.
- Hence the split, which is exactly what a sitemap is for: **full-text search is browser-only** (deep-linkable `search.html?scope=EURLEX&text=…&lang=en&type=quick`, ten results per page, `page=N`), while **retrieving acts is adapter-only**, against `publications.europa.eu` — Cellar REST plus the SPARQL endpoint, neither of which is challenged. First workflow in this repo whose best path is the browser rather than an adapter.
- Cellar contracts verified one by one: `Accept-Language` in ISO 639-3 is mandatory (400 without it), and the accept types are narrow — `application/xhtml+xml`, `application/pdf`, `application/xml;notice=object|branch` work; bare `application/xml`, `text/html`, `text/plain` are 404; `application/zip` is 400.
- Dropped a `browser:true` `search` command that was on the table: its success would depend on a WAF challenge being passed, and `opencli validate` only checks shape, so it would degrade silently to "no results". Search belongs in `workflows/`, not in a command.
- No predicate in Cellar links a work to its Law Tracker procedure reference (probed with `FILTER CONTAINS(?o, "2021/0106")` → empty). The two sitemaps cross-reference each other in prose instead, and say the bridge is inferred.
- Motivating case, end to end: the Law Tracker returns nothing for "facial recognition" (it matches titles only); EUR-Lex full text finds Eurodac and ECRIS-TCN, and `opencli eur-lex get 32024R1689` pulls the 588 099 characters of the AI Act, where `biometric identification` appears 57 times.
- `--format` is reserved by the CLI's own output flag: the fetch-representation argument had to be renamed `--as`.

## 2026-08-28 (evening)

- First site covered: **law-tracker.europa.eu** (EU Law Tracker). Sitemap in `sitemaps/law-tracker/` (SITE + 3 pages + 3 workflows + pitfalls) and plugin in `plugins/law-tracker/` with 5 PUBLIC commands (`proposals`, `events`, `search`, `timeline`, `topics`). `opencli validate law-tracker` → PASS, all five exercised live.
- API contracts taken from the `eutrack` project (printing-press) and **re-verified one by one** with curl. Page recon with agent-browser.
- The finding that justifies the session on its own: **with free text (`quickSearch`/`title`) the backend ignores the `status` and `stage` filters** and returns rows that violate them, with no error. Two independent probes (stage FR + "artificial intelligence" → EOP rows; title + status ong → a WIT procedure). On their own the filters work; `topics` and `procedure` do stay in AND. The adapter refuses the combination with ARGUMENT rather than hand over wrong data.
- Other traps verified and documented: `totalResults` = 0 while results are populated; titles carrying `<em>` markup; compound EuroVoc code (`52,DOM` must be split into code+type); two reference spellings (`2021/0106(COD)` ⇄ `2021_106`); timeline answers **400**, not 404, on an unknown reference; a non-existent procedure returns HTTP 200 with an empty page; the cookie banner intercepts clicks; the `<title>` is identical on every page except the results one. Also `sort:{order:"DATE"}` → 400: in the body the date ordering is `DOCD`, even though the results URL spells it `sort=DATE`.
- Result pages are deep-linkable (`/results?quickSearch=…`, `?searchType=topics&eurovoc=…`, `?searchType=advanced&statusType=…&stage=…`): the sitemap makes direct navigation the main path and the forms the fallback.
- Added `sitemaps/aliases.txt` plus alias handling in the sync script. The `europa` alias (SLD fallback) was **tried and then rejected**: with it, `eur-lex.europa.eu` and `commission.europa.eu` were served law-tracker's sitemap. Better none than the wrong one. **Verified with the Browser Bridge connected**: `opencli browser lt open .../homepage` → `sitemap.site: "law-tracker"`, `available: true`, `source: local`. The adapter's `domain` beats the SLD fallback. Anchors re-verified with `opencli browser`: `/results` has `title: Search results`, and a find on the reference tells an existing procedure (1 match) from a missing one (`semantic_not_found`).
- Repo language switched to English (READMEs, sitemap, adapter code and messages, LOG, tasks). `docs/notes.md` and `CLAUDE.md` stay in Italian.
- Removed an empty `~/.opencli/sites/asl-taranto/sitemap` stub left over from a test.

## 2026-08-28

- The repo becomes a **collection of OpenCLI sitemaps** as well (one repo, not one repo per sitemap). `git init` done, added `sitemaps/`, `bin/sync-sitemaps.sh`, `tasks/todo.md`; `CLAUDE.md` extended (these folders are hand-written, not mirrored).
- Verified in the CLI source (`dist/src/cli.js`, v1.8.6): sitemaps are looked up **only** in `~/.opencli/sites/<site>/sitemap` and `<packageRoot>/sitemaps/<site>`. No env var, and plugins do not carry them → an external repo can only be hooked up by symlinking the `sitemap` subfolder.
- The folder name is not the hostname: `siteNameCandidatesFromUrl` first tries the `site` of adapters whose `domain` matches, then falls back to the **SLD label alone**. Probed with an empty registry: `servizionline.asl.taranto.it` → `taranto`, `opendata.comune.palermo.it` → `palermo`. For a site with no adapter the name is therefore coarse and can collide.

## 2026-07-05 (evening 2)

- `openalex trends`: fixed duplicate titles. Cause: OpenAlex indexes repository versions as distinct works (different ids) — Zenodo/figshare `.v1/.v2`, consecutive DOIs — plus arXiv↔DOI mirrors (`arxiv.org/abs/X` vs `10.48550/arxiv.X`) and osf/github+DOI. Deduping by `w.id` could not see them. Added `dedupByTitle()` (lower-cased title, whitespace collapsed), applied to **every** profile, keeping the first by date. Lists arrive sorted by date desc → the most recent one wins. Over-fetch raised to 200 for single profiles too (dedup can drop rows), then `slice(limit)`.
- Known trade-off: two genuinely different works with identical titles (e.g. "Comment on egusphere-…" rc1/rc2) collapse into one. Acceptable for a novelty feed.
- Check: `all --days 30 --limit 200` → 0 duplicate-title groups (dozens before), rows 200→163.

## 2026-07-05 (evening)

- `openalex trends`: added `--year YYYY` (exact calendar year via `publication_year`), **an alternative to** and taking precedence over `--days` (rolling window via `from_publication_date`). `buildFilter` now receives a ready-made `windowFilter` (`from_publication_date:...` or `publication_year:...`). Validated PASS; tested `--year 2026/2024`, `--days 10`, and the default.
- Verified OpenAlex's default sort: with a search → `relevance_score:desc`; without one → `cited_by_count:desc`. Both useless for a novelty feed (old, heavily cited work floats to the top) → the adapter forces `publication_date:desc`.

## 2026-07-05

- Added the `openalex trends` adapter (PUBLIC) at `~/.opencli/clis/openalex/trends.js`: a feed of recent work on "open data" by theme, with a **rolling window** (`from_publication_date` = today − N days) plus `sort=publication_date:desc`. Complements the built-in `openalex search` (inside `node_modules`, not editable, with no topic/date filters and no sort). Includes retry+backoff on 5xx/429, which the built-in lacks.
- **Fixed topics** (queried the `/topics` endpoint and picked the closest ones, not all): `T10953` E-Government, `T11937` Research Data Management, `T11719` Data Quality, `T10799` Data Visualization, `T11675` Open Source Software. AI has **no** clean topic in OpenAlex (it is classified by domain: health/law/business) → the `ai` channel goes through keyword text search.
- Profiles: `topics` (default, 4 themes + gov), `tools`, `quality`, `sharing`, `viz`, `ai`, `all` (topics ∪ ai, deduped by id). Options: `--days` (default 30), `--limit` (max 200), `--oa` (Open Access only).
- API key read from `process.env.OPENALEX_API_KEY` (premium pool), falling back to `mailto` (polite pool) when absent. Safety rule: the key never appears in error messages (only the HTTP status is logged, as in `sec`).
- `opencli validate openalex/trends` → PASS. Exercised end to end: every profile, `--oa`, `-f json/table`, and the error path (ARGUMENT on an unknown profile).
- Rationale: OpenAlex's custom search with a fixed `publication_year:2024` and `sort=relevance_score` is useless for staying current (static window). A rolling window with a date sort is not.
- Output columns: `date, title, oa, venue, doi, pdf, url`. `pdf` = direct OA full text (empty when not OA); `url` = the page to open to read it (publisher landing → DOI resolver → OpenAlex record as fallback), always populated. Added `best_oa_location` to the `select` fields alongside `primary_location`/`open_access`.

## 2026-07-04 (evening 2)

- Added the `sec proxy` adapter (PUBLIC): fetch a document (by URL, or the latest DEF 14A for a ticker) → HTML to clean text. `--section` is best-effort (works for PLTR/AAPL, misses MSFT: regex slicers are brittle because every DEF 14A has different HTML → extraction is the AI's job).
- Retry+backoff on 5xx/429 added to `search`/`company`/`proxy` (efts.sec.gov returns transient 500s).
- **End-to-end PRD run** (Palantir DEF 14A 2026): opencli supplies clean text (257k chars) → AI extraction → structured JSON for the three sections (7 board, 5 exec, 10 owners + BlackRock). Self-check: committee members ⊆ independent directors ✓, group = 10 people ✓. Confirms the architecture: opencli for deterministic data, the AI agent for extraction and sanity checks.

## 2026-07-04 (evening)

- `sec` adapter (PUBLIC, browser:false) at `~/.opencli/clis/sec/`:
  - `search` — EDGAR full text (`efts.sec.gov`), ordered by **relevance**.
  - `company <ticker|CIK|name>` — filings via the **submissions API** (`data.sec.gov`), ordered by **date** (newest first), filterable with `--forms`. Deterministic for "latest DEF 14A for a company". Resolves ticker→CIK via `company_tickers.json`.
- Applied the `opencli-usage` skill: `opencli validate sec/company` + `sec/search` → PASS; checked `-f json` and presence in `opencli list`.
- Use case: the PRD at `~/git/idee/re_documenti_sec` (DEF 14A proxies). `sec company` covers the deterministic *discovery* step; extracting the three sections stays downstream and tool-agnostic.

## 2026-07-04

- Created the personal notes folder `~/git/idee/opencli`.
- Created the `docs/` bundle in the style of `ai-specs/specs/okf`: verbatim upstream mirror + `meta.yml` (provenance + sha256) + `notes.md` (hand-written notes).
- Mirror scope "complete": README + SKILLs (browser, usage, adapter-author) + guides (extending, exit-codes, plugins). Upstream CLI v1.8.6, extension v1.0.22.
- `notes.md` captures the non-obvious setup: the Browser Bridge on WSL2 needs the extension loaded into WSL's own Chrome via X410 (CDP is not enough); Chrome must be launched from a persistent user shell (sandbox → exit 144).
- Found that `--headless` cannot drive tabs (chrome.debugger attach_failed); the fix is Xvfb (a virtual display) → invisible Chrome. Confirmed by direct test, the repo's CI, and DeepWiki. `notes.md` rewritten around the three-case model (A = no browser, B = Xvfb invisible, C = X410 for login). Added `opencli-bridge` / `opencli-bridge-login` / `opencli-bridge-stop` functions to `~/.zshrc` (backup `~/.zshrc.bak-2026-07-04`).
- Added 20 ready-to-run examples to the README (all `browser:false`, all exercised) and `list.txt` with the full inventory (1275 commands, 173 sites).
