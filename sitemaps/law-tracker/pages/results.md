---
schema_version: 1
page_id: results
url_patterns:
  - https://law-tracker.europa.eu/results
purpose: list of procedures matching a search, with sidebar facets and pagination
last_verified: 2026-08-28
source: local
---

# Results page

**Deep-linkable**: every search parameter lives in the URL, so you get here in a single navigation, without touching the homepage and without meeting the cookie banner.

## URL shape

```
/results?quickSearch=<text>&sort=REL&page=0&pageSize=10&lang=en
/results?eurovoc=%5B%22<code>,DOM%22%5D&searchType=topics&sort=DOCD_DESC&page=0&pageSize=10&lang=en
/results?searchType=advanced&statusType=ONG&stage=%5B%22FR%22%5D&sort=REL&page=0&pageSize=10&lang=en
```

`sort`: `REL` | `DATE` | `DOCD_DESC`. Careful: those are the **URL** values; in the API body the date ordering is called `DOCD` and `DATE` returns 400 (see `pitfalls.md#sort_date_is_docd`). `pageSize`: 5 | 10 | 20 — the only entries in the "View" menu. `page` is zero-based. `statusType` is upper case in the URL (`ONG`, `ADO`, `NAD`, `WIT`) and lower case in the API body.

## Visual anchors

- text: document title `Search results` — **the only page on the site with a title of its own**, so it is a reliable state signature (`opencli browser <sess> state` → `title: Search results`)
- a11y: `heading "Search results" level=2`
- a11y: `combobox "Sort by:"` and `combobox "View"`
- a11y: results are `link` elements whose accessible name starts with the reference (`2021/0106(COD) …`) and whose `href` is `/procedure/<api-ref>`

## Actions on this page

### action:list_results
pre: a `/results?...` URL is loaded and the network is idle
do: snapshot the interactive elements with hrefs and keep the links pointing at `/procedure/`
post: one row per procedure, each carrying the reference in its name and the `api-ref` in its href
fail: zero links to `/procedure/` | the page shows nothing but the site chrome
recover: check the URL carries `lang=en`; widen the filter if it is too narrow; for a structured list prefer `opencli law-tracker search`
evidence: agent-browser open '/results?quickSearch=artificial%20intelligence&sort=DATE&page=0&pageSize=5&lang=en' + snapshot -i -c -u → 3 links to /procedure/ (2022_303, 2021_106, 2025_359)

### action:open_procedure_from_results
pre: the result list is visible
do: read the link's `href` and navigate to it (no click needed)
post: URL `/procedure/<api-ref>`, `pages/procedure.md` applies
fail: navigation succeeds but the page has no content (non-existent reference)
recover: check the reference link is present, see `pitfalls.md#silent_empty_procedure`
evidence: snapshot -i -u on /results → url=https://law-tracker.europa.eu/procedure/2021_106

## Sidebar facets

The left column carries year and EuroVoc-domain filters with counts (e.g. `ENVIRONMENT(2)`) and an `Apply filters` button. They are the one thing on this page the adapters do not return: if you need facet counts, the browser is the way.

## Linked APIs

`search` (POST). The `opencli law-tracker search` adapter covers the same searches with first-class filters.
