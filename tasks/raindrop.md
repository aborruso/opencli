# Raindrop adapter — design and implementation plan

## Goal

Search an authenticated user's Raindrop bookmarks through OpenCLI, without a browser, a local index, or writes to Raindrop. Use the existing `RAINDROP_TOKEN` environment variable; dotenvx supplies it to the individual invocation. Never read `.env.keys` in adapter code.

## Verified evidence

- 2026-11-08: `dotenvx run --redact --strict -f ~/.config/secrets/raindrop.env -fk ~/.config/secrets/.env.keys -- node …` authenticated successfully with GET `/rest/v1/user` (HTTP 200).
- GET `/rest/v1/raindrops/0`, `sort=-created`, `perpage=50`, zero-based paging: 12 pages / 600 records inspected to cross the 2026-01-01 boundary; 16 saved Twitter/X URLs in 2026, identified by exact hostname locally.
- Native searches `link:twitter.com created:>2026-05-07` and `link:x.com created:>2026-05-07` returned 0 and 6 rows respectively, confirmed against an independent date-ordered scan.
- Relevant bookmark: Eric Zakariasson, “Building CLIs for agents”, id 1670248805, saved 2026-04-03. Use the id/URL for the live regression; do not commit private bookmark inventories.
- Official API docs: `/v1/raindrops/multiple`, `/v1/raindrops/single`, `/v1/collections/methods`, `/v1/tags`. Search operators: https://help.raindrop.io/filters/.

## Command contract

- `search [query]`: native Raindrop query passed unchanged; optional `--collection` (default 0, all except Trash), `--nested`, `--from YYYY-MM-DD`, `--to YYYY-MM-DD`, `--domain hostname[,hostname]`, `--sort` (default newest saved), `--limit` (default 20, 0 means exhaust matching pages).
- `--from` and `--to` are inclusive UTC calendar dates of bookmark creation/saving, not publication dates. Validate real dates and range order. Date filtering is checked locally, not silently trusted to the search parser.
- `--domain` matches an exact URL hostname or its subdomains, never an arbitrary URL substring. Multiple hostnames are ORed, then ANDed with the remaining filters. This supports `--domain x.com,twitter.com` without ambiguous native OR syntax.
- Apply the limit after filtering. Page serially (50 per request); do not stop on a page merely because its locally filtered rows are empty. Stop early at the lower date boundary only with descending creation order. Do not report invented totals.
- `get <id>`: one bookmark, including its note and metadata.
- `collections`: root and child collections, including parent id and bookmark count.
- `tags [--collection id]`: tag names and counts, with optional case-insensitive `--grep` for discovery.
- All commands declare `access: read`, `browser: false`. Public network execution strategy does not imply unauthenticated access: Bearer authentication is mandatory.
- Bookmark rows: `id`, `title`, `url`, `excerpt`, `note`, `tags`, `collection_id`, `created`, `updated`, `type`, `important`. Arrays remain arrays in JSON.
- No content scraping or claim that saved excerpts represent full threads; no semantic search implementation, synchronization, cache, mutation, or permanent-copy download.

## Phase 1 — API client and command tests

- [x] Verify token handling and live search/paging contracts.
- [x] Create `plugins/raindrop/package.json`, `opencli-plugin.json`, `shared.js`, and focused Node test-runner tests.
- [x] Shared GET-only client: fixed API origin, Bearer token from environment, reject redirects, bounded request timeout, validate `result` and payload shape.
- [x] Missing token gives a setup hint; 401/403 report authentication failure; 429 reports rate limiting without retry loops; network, non-JSON, malformed payloads and 5xx are explicit errors. Never include token or raw API error bodies in messages.
- [x] Tests use synthetic data and mocked fetch; cover auth, validation, pagination, exact-domain filtering, inclusive dates, empty intermediate pages, response errors and row shapes. Missing-token validation must make no request.

## Phase 2 — four commands

- [x] Create `search.js`, `get.js`, `collections.js`, `tags.js` using the existing registry/error conventions.
- [x] Test production command functions, including invalid arguments and genuine empty results (`EmptyResultError`, not sentinel rows).
- [x] Install the local plugin with the native plugin installer; run `opencli adapter check raindrop`.
- [x] Verify `dotenvx run … -- opencli raindrop …` sees the token on the actual OpenCLI execution path, including with an already running daemon. Never restart a shared daemon carrying credentials as a workaround.
- [x] Run all four commands live; compare the 2026 Twitter/X search against the observed 16-record baseline and retrieve the known CLI bookmark. Counts may change if the archive changes.

## Phase 3 — discovery and documentation

- [x] Register `plugins/raindrop` in root `opencli-plugin.json`.
- [x] Write `plugins/raindrop/README.md` with dotenvx setup/invocation, all commands, date/domain semantics, pagination, token privileges and limitations. Examples must not publish private inventories or credentials.
- [x] Update root README and AGENTS discovery guidance; distinguish authenticated personal bookmarks from public sources. Update `LOG.md` and this checklist.
- [x] Update the external wiki `C:\varie\msi\wsl\segreti.md` only with verified adapter usage, not credentials.

## Phase 4 — discoverable search language

Approved scope: enrich `search --help` with core syntax/examples and add `syntax`, an offline, token-free command returning documented operators, combinations, examples, caveats and source URLs in the usual output formats. Keep search execution unchanged.

- [x] Add production-path tests for token-free syntax, stable columns, examples and help discovery.
- [x] Implement `syntax.js` and enrich human/JSON search help.
- [x] Update discovery docs and run tests, adapter check, human help and JSON syntax through the installed CLI. Recorded the project-wide agent-discoverability rule in AGENTS.md; no audit or changes to unrelated adapters.

Unresolved questions: none.

## Review

- [x] All emitted keys match declared columns; snake_case columns, read access, no clamped input, silent empty fallback or sentinel row.
- [x] Tests and adapter check pass; live successful and empty/error paths documented accurately.
- [x] No secrets, keys or private API dumps in versioned files. No hand edits to upstream mirrored docs.

## Unresolved questions

None. Plan approved; implementation, runtime token inheritance, API shapes and manual convention review completed. Original four API commands verified live; offline syntax and human/JSON help verified through the installed CLI; 17 synthetic tests pass. Dotenvx is an optional external launcher, not an automatic adapter fallback. Commit and push requested after successful local use.
