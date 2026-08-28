---
schema_version: 1
page_id: procedure
url_patterns:
  - https://law-tracker.europa.eu/procedure/
purpose: a single legislative procedure and its timeline
last_verified: 2026-08-28
source: local
---

# Procedure page

URL: `/procedure/<api-ref>?lang=en`, where `<api-ref>` is the API form of the reference: `2021_106`, **not** `2021/0106(COD)`. The number loses its leading zeros.

## Visual anchors

- a11y: a `link` whose text is the reference in display form, e.g. `2021/0106(COD)` — **this is the state anchor**, not the document title
- a11y: `link "Download XML file"`
- a11y: `button "Latest events"` and `button "Full timeline"`
- ⚠️ the `<title>` stays `EU Law Tracker - European Union`: identical to a non-existent procedure's, useless as a signature

## Actions on this page

### action:verify_procedure_exists
pre: navigation to `/procedure/<api-ref>` has completed
do: `opencli browser <sess> find --role link --text "<year>/<number>"`
post: the link exists → the procedure exists
fail: `semantic_not_found` — "Semantic locator matched 0 elements"
recover: the reference is wrong or non-existent; get the right one from `opencli law-tracker search` or from the results page. See `pitfalls.md#silent_empty_procedure`
evidence: opencli browser <sess> find --role link --text "2021/0106" → matches_n 1, text "2021/0106(COD)"; on /procedure/9999_1 the same find answers semantic_not_found

### action:read_timeline
pre: a valid procedure page
do: `opencli law-tracker timeline <reference>` (accepts both `2021/0106(COD)` and `2021_106`)
post: one row per event with `date, stage, event, typeIdentifier, documents, reference, url`
fail: ARGUMENT error on a malformed or unknown reference | EMPTY if the notice has no events
recover: fix the reference; if the command keeps failing, adapter_health_update: opencli law-tracker timeline -> suspect, and read the timeline off the page by expanding the entries with the `expand` buttons
evidence: opencli law-tracker timeline 2021_106 -f csv → 13 rows, from 22/04/2021 PR to 12/07/2024 EOP

### action:export_xml
pre: a valid procedure page
do: click `link "Download XML file"`, or `GET /notice/export?reference=<api-ref>&lang=en`
post: the official notice as XML
fail: the download does not start in the browser
recover: use the HTTP endpoint, which needs no browser
evidence: link "Download XML file" present in the snapshot of /procedure/2021_106; endpoint documented in eutrack (spec.yaml)

## Linked APIs

`notice_timeline` feeds this page. See `endpoints.json`.
