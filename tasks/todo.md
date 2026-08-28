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

## Conventions
- `source:` in front matter: the content lives in the repo but is mounted at the local-overlay path → for the runtime it is `source: local`. Using `local` everywhere.
- Stable ids: `page_id`/`workflow_id`/`pitfall_id` unique per site; `action:<id>` unique within its page.
- File size: the spec says 800 tokens, the on-disk skill allows up to ~1500 naturally and requires splitting above 3000. Following the skill.
- Language: English for repository content. See `CLAUDE.md`.

## Open questions
1. `opencli browser verify` and plugin-installed adapters: eject, or drop the fixtures?
2. Which site next?
   - `verify/<cmd>.json` for eur-lex too: same plugin-vs-`clis/` limitation.
3. Does the repo stay local or go to GitHub? Only the README changes, not the layout.
4. Sitemaps only for sites with an adapter, or for sites without one too? In the second case the folder name is the SLD label and collisions are possible — accept it, or handle it with an alias.
