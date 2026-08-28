# LOG

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
