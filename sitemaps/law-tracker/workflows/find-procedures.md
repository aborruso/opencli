---
schema_version: 1
workflow_id: find-procedures
intent: find the legislative procedures on a topic, in a status, or at a stage
last_verified: 2026-08-28
source: local
---

# Find procedures

## Goal

Go from a question in plain words ("the proposals still open at first reading on the environment") to a list of procedures with references and citable URLs.

## State signature

No state to keep: search is sessionless and needs no login. If you already hold a `/results?...` URL you are halfway there.

## Best path

`opencli law-tracker search` with first-class filters.

```bash
opencli law-tracker search "artificial intelligence" -f json     # free text only
opencli law-tracker search --status ong --stage FR --size 20     # filters only
opencli law-tracker search --eurovoc "52,DOM" -f csv             # by EuroVoc domain
opencli law-tracker topics eurovoc                               # the 21 domains and their codes
opencli law-tracker topics policy-area                           # policy-area codes
```

**A rule you cannot work around: free text and the `--status`/`--stage` filters do not go together.** When the backend receives text it ignores those two filters and returns rows that violate them. The adapter refuses the combination with an ARGUMENT error rather than hand over wrong data. To narrow a text search, use `--keyword` (a structured filter, which stays in AND) or filter downstream on the `status` and `currentStage` columns.

## Fallback path

```yaml
on_adapter_fail:
  - adapter_health_update: opencli law-tracker search -> suspect
  - navigate straight to the results URL, skipping the homepage:
      /results?quickSearch=<text>&sort=REL&page=0&pageSize=10&lang=en
      /results?searchType=advanced&statusType=ONG&stage=%5B%22FR%22%5D&sort=REL&page=0&pageSize=10&lang=en
      /results?eurovoc=%5B%22<code>,DOM%22%5D&searchType=topics&sort=DOCD_DESC&page=0&pageSize=10&lang=en
  - action:list_results in pages/results.md
```

If direct navigation is not possible, then and only then go through the homepage: `action:dismiss_cookie_banner` → `action:quick_search` / `action:browse_by_topic` / `action:advanced_search` in `pages/homepage.md`.

## Avoid

- Filling the homepage forms when the results URL can be built: it costs turns and walks into the cookie banner.
- Reading `totalResults` from the `/search` response: it is 0 even when there are results.
- Counting rows on a page to get a total: a page holds 20 entries at most.

## State validation

Every row carries a display-form `reference` and a `url` pointing at `/procedure/<api-ref>`. A missing `url` means the reference could not be parsed.

## Stale markers

If the results-page URL parameters get renamed, or `--status`/`--stage` start working **even** alongside free text, this file is out of date: re-verify and update `pitfalls.md`.
