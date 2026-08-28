---
schema_version: 1
workflow_id: whats-new
intent: see what has moved recently in the EU legislative process
last_verified: 2026-08-28
source: local
---

# What's new

## Goal

A list of the Commission's latest proposals and the latest events across all files, for periodic monitoring.

## State signature

None. Both feeds are sessionless and ordered newest first.

## Best path

```bash
opencli law-tracker proposals --limit 20 -f json
opencli law-tracker events --limit 20 -f csv
opencli law-tracker events --limit 20 --offset 20    # next page
```

Both return `reference`, `initiationDate`, `title` and a citable `url`; `events` adds an `event` column with the event type ("Vote in EP plenary", "Debate in EP plenary", …).

## Fallback path

```yaml
on_adapter_fail:
  - adapter_health_update: opencli law-tracker proposals -> suspect
  - goto /homepage?lang=en
  - action:dismiss_cookie_banner in pages/homepage.md
  - both feeds sit in the expandable panels on the homepage ("expand" buttons); reading them there is slower and less structured
```

## Avoid

- Asking for a very large `--limit` hoping for the full archive: these are novelty feeds, not an archive. For history go through `workflows/find-procedures.md` with date ordering.

## State validation

`initiationDate` values are descending and the first one is recent. If a feed comes back empty the adapter raises EMPTY rather than returning an empty list.

## Stale markers

If `startingPosition`/`size` stop being mandatory, or new fields appear in the feed, re-verify.
